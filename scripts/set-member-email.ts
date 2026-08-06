/* eslint-disable no-console */
/**
 * Set a single member's real email on both local public.User and auth.users.
 *
 * Usage:
 *   npx tsx scripts/set-member-email.ts <serviceNumber> <email>
 *
 * Example:
 *   npx tsx scripts/set-member-email.ts 105152 teddyfwoloshi906@gmail.com
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';

const [, , serviceNumberArg, emailArg] = process.argv;
if (!serviceNumberArg || !emailArg) {
  console.error('Usage: npx tsx scripts/set-member-email.ts <serviceNumber> <email>');
  process.exit(1);
}
const serviceNumber = serviceNumberArg.toUpperCase().trim();
const email = emailArg.trim().toLowerCase();

// Basic email shape check
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error(`That doesn't look like a valid email: ${email}`);
  process.exit(1);
}

const env = readFileSync('.env', 'utf8');
const get = (k: string): string => {
  const m = env.match(new RegExp(`^${k}\\s*=\\s*"?([^"\\r\\n]+)"?`, 'm'));
  if (!m) throw new Error(`missing env ${k}`);
  return m[1];
};
const supabaseUrl = get('NEXT_PUBLIC_SUPABASE_URL');
const serviceKey = get('SUPABASE_SERVICE_ROLE_KEY');

const prisma = new PrismaClient();

async function main() {
  // 1. Local DB
  const user = await prisma.user.findUnique({
    where: { serviceNumber },
    select: { id: true, serviceNumber: true, fullName: true, email: true, role: true },
  });
  if (!user) {
    console.error(`No user with serviceNumber ${serviceNumber}`);
    process.exit(1);
  }
  console.log(`Found: ${user.serviceNumber}  ${user.fullName}  role=${user.role}  currentEmail=${user.email ?? '<null>'}`);

  // Safety: don't blindly overwrite an already-real email
  if (user.email && !user.email.includes('@biswic.invalid') && !user.email.includes('@biswic.coop')) {
    console.warn(`  WARNING: user already has a real email on file (${user.email}).`);
    console.warn(`  Use --force to overwrite.`);
    if (!process.argv.includes('--force')) {
      process.exit(2);
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { email },
  });
  console.log(`  local DB updated -> email=${email}`);

  // 2. auth.users
  const url = `${supabaseUrl}/auth/v1/admin/users/${user.id}`;
  const put = await fetch(url, {
    method: 'PUT',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, email_confirm: true }),
  });
  if (!put.ok) {
    const body = await put.text();
    console.error(`  auth.users update FAILED: status=${put.status} body=${body.slice(0, 300)}`);
    process.exit(1);
  }
  console.log(`  auth.users updated -> email=${email}`);

  // 3. Verify both
  const verifyLocal = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true },
  });
  const verifyAuth = await fetch(url, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  const authUser = verifyAuth.ok ? await verifyAuth.json() : null;
  console.log(`\n--- post-state ---`);
  console.log(`  local DB email:    ${verifyLocal?.email}`);
  console.log(`  auth.users email:  ${authUser?.email ?? '<unknown>'}`);
  console.log(`  in sync:           ${verifyLocal?.email === email && authUser?.email === email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
