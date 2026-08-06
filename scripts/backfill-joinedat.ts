/**
 * One-shot data fix: backfill `joinedAt` for founding members.
 *
 * The seed sets joinedAt = now() (the seed run timestamp) for everyone.
 * That's wrong for founding members: their joinedAt should be the date
 * they signed the founding register (foundingSignedAt, currently
 * 2026-07-22 for all 65). Without this backfill, the /finance defaulters
 * page and the contribution stats service treat founding members as
 * "joined this month" and skip them when computing who should have paid.
 *
 * Idempotent: only updates rows where joinedAt > foundingSignedAt.
 *
 * Usage:
 *   pnpm tsx scripts/backfill-joinedat.ts           # dry-run
 *   pnpm tsx scripts/backfill-joinedat.ts --apply   # actually update
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

async function main() {
  // Find all founding members with broken joinedAt
  const broken = await prisma.user.findMany({
    where: {
      isFoundingMember: true,
      foundingSignedAt: { not: null },
    },
    select: { serviceNumber: true, fullName: true, joinedAt: true, foundingSignedAt: true },
  });

  const targets = broken.filter(
    (u) => u.foundingSignedAt && u.joinedAt && u.joinedAt.getTime() !== u.foundingSignedAt.getTime(),
  );

  console.log(`Founding members with mismatched joinedAt: ${targets.length} of ${broken.length}`);
  if (targets.length === 0) {
    console.log('Nothing to fix.');
    await prisma.$disconnect();
    return;
  }
  console.log('\nSample (first 5):');
  for (const u of targets.slice(0, 5)) {
    console.log(`  ${u.serviceNumber}  ${u.fullName}`);
    console.log(`    current joinedAt       = ${u.joinedAt?.toISOString()}`);
    console.log(`    foundingSignedAt (new) = ${u.foundingSignedAt?.toISOString()}`);
  }

  if (!APPLY) {
    console.log('\n*** DRY-RUN. Re-run with --apply to commit. ***');
    await prisma.$disconnect();
    return;
  }

  console.log(`\n>>> APPLYING <<<`);

  // Use raw SQL for clarity (and to log row count)
  const result = await prisma.$executeRawUnsafe(
    `update public."User"
        set "joinedAt" = "foundingSignedAt"
      where "isFoundingMember" = true
        and "foundingSignedAt" is not null
        and "joinedAt" <> "foundingSignedAt"`,
  );
  console.log(`Updated ${result} rows.`);

  // Verify
  const remaining = await prisma.user.count({
    where: {
      isFoundingMember: true,
      foundingSignedAt: { not: null },
      NOT: { joinedAt: undefined },
    },
  });
  const stillBroken = await prisma.$queryRawUnsafe<any[]>(
    `select "serviceNumber", "joinedAt"::text, "foundingSignedAt"::text
       from public."User"
      where "isFoundingMember" = true
        and "foundingSignedAt" is not null
        and "joinedAt" <> "foundingSignedAt"
      limit 5`,
  );
  console.log(`\nVerification: ${stillBroken.length} rows still mismatched (should be 0).`);

  await prisma.$disconnect();
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
