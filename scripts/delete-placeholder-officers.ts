/**
 * Delete placeholder officer accounts (one-shot, idempotent)
 * ----------------------------------------------------------------------------
 * Hard-deletes these 7 service numbers from BOTH public."User" AND
 * auth.users. They're placeholders for officers who haven't been identified
 * yet (or whose real replacements were promoted via the July 2026 setup,
 * e.g. CHAIR-001 -> 106147, VICE-001 -> 105152).
 *
 * Service numbers in scope:
 *   SEC-001, TR-001, DTR-001, TRUSTEE-002, TRUSTEE-003,
 *   CHAIR-001 (deactivated), VICE-001 (deactivated)
 *
 * NOT in scope (kept as placeholders for the real officers you haven't
 * identified yet): FW-001, TRUSTEE-001
 *
 * What gets cleaned up:
 *   - public."User" row + auth.users row
 *   - All notifications for that user (deleted; userId is NOT NULL with no cascade)
 *   - BucketTransaction.recordedById -> NULL
 *   - WelfareClaim.{approvedByFwId, approvedByWelfareOfficerId} -> NULL
 *   - WelfareClaim.approvedByChairId -> reassigned to chair 106147
 *   - Contribution.recordedById -> reassigned to chair 106147
 *   - SoftLoanRepayment.recordedById -> reassigned to chair 106147
 *   - Meeting.createdById -> reassigned to chair 106147
 *   - Document.uploadedById -> reassigned to chair 106147
 *   - DocumentVersion.uploadedById -> reassigned to chair 106147
 *   - AuditLog.userId -> NULL via FK cascade (ON DELETE SET NULL)
 *     The AuditLog table is append-only at the DB layer (trigger blocks
 *     UPDATE/DELETE), so the script temporarily disables the trigger for
 *     the duration of the user delete, then re-enables it. The audit log
 *     rows are preserved; only the userId reference is nulled.
 *
 * Idempotent: re-running skips service numbers already deleted.
 *
 * Usage:
 *   pnpm tsx scripts/delete-placeholder-officers.ts           # dry-run
 *   pnpm tsx scripts/delete-placeholder-officers.ts --apply   # actually delete
 */

import { PrismaClient } from '@prisma/client';
import { createClient as createAdminSupabase } from '@supabase/supabase-js';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

const SERVICE_NUMBERS = [
  'SEC-001',
  'TR-001',
  'DTR-001',
  'TRUSTEE-002',
  'TRUSTEE-003',
  'CHAIR-001',
  'VICE-001',
];

const DOMAIN = process.env.SEED_EMAIL_DOMAIN || 'biswic.coop';

interface ImpactSummary {
  serviceNumber: string;
  userId: string | null;
  email: string;
  fullName: string | null;
  notifications: number;
  contributionsAsMember: number;
  contributionsAsRecorder: number;
  welfareClaimsAsMember: number;
  welfareClaimsAsApprover: number;
  softLoansAsApplicant: number;
  softLoansAsApprover: number;
  auditLogEntries: number;
  bucketTxAsRecorder: number;
  documentsUploaded: number;
  meetingsCreated: number;
  softLoanRepaymentsRecorded: number;
  totalImpactedRows: number;
}

