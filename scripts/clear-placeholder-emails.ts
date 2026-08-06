/* eslint-disable no-console */
/**
 * Clear placeholder emails on every user that has one.
 *
 * Two places to clean:
 *  1. public.User.email (local Prisma) - used by requestPasswordResetAction
 *  2. auth.users.email   (Supabase Auth) - the actual email recipient for Supabase
 *
 * "Placeholder" = the seeded pattern `<serviceNumber>@biswic.coop`, which is not a
 * real mailbox and causes Supabase to 500 when the password-reset endpoint tries
 * to send. Real emails (e.g. datemric@gmail.com) are left alone.
 *
 * After this script:
 *  - Login still works (service_number + password, no email needed).
 *  - Password reset silently no-ops for cleared users (the action returns the same
 *    success message regardless, so it doesn't leak which service numbers exist).
 *  - When a real email is added later, an admin or the user can re-enable recovery.
 *
 * Usage:
 *   npx tsx scripts/clear-placeholder-emails.ts          # dry run (default)
 *   npx tsx scripts/clear-placeholder-emails.ts --apply   # write to DB + Supabase
 */
import { PrismaClient } from '@prisma/client';

const APPLY = process.argv.includes('--apply');
const PLACEHOLDER_DOMAINS = ['@biswic.coop', '@pending.biswic.local', '@placeholder.biswic.local'];

const prisma = new PrismaClient();

type CleanupRow = {
  serviceNumber: string;
  fullName: string;
  dbEmail: string | null;
  authUserId: string | null;
};

async function main() {
  // 1. Read all local users
  const users = await prisma.user.findMany({
    select: { id: true, serviceNumber: true, fullName: true, email: true },
    orderBy: { serviceNumber: 'asc' },
  });

  // 2. Filter to placeholders
  const placeholders = users.filter((u) => {
    if (!u.email) return false;
    const e = u.email.toLowerCase();
    return PLACEHOLDER_DOMAINS.some((d) => e.endsWith(d)) || /^\d{4,7}@/.test(e);
  });

  const reals = users.filter((u) => u.email && !placeholders.includes(u));
  const alreadyNull = users.filter((u) => !u.email);

  console.log('--- inventory ---');
  console.log('total users:                 ', users.length);
  console.log('placeholder emails (will clear):', placeholders.length);
  console.log('real emails (will keep):     ', reals.length);
  console.log('already null:                ', alreadyNull.length);
  if (reals.length > 0) {
    console.log('\nreal emails on file:');
    for (const r of reals) console.log(`  ${r.serviceNumber}  ${r.email}  (${r.fullName})`);
  }

  if (placeholders.length === 0) {
    console.log('\nNothing to clean.');
    return;
  }

  console.log('\n--- to be cleared ---');
  for (const p of placeholders) console.log(`  ${p.serviceNumber}  ${p.email}  (${p.fullName})`);

  if (!APPLY) {
    console.log('\nDRY RUN. Re-run with --apply to write to DB and Supabase Auth.');
    return;
  }

  // 3. Clear local DB
  console.log('\n[1/2] clearing local DB emails...');
  const dbResult = await prisma.user.updateMany({
    where: { id: { in: placeholders.map((u) => u.id) } },
    data: { email: null },
  });
  console.log(`  updated ${dbResult.count} rows in public.User`);

  // 4. Replace auth.users emails with a unique sentinel that cannot be delivered.
  //    The .invalid TLD is reserved by RFC 2606 -- no real DNS or MX records
  //    exist, so any SMTP attempt to it bounces. The "+{serviceNumber}" tag
  //    keeps each user unique and makes them easy to find later when a real
  //    email needs to be added. This is the only path that works because the
  //    Supabase admin API does not accept email: null -- it silently keeps
  //    the existing value.
  console.log('\n[2/2] setting auth.users emails to RFC-2606 sentinels...');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }

  let cleared = 0;
  let failed = 0;
  for (const p of placeholders) {
    const sentinel = `null+${p.serviceNumber}@biswic.invalid`;
    const url = `${supabaseUrl}/auth/v1/admin/users/${p.id}`;
    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: sentinel, email_confirm: true }),
      });
      if (!res.ok) {
        const body = await res.text();
        console.error(`  FAILED  ${p.serviceNumber}  status=${res.status}  body=${body.slice(0, 200)}`);
        failed++;
      } else {
        cleared++;
        if (cleared % 10 === 0) console.log(`  ... ${cleared}/${placeholders.length}`);
      }
    } catch (e: any) {
      console.error(`  ERROR   ${p.serviceNumber}  ${e?.message ?? e}`);
      failed++;
    }
  }
  console.log(`  replaced ${cleared} of ${placeholders.length} auth.users emails (${failed} failed)`);

  // 5. Verify
  const verifyNull = await prisma.user.count({ where: { email: null } });
  const verifyPlaceholders = await prisma.user.count({
    where: { email: { endsWith: '@biswic.coop' } },
  });
  const verifySentinels = await prisma.user.count({
    where: { email: { endsWith: '@biswic.invalid' } },
  });
  console.log('\n--- post-state ---');
  console.log(`local DB: ${verifyNull} null emails, ${verifyPlaceholders} remaining @biswic.coop placeholders, ${verifySentinels} @biswic.invalid sentinels`);
  console.log('\n--- to set a real email later ---');
  console.log("Use: PUT $SUPABASE_URL/auth/v1/admin/users/<id> with { email: 'real@example.com' }");
  console.log('Or:  prisma.user.update({ where: { id }, data: { email: <real> } })');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
