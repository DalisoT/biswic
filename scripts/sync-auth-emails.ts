/* eslint-disable no-console */
/**
 * Sync the Supabase auth.users email to match the local Prisma User.email
 * for any user that has a real (non-placeholder, non-sentinel) email on file.
 *
 * Why: requestPasswordResetAction calls admin.auth.resetPasswordForEmail(user.email),
 * and Supabase looks up the recipient by THEIR auth.users.email, not the address
 * you pass. So if local DB says datemric@gmail.com but auth.users still says
 * 106759@biswic.coop, the reset is silently dropped.
 *
 * Usage:
 *   npx tsx scripts/sync-auth-emails.ts          # dry run
 *   npx tsx scripts/sync-auth-emails.ts --apply  # write
 */
import { PrismaClient } from '@prisma/client';

const APPLY = process.argv.includes('--apply');
const PLACEHOLDER_SUFFIXES = ['@biswic.coop', '@biswic.invalid', '@pending.biswic.local'];

const prisma = new PrismaClient();

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  }

  // Local users with a real email
  const localUsers = await prisma.user.findMany({
    where: {
      email: { not: null },
    },
    select: { id: true, serviceNumber: true, fullName: true, email: true },
    orderBy: { serviceNumber: 'asc' },
  });

  const real = localUsers.filter((u) => {
    const e = u.email!.toLowerCase();
    return !PLACEHOLDER_SUFFIXES.some((s) => e.endsWith(s));
  });

  console.log(`Found ${real.length} users with real emails:`);
  for (const u of real) console.log(`  ${u.serviceNumber}  ${u.email}  (${u.fullName})`);

  let updated = 0;
  let alreadyInSync = 0;
  let failed = 0;
  for (const u of real) {
    const url = `${supabaseUrl}/auth/v1/admin/users/${u.id}`;
    const getRes = await fetch(url, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    });
    if (!getRes.ok) {
      console.error(`  GET failed for ${u.serviceNumber}  status=${getRes.status}`);
      failed++;
      continue;
    }
    const auth = (await getRes.json()) as { email: string | null };
    if (auth.email === u.email) {
      alreadyInSync++;
      continue;
    }
    console.log(`  ${u.serviceNumber}  auth="${auth.email ?? '<null>'}"  -> "${u.email}"`);
    if (!APPLY) continue;
    const putRes = await fetch(url, {
      method: 'PUT',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: u.email, email_confirm: true }),
    });
    if (!putRes.ok) {
      console.error(`    PUT failed: status=${putRes.status}  body=${(await putRes.text()).slice(0, 200)}`);
      failed++;
    } else {
      updated++;
    }
  }
  if (!APPLY) {
    console.log(`\nDRY RUN. ${alreadyInSync} already in sync, ${real.length - alreadyInSync} to update. Re-run with --apply.`);
  } else {
    console.log(`\nDone. updated=${updated}  alreadyInSync=${alreadyInSync}  failed=${failed}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