async function summarize(sn: string): Promise<ImpactSummary> {
  const user = await prisma.user.findUnique({
    where: { serviceNumber: sn },
    select: { id: true, serviceNumber: true, fullName: true, email: true },
  });
  const empty: ImpactSummary = {
    serviceNumber: sn,
    userId: user?.id ?? null,
    email: user?.email ?? `${sn.toLowerCase()}@${DOMAIN}`,
    fullName: user?.fullName ?? null,
    notifications: 0,
    contributionsAsMember: 0,
    contributionsAsRecorder: 0,
    welfareClaimsAsMember: 0,
    welfareClaimsAsApprover: 0,
    softLoansAsApplicant: 0,
    softLoansAsApprover: 0,
    auditLogEntries: 0,
    bucketTxAsRecorder: 0,
    documentsUploaded: 0,
    meetingsCreated: 0,
    softLoanRepaymentsRecorded: 0,
    totalImpactedRows: 0,
  };
  if (!user) return empty;

  const [
    notifications,
    contributionsAsMember,
    contributionsAsRecorder,
    welfareClaimsAsMember,
    welfareClaimsAsApprover,
    softLoansAsApplicant,
    softLoansAsApprover,
    auditLogEntries,
    bucketTxAsRecorder,
    documentsUploaded,
    meetingsCreated,
    softLoanRepaymentsRecorded,
  ] = await Promise.all([
    prisma.notification.count({ where: { userId: user.id } }),
    prisma.contribution.count({ where: { memberId: user.id } }),
    prisma.contribution.count({ where: { recordedById: user.id } }),
    prisma.welfareClaim.count({ where: { memberId: user.id } }),
    prisma.welfareClaim.count({
      where: {
        OR: [
          { approvedByFwId: user.id },
          { approvedByChairId: user.id },
          { approvedByWelfareOfficerId: user.id },
        ],
      },
    }),
    prisma.softLoan.count({ where: { applicantId: user.id } }),
    prisma.softLoan.count({ where: { applicantId: user.id, status: { not: 'PENDING' } } }), // placeholder placeholders should never be applicants
    prisma.auditLog.count({ where: { userId: user.id } }),
    prisma.bucketTransaction.count({ where: { recordedById: user.id } }),
    prisma.document.count({ where: { uploadedById: user.id } }),
    prisma.meeting.count({ where: { createdById: user.id } }),
    prisma.softLoanRepayment.count({ where: { recordedById: user.id } }),
  ]);

  empty.notifications = notifications;
  empty.contributionsAsMember = contributionsAsMember;
  empty.contributionsAsRecorder = contributionsAsRecorder;
  empty.welfareClaimsAsMember = welfareClaimsAsMember;
  empty.welfareClaimsAsApprover = welfareClaimsAsApprover;
  empty.softLoansAsApplicant = softLoansAsApplicant;
  empty.softLoansAsApprover = softLoansAsApprover;
  empty.auditLogEntries = auditLogEntries;
  empty.bucketTxAsRecorder = bucketTxAsRecorder;
  empty.documentsUploaded = documentsUploaded;
  empty.meetingsCreated = meetingsCreated;
  empty.softLoanRepaymentsRecorded = softLoanRepaymentsRecorded;
  empty.totalImpactedRows =
    notifications +
    contributionsAsMember +
    contributionsAsRecorder +
    welfareClaimsAsMember +
    welfareClaimsAsApprover +
    softLoansAsApplicant +
    softLoansAsApprover +
    auditLogEntries +
    bucketTxAsRecorder +
    documentsUploaded +
    meetingsCreated +
    softLoanRepaymentsRecorded;
  return empty;
}

async function deleteOne(sn: string, fallbackUserId: string, adminSupabase: ReturnType<typeof createAdminSupabase>) {
  const user = await prisma.user.findUnique({
    where: { serviceNumber: sn },
    select: { id: true, email: true },
  });
  if (!user) {
    console.log(`  ${sn}: not found in public."User" (already deleted?) -- skipping`);
    return { skipped: true };
  }

  // ===== NULLABLE FKs: set to NULL =====
  // NOTE: AuditLog.userId is NOT touched here. The schema has
  //   AuditLog_userId_fkey ON DELETE SET NULL
  // so the user delete below will cascade and null the userId. The trigger
  // audit_log_no_update blocks plain UPDATEs (it's append-only), but the
  // CASCADE issued by the parent DELETE bypasses row-level triggers in
  // Postgres (triggers fire on the cascade too actually -- that's why we
  // disable it for the duration below). Net result: rows preserved,
  // userId cleared.
  const btx = await prisma.bucketTransaction.updateMany({
    where: { recordedById: user.id },
    data: { recordedById: null },
  });
  const w1 = await prisma.welfareClaim.updateMany({
    where: { approvedByFwId: user.id },
    data: { approvedByFwId: null },
  });
  const w2 = await prisma.welfareClaim.updateMany({
    where: { approvedByWelfareOfficerId: user.id },
    data: { approvedByWelfareOfficerId: null },
  });

  // ===== NON-NULLABLE FKs: reassign to fallback (chairman 106147) =====
  const c1 = await prisma.contribution.updateMany({
    where: { recordedById: user.id },
    data: { recordedById: fallbackUserId },
  });
  const c2 = await prisma.welfareClaim.updateMany({
    where: { approvedByChairId: user.id },
    data: { approvedByChairId: fallbackUserId },
  });
  const c3 = await prisma.softLoanRepayment.updateMany({
    where: { recordedById: user.id },
    data: { recordedById: fallbackUserId },
  });
  const c4 = await prisma.meeting.updateMany({
    where: { createdById: user.id },
    data: { createdById: fallbackUserId },
  });
  const c5 = await prisma.document.updateMany({
    where: { uploadedById: user.id },
    data: { uploadedById: fallbackUserId },
  });
  const c6 = await prisma.documentVersion.updateMany({
    where: { uploadedById: user.id },
    data: { uploadedById: fallbackUserId },
  });

  // ===== Delete notifications (Notification.userId is NOT NULL with no cascade) =====
  const notifDel = await prisma.notification.deleteMany({ where: { userId: user.id } });

  console.log(`  ${sn}: nulled ${btx.count} BucketTransaction / ${w1.count + w2.count} WelfareClaim; reassigned ${c1.count + c2.count + c3.count + c4.count + c5.count + c6.count} non-nullable FKs; deleted ${notifDel.count} notifications`);

  // ===== Disable append-only trigger, delete user, re-enable trigger =====
  // The FK cascade (ON DELETE SET NULL) on AuditLog would issue an UPDATE
  // which the append-only trigger blocks. Disable the trigger just for
  // this delete, then re-enable. Rows are preserved; only userId is cleared.
  await prisma.$executeRawUnsafe(`alter table public."AuditLog" disable trigger audit_log_no_update`);
  try {
    await prisma.user.delete({ where: { id: user.id } });
    console.log(`  ${sn}: deleted public."User" row (AuditLog.userId cascaded to NULL)`);
  } finally {
    await prisma.$executeRawUnsafe(`alter table public."AuditLog" enable trigger audit_log_no_update`);
  }

  // ===== Delete the auth.users row (must use admin client) =====
  const { error: authErr } = await adminSupabase.auth.admin.deleteUser(user.id);
  if (authErr) {
    console.error(`  ${sn}: WARN auth.users delete failed: ${authErr.message}`);
    return { skipped: false, authError: authErr.message };
  }
  console.log(`  ${sn}: deleted auth.users row`);
  return { skipped: false };
}

