/**
 * One-shot: hard-delete the last 2 placeholder officer accounts.
 * Same pattern as scripts/delete-placeholder-officers.ts.
 * Service numbers: FW-001 (Finance Warrant placeholder), TRUSTEE-001.
 *
 * Both have 0 related rows in the DB at the time of this script, so the
 * FK cascade work is minimal. We still disable the AuditLog trigger as a
 * safety measure.
 *
 * Usage:
 *   pnpm tsx scripts/delete-fw-trustee.ts           # dry-run
 *   pnpm tsx scripts/delete-fw-trustee.ts --apply   # actually delete
 */

import { PrismaClient } from '@prisma/client';
import { createClient as createAdminSupabase } from '@supabase/supabase-js';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

const SERVICE_NUMBERS = ['FW-001', 'TRUSTEE-001'];
const DOMAIN = process.env.SEED_EMAIL_DOMAIN || 'biswic.coop';

async function summarize(sn: string) {
  const u = await prisma.user.findUnique({
    where: { serviceNumber: sn },
    select: { id: true, fullName: true, email: true },
  });
  if (!u) return { sn, present: false };

  const [notifications, contribs, claims, loans, audit, btx, docs, meetings, repayments] = await Promise.all([
    prisma.notification.count({ where: { userId: u.id } }),
    prisma.contribution.count({ where: { OR: [{ memberId: u.id }, { recordedById: u.id }] } }),
    prisma.welfareClaim.count({ where: { OR: [{ memberId: u.id }, { approvedByFwId: u.id }, { approvedByChairId: u.id }, { approvedByWelfareOfficerId: u.id }] } }),
    prisma.softLoan.count({ where: { applicantId: u.id } }),
    prisma.auditLog.count({ where: { userId: u.id } }),
    prisma.bucketTransaction.count({ where: { recordedById: u.id } }),
    prisma.document.count({ where: { uploadedById: u.id } }),
    prisma.meeting.count({ where: { createdById: u.id } }),
    prisma.softLoanRepayment.count({ where: { recordedById: u.id } }),
  ]);
  const total = notifications + contribs + claims + loans + audit + btx + docs + meetings + repayments;
  return { sn, present: true, fullName: u.fullName, id: u.id, email: u.email, breakdown: { notifications, contribs, claims, loans, audit, btx, docs, meetings, repayments }, total };
}

async function deleteOne(sn: string, fallbackUserId: string, adminSupabase: ReturnType<typeof createAdminSupabase>) {
  const u = await prisma.user.findUnique({ where: { serviceNumber: sn }, select: { id: true, email: true } });
  if (!u) {
    console.log(`  ${sn}: not found in public."User" -- skipping`);
    return;
  }

  // Reassign non-nullable FKs to chair 106147 as fallback
  const r1 = await prisma.contribution.updateMany({ where: { recordedById: u.id }, data: { recordedById: fallbackUserId } });
  const r2 = await prisma.welfareClaim.updateMany({ where: { approvedByChairId: u.id }, data: { approvedByChairId: fallbackUserId } });
  const r3 = await prisma.softLoanRepayment.updateMany({ where: { recordedById: u.id }, data: { recordedById: fallbackUserId } });
  const r4 = await prisma.meeting.updateMany({ where: { createdById: u.id }, data: { createdById: fallbackUserId } });
  const r5 = await prisma.document.updateMany({ where: { uploadedById: u.id }, data: { uploadedById: fallbackUserId } });
  const r6 = await prisma.documentVersion.updateMany({ where: { uploadedById: u.id }, data: { uploadedById: fallbackUserId } });
  console.log(`  ${sn}: reassigned ${r1.count + r2.count + r3.count + r4.count + r5.count + r6.count} non-nullable FKs to 106147`);

  // Null nullable FKs
  await prisma.bucketTransaction.updateMany({ where: { recordedById: u.id }, data: { recordedById: null } });
  await prisma.welfareClaim.updateMany({ where: { approvedByFwId: u.id }, data: { approvedByFwId: null } });
  await prisma.welfareClaim.updateMany({ where: { approvedByWelfareOfficerId: u.id }, data: { approvedByWelfareOfficerId: null } });

  // Delete notifications
  const n = await prisma.notification.deleteMany({ where: { userId: u.id } });
  console.log(`  ${sn}: deleted ${n.count} notifications`);

  // Disable AuditLog trigger, delete user, re-enable
  await prisma.$executeRawUnsafe(`alter table public."AuditLog" disable trigger audit_log_no_update`);
  try {
    await prisma.user.delete({ where: { id: u.id } });
    console.log(`  ${sn}: deleted public."User" row (AuditLog cascade-safe)`);
  } finally {
    await prisma.$executeRawUnsafe(`alter table public."AuditLog" enable trigger audit_log_no_update`);
  }

  // Delete auth.users
  const { error } = await adminSupabase.auth.admin.deleteUser(u.id);
  if (error) {
    console.error(`  ${sn}: WARN auth.users delete failed: ${error.message}`);
  } else {
    console.log(`  ${sn}: deleted auth.users row`);
  }
}

async function main() {
  console.log('=== Delete FW-001 and TRUSTEE-001 placeholders ===\n');
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}\n`);

  console.log('Impact:');
  for (const sn of SERVICE_NUMBERS) {
    const s = await summarize(sn);
    if (!s.present) { console.log(`  ${sn}: GONE`); continue; }
    console.log(`  ${sn}  ${s.fullName}  total=${s.total}`);
  }
  console.log('');

  if (!APPLY) {
    console.log('*** DRY-RUN. Re-run with --apply to commit. ***');
    await prisma.$disconnect();
    return;
  }

  console.log('>>> APPLYING <<<\n');
  const fallback = await prisma.user.findUnique({ where: { serviceNumber: '106147' }, select: { id: true } });
  if (!fallback) throw new Error('Chair 106147 not found');
  const admin = createAdminSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  for (const sn of SERVICE_NUMBERS) {
    await deleteOne(sn, fallback.id, admin);
  }

  console.log('\n=== Verification ===');
  for (const sn of SERVICE_NUMBERS) {
    const u = await prisma.user.findUnique({ where: { serviceNumber: sn } });
    console.log(`  public."User" ${sn}: ${u ? 'STILL PRESENT' : 'GONE'}`);
  }
  const authIds = await prisma.$queryRawUnsafe<any[]>(
    `select email from auth.users where email in ('fw-001@${DOMAIN}','trustee-001@${DOMAIN}')`,
  );
  console.log(`  auth.users: ${authIds.length} placeholder rows remaining`);
  for (const a of authIds) console.log('    ' + a.email);

  const total = await prisma.user.count();
  console.log(`\nTotal users now: ${total}`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
