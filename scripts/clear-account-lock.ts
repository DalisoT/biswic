/* eslint-disable no-console */
/**
 * Clear a member's failed-login lock so they can sign in again immediately.
 *
 * Usage:
 *   npx tsx scripts/clear-account-lock.ts <serviceNumber>
 *
 * Resets User.failedLoginAttempts to 0 and User.lockedUntil to null.
 * Writes an AuditLog row noting the manual override.
 */
import { PrismaClient } from '@prisma/client';

const serviceNumberArg = process.argv[2];
if (!serviceNumberArg) {
  console.error('Usage: npx tsx scripts/clear-account-lock.ts <serviceNumber>');
  process.exit(1);
}
const serviceNumber = serviceNumberArg.toUpperCase().trim();

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { serviceNumber },
    select: {
      id: true,
      serviceNumber: true,
      fullName: true,
      failedLoginAttempts: true,
      lockedUntil: true,
    },
  });
  if (!user) {
    console.error(`No user with serviceNumber ${serviceNumber}`);
    process.exit(1);
  }

  console.log(`Before:`);
  console.log(`  ${user.serviceNumber}  ${user.fullName}`);
  console.log(`  failedLoginAttempts: ${user.failedLoginAttempts ?? 0}`);
  console.log(`  lockedUntil:         ${user.lockedUntil?.toISOString() ?? '<null>'}`);

  if ((user.failedLoginAttempts ?? 0) === 0 && !user.lockedUntil) {
    console.log(`\nNo lockout to clear. Nothing to do.`);
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });

  console.log(`\nLockout cleared. The member can try signing in again now.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