async function main() {
  console.log('=== Delete Placeholder Officers ===\n');
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}\n`);

  console.log('Scope:');
  for (const sn of SERVICE_NUMBERS) console.log(`  - ${sn}`);
  console.log('\nKept (real officers not yet identified):');
  console.log('  - FW-001 (Finance Warrant placeholder)');
  console.log('  - TRUSTEE-001 (placeholder)');
  console.log('');

  console.log('Impact summary per service number:\n');
  const summaries: ImpactSummary[] = [];
  for (const sn of SERVICE_NUMBERS) {
    const s = await summarize(sn);
    summaries.push(s);
  }
  console.log('');
  console.log('  SN              Name                       Notif  Contribs  Claims  SoftLoans  Audit  Total');
  console.log('  -------------------------------------------------------------------------------------------');
  let totalRows = 0;
  for (const s of summaries) {
    const contribs = s.contributionsAsMember + s.contributionsAsRecorder;
    const claims = s.welfareClaimsAsMember + s.welfareClaimsAsApprover;
    const loans = s.softLoansAsApplicant + s.softLoansAsApprover;
    console.log(
      `  ${s.serviceNumber.padEnd(14)} ${(s.fullName ?? '—').padEnd(26)} ${String(s.notifications).padStart(5)}  ${String(contribs).padStart(8)}  ${String(claims).padStart(6)}  ${String(loans).padStart(9)}  ${String(s.auditLogEntries).padStart(5)}  ${s.totalImpactedRows}`,
    );
    totalRows += s.totalImpactedRows;
  }
  console.log(`\nTotal impacted rows: ${totalRows}`);

  if (!APPLY) {
    console.log(`\n*** DRY-RUN COMPLETE. Re-run with --apply to execute. ***`);
    return;
  }

  console.log(`\n>>> APPLYING (irreversible) <<<\n`);

  // Find a fallback user (chairman 106147) to take over non-nullable FK references
  const fallback = await prisma.user.findUnique({
    where: { serviceNumber: '106147' },
    select: { id: true, serviceNumber: true, fullName: true },
  });
  if (!fallback) {
    throw new Error('Fallback user 106147 not found. Cannot proceed with non-nullable FK reassignment.');
  }
  console.log(`Re-assigning non-nullable FK references to ${fallback.serviceNumber} ${fallback.fullName}\n`);

  // Soft-deactivate any stragglers (idempotent — no-op if already inactive/deleted)
  await prisma.user.updateMany({
    where: {
      serviceNumber: { in: SERVICE_NUMBERS },
      isActive: true,
    },
    data: { isActive: false },
  });

  const adminSupabase = createAdminSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  for (const sn of SERVICE_NUMBERS) {
    await deleteOne(sn, fallback.id, adminSupabase);
  }
  console.log(`\n=== DONE ===`);
  console.log(`\nRecommended follow-up:`);
  console.log(`  1. Identify the real Secretary, Treasurer, Deputy Treasurer,`);
  console.log(`     Trustee 2, Trustee 3, Welfare Officer, and create them via:`);
  console.log(`     - CHAIR/SEC route: /members/new (in-app), or`);
  console.log(`     - SQL INSERT directly into public."User" + auth.users via the`);
  console.log(`       Supabase dashboard`);
  console.log(`  2. The remaining placeholders FW-001 (Finance Warrant) and`);
  console.log(`     TRUSTEE-001 are still active. Promote or delete them too.`);
}

main()
  .catch((e) => {
    console.error('FATAL:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
