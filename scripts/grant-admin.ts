/* eslint-disable no-console */
/**
 * Grant or revoke the isAdmin override on a single user.
 *
 * Usage:
 *   npx tsx scripts/grant-admin.ts <serviceNumber>          # grant
 *   npx tsx scripts/grant-admin.ts <serviceNumber> --revoke  # revoke
 *
 * isAdmin is the global admin override (see migration 0010) -- it bypasses
 * every role-based permission check without changing the visible role label.
 * Used for the platform owner / developer. No in-app UI exposes this; the
 * script is the only way to flip the flag, so privilege escalation requires
 * repo + DB access.
 */
import { PrismaClient } from '@prisma/client';

const [, , serviceNumberArg, ...rest] = process.argv;
if (!serviceNumberArg) {
  console.error('Usage: npx tsx scripts/grant-admin.ts <serviceNumber> [--revoke]');
  process.exit(1);
}
const serviceNumber = serviceNumberArg.toUpperCase().trim();
const revoke = rest.includes('--revoke');

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { serviceNumber },
    select: { id: true, serviceNumber: true, fullName: true, role: true, isAdmin: true },
  });
  if (!user) {
    console.error(`No user with serviceNumber ${serviceNumber}`);
    process.exit(1);
  }

  console.log(`Found: ${user.serviceNumber}  ${user.fullName}  role=${user.role}  isAdmin=${user.isAdmin}`);

  const next = !revoke;
  if (user.isAdmin === next) {
    console.log(`  already in the requested state. Nothing to do.`);
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { isAdmin: next },
  });
  console.log(`  updated -> isAdmin=${next}`);

  console.log('\n--- post-state ---');
  const verify = await prisma.user.findUnique({
    where: { id: user.id },
    select: { isAdmin: true, role: true },
  });
  console.log(`  role=${verify?.role}  isAdmin=${verify?.isAdmin}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
