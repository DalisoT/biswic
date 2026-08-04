/**
 * July 2026 Contributions Backfill (one-shot)
 * ----------------------------------------------------------------------------
 * Does 5 things, all in a single Prisma transaction:
 *   0. CREATES the 6 buckets if they don't exist (Constitution Art. 4.1 mix).
 *      Idempotent - the seed (prisma/seed.ts) creates them too.
 *   1. WIPES the dev-seed contributions (756 rows = 63 members x 12 months)
 *      that prisma/seed.ts created as sample data. Also wipes the matching
 *      BucketTransaction ledger rows and resets every Bucket.balance to 0.
 *   2. PROMOTES 106147 SGT MWANSA M J to CHAIRPERSON (real Chairman, was
 *      the placeholder CHAIR-001 'Col. James Mwamba').
 *   3. PROMOTES 105152 SGT FOLOSHI T to VICE_CHAIRPERSON (real Vice, was
 *      the placeholder VICE-001 'Maj. Sylvia Banda'). The roll spelling is
 *      FWOLOSHI; user's list used FOLOSHI - same person, alternate spelling.
 *   4. RECORDS 43 contributions of K100 each for July 2026, payment method
 *      MOBILE_MONEY. The 4 unmatched names (MPHANDE G, SUCHILILA S, CHEWE J,
 *      MUTALE J) are NOT in this list - the user will add them via the
 *      in-app Add Member form after the founding lock is released.
 *
 * Usage:
 *   pnpm tsx scripts/july-2026-contributions.ts          # dry-run (default)
 *   pnpm tsx scripts/july-2026-contributions.ts --apply  # actually do it
 *
 * Idempotent: the wipe makes the recording idempotent. The 2 promotions
 * are safe to re-run (just sets the role to the same value).
 */

import { PrismaClient, type Prisma } from '@prisma/client';
import { allocateToBuckets, assertAllocationsSumExactly } from '../src/lib/buckets';
import { config } from '../src/lib/config';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

const MONTH = 7;
const YEAR = 2026;
const AMOUNT = 100;
const PAYMENT_METHOD = 'MOBILE_MONEY' as const;

// ----------------------------------------------------------------------------
// The 43 matched members from the 47-person paid list. Service numbers pulled
// from prisma/founding-members.ts and the officer placeholders being promoted.
// ----------------------------------------------------------------------------
const PAID_MEMBERS_SERVICE_NUMBERS: string[] = [
  // Officer promotions (currently MEMBERs in the roll, being promoted)
  '106147', // SGT MWANSA M J  -> real CHAIRPERSON
  '105152', // SGT FWOLOSHI T   -> real VICE_CHAIRPERSON (user wrote FOLOSHI T)
  // 41 roll members
  '106302', // SSgt NEEBA G
  '105638', // Sgt MAPOLISA A
  '106759', // Sgt TEMBO R (CCD)
  '104797', // Sgt BANDA S
  '104905', // Sgt CHANGWE M
  '104879', // Sgt CHANDA C
  '105079', // Sgt CHISHIMBA C
  '105370', // SSgt KASAMBO P
  '104760', // Sgt AKAPELWA A
  '104865', // SSgt CHAMA J
  '105257', // SSgt KAKOMA R
  '105358', // Cpl KAPITA S
  '106180', // Sgt MWANZA W
  '105725', // Sgt MOONO A
  '106481', // Sgt PHIRI L
  '106366', // Sgt NKANDU R
  '105046', // Sgt CHIRWA J
  '106691', // Sgt SINYANGWE K
  '106788', // Sgt YASINI J
  '105600', // Sgt MALISHENI A
  '106312', // Sgt NG'OMBE B
  '105242', // Sgt KAFULA R
  '104784', // Sgt BANDA L
  '105801', // Sgt MKOSHA J (user wrote MUKOSHA)
  '105716', // SSgt MKEMBA W
  '106593', // Sgt SIAME A
  '106108', // Sgt MWANDILA D
  '106324', // Sgt NGOMA C
  '106641', // Sgt SILUME K
  '105065', // Sgt CHISENGA A
  '106809', // Sgt ZULU E
  '106075', // Cpl MWALE K K (user wrote Sgt)
  '105346', // Cpl KAPANGE H
  '104914', // Sgt CHEWE D
  '106529', // Sgt SAKALA F
  '105399', // Sgt KASONTA L
  '105099', // Sgt CHIWALA T
  '105636', // Sgt NAMAFE M
  '104969', // Sgt CHILAMBE P
  '106633', // Sgt SIKUKA E
  '106288', // Sgt HATEMBO N
];

// Placeholder officer service numbers to deactivate
const PLACEHOLDERS_TO_DEACTIVATE = ['CHAIR-001', 'VICE-001'];

// Service numbers to promote
const CHAIR_REAL = '106147';
const VICE_CHAIR_REAL = '105152';

async function main() {
  console.log('=== July 2026 Contributions Backfill ===\n');
  console.log(`Mode: ${APPLY ? 'APPLY (will write to DB)' : 'DRY-RUN (no writes)'}\n`);

  // -------------------------------------------------------------------------
  // 0. Look up the Treasurer (TR-001) to set as recordedById
  // -------------------------------------------------------------------------
  const treasurer = await prisma.user.findUnique({
    where: { serviceNumber: 'TR-001' },
    select: { id: true, serviceNumber: true, fullName: true },
  });
  if (!treasurer) {
    throw new Error('Treasurer (TR-001) not found. Cannot record contributions without a Treasurer.');
  }
  console.log(`Recording as: ${treasurer.fullName} (${treasurer.serviceNumber})`);

  // -------------------------------------------------------------------------
  // 1. Verify all 43 members exist
  // -------------------------------------------------------------------------
  const members = await prisma.user.findMany({
    where: { serviceNumber: { in: PAID_MEMBERS_SERVICE_NUMBERS } },
    select: { id: true, serviceNumber: true, fullName: true, rank: true, isActive: true, isFoundingMember: true },
  });
  const foundServiceNumbers = new Set(members.map((m) => m.serviceNumber));
  const missing = PAID_MEMBERS_SERVICE_NUMBERS.filter((sn) => !foundServiceNumbers.has(sn));
  if (missing.length > 0) {
    throw new Error(`Missing service numbers: ${missing.join(', ')}`);
  }
  console.log(`\nFound all ${members.length} members to record payments for.`);

  // Sanity: ensure none are inactive or non-founding (founding members should all be active)
  const inactive = members.filter((m) => !m.isActive);
  if (inactive.length > 0) {
    console.warn(`WARNING: ${inactive.length} members are inactive:`, inactive.map((m) => m.serviceNumber).join(', '));
  }
  const nonFounding = members.filter((m) => !m.isFoundingMember);
  if (nonFounding.length > 0) {
    console.warn(`WARNING: ${nonFounding.length} members are not flagged as founding:`, nonFounding.map((m) => m.serviceNumber).join(', '));
  }

  // -------------------------------------------------------------------------
  // 2. Look up (or create) the 6 buckets. Constitution Art. 4.1: LAND 50% |
  //    BUSINESS 20% | FUNERAL 15% | SOFT_LOANS 8% | ADMIN 4% | MEDICAL 3%.
  //    The dev seed (prisma/seed.ts) creates them, but if the seed never ran
  //    (bootstrap-only deployment) we create them here.
  // -------------------------------------------------------------------------
  for (const [, b] of Object.entries(config.buckets)) {
    await prisma.bucket.upsert({
      where: { code: b.code },
      update: { name: b.name, percentage: b.percentage / 100 },
      create: {
        code: b.code,
        name: b.name,
        percentage: b.percentage / 100,
        description: `${b.percentage}% of every contribution allocated to this bucket`,
      },
    });
  }

  const buckets = await prisma.bucket.findMany({
    select: { id: true, code: true, percentage: true, balance: true },
    orderBy: { code: 'asc' },
  });
  if (buckets.length !== 6) {
    throw new Error(`Expected 6 buckets, found ${buckets.length}. Aborting.`);
  }
  const expectedPctSum = buckets.reduce((s, b) => s + Number(b.percentage), 0);
  if (Math.abs(expectedPctSum - 1) > 0.0001) {
    throw new Error(`Bucket percentages sum to ${expectedPctSum}, expected 1.0000. Aborting.`);
  }

  // Compute what the 43 contributions will allocate to each bucket
  const expectedAllocations = new Map<string, number>();
  for (const b of buckets) expectedAllocations.set(b.id, 0);

  const allocationInput = buckets.map((b) => ({
    bucketId: b.id,
    bucketCode: b.code,
    percentage: Number(b.percentage) * 100,
  }));

  // Preview one allocation to verify the math
  const previewAllocations = allocateToBuckets(AMOUNT, allocationInput);
  assertAllocationsSumExactly(AMOUNT, previewAllocations);
  console.log(`\nOne K100 contribution allocates to:`);
  for (const a of previewAllocations) {
    console.log(`  ${a.bucketCode.padEnd(12)} K${a.amount.toFixed(2)}`);
  }

  // Sum across 43 members
  for (let i = 0; i < 43; i++) {
    const allocs = allocateToBuckets(AMOUNT, allocationInput);
    for (const a of allocs) {
      expectedAllocations.set(a.bucketId, (expectedAllocations.get(a.bucketId) ?? 0) + a.amount);
    }
  }

  console.log(`\nExpected bucket balances after 43 contributions (K${AMOUNT * 43} total):`);
  for (const b of buckets) {
    const expected = expectedAllocations.get(b.id) ?? 0;
    console.log(`  ${b.code.padEnd(12)} K${expected.toFixed(2)} (currently K${Number(b.balance).toFixed(2)})`);
  }

  // -------------------------------------------------------------------------
  // 3. Count what we're about to wipe
  // -------------------------------------------------------------------------
  const contributionCount = await prisma.contribution.count();
  const bucketTxCount = await prisma.bucketTransaction.count({
    where: { referenceType: 'Contribution' },
  });
  console.log(`\nAbout to wipe:`);
  console.log(`  - ${contributionCount} Contribution rows (cascades BucketAllocation)`);
  console.log(`  - ${bucketTxCount} BucketTransaction rows where referenceType='Contribution'`);
  console.log(`  - Reset all 6 Bucket.balance fields to 0`);

  // -------------------------------------------------------------------------
  // 4. Check current roles of 106147, 105152, CHAIR-001, VICE-001
  // -------------------------------------------------------------------------
  const before = await prisma.user.findMany({
    where: { serviceNumber: { in: [CHAIR_REAL, VICE_CHAIR_REAL, ...PLACEHOLDERS_TO_DEACTIVATE] } },
    select: { serviceNumber: true, fullName: true, role: true, isActive: true },
  });
  console.log(`\nBefore promotions:`);
  for (const u of before) {
    console.log(`  ${u.serviceNumber.padEnd(12)} ${u.fullName.padEnd(25)} role=${u.role.padEnd(20)} isActive=${u.isActive}`);
  }

  if (!APPLY) {
    console.log(`\n*** DRY-RUN COMPLETE. Re-run with --apply to execute. ***`);
    return;
  }

  // -------------------------------------------------------------------------
  // 5. APPLY: do everything in a single transaction
  // -------------------------------------------------------------------------
  console.log(`\n>>> APPLYING (this is irreversible) <<<\n`);

  await prisma.$transaction(async (tx) => {
    // 5a. Wipe BucketTransaction rows that reference Contributions
    const txDel = await tx.bucketTransaction.deleteMany({
      where: { referenceType: 'Contribution' },
    });
    console.log(`  Deleted ${txDel.count} BucketTransaction rows`);

    // 5b. Wipe Contribution rows (cascades to BucketAllocation)
    const cDel = await tx.contribution.deleteMany({});
    console.log(`  Deleted ${cDel.count} Contribution rows`);

    // 5c. Reset Bucket balances to 0
    for (const b of buckets) {
      await tx.bucket.update({
        where: { id: b.id },
        data: { balance: 0 },
      });
    }
    console.log(`  Reset 6 Bucket.balance fields to 0`);

    // 5d. Promote 106147 to CHAIRPERSON
    const chairUpd = await tx.user.update({
      where: { serviceNumber: CHAIR_REAL },
      data: { role: 'CHAIRPERSON' },
    });
    console.log(`  Promoted ${chairUpd.serviceNumber} ${chairUpd.fullName} -> CHAIRPERSON`);

    // 5e. Promote 105152 to VICE_CHAIRPERSON
    const viceUpd = await tx.user.update({
      where: { serviceNumber: VICE_CHAIR_REAL },
      data: { role: 'VICE_CHAIRPERSON' },
    });
    console.log(`  Promoted ${viceUpd.serviceNumber} ${viceUpd.fullName} -> VICE_CHAIRPERSON`);

    // 5f. Deactivate placeholder CHAIR-001 and VICE-001
    for (const sn of PLACEHOLDERS_TO_DEACTIVATE) {
      const u = await tx.user.update({
        where: { serviceNumber: sn },
        data: { isActive: false },
      });
      console.log(`  Deactivated placeholder ${u.serviceNumber} ${u.fullName} (isActive=false)`);
    }

    // 5g. Record 43 July 2026 contributions
    const receivedAt = new Date(YEAR, MONTH - 1, 15); // July 15, 2026
    let count = 0;
    for (const member of members) {
      const allocs = allocateToBuckets(AMOUNT, allocationInput);
      assertAllocationsSumExactly(AMOUNT, allocs);

      const receiptNumber = `RCT-${YEAR}-${String(MONTH).padStart(2, '0')}-${member.id.slice(-6).toUpperCase()}`;

      const c = await tx.contribution.create({
        data: {
          memberId: member.id,
          amount: AMOUNT,
          month: MONTH,
          year: YEAR,
          paymentMethod: PAYMENT_METHOD,
          receiptNumber,
          receivedAt,
          recordedById: treasurer.id,
          allocations: {
            create: allocs.map((a) => ({
              bucketId: a.bucketId,
              amount: a.amount,
            })),
          },
        },
      });

      for (const a of allocs) {
        await tx.bucket.update({
          where: { id: a.bucketId },
          data: { balance: { increment: a.amount } },
        });
        await tx.bucketTransaction.create({
          data: {
            bucketId: a.bucketId,
            amount: a.amount,
            type: 'CONTRIBUTION_ALLOCATION',
            referenceType: 'Contribution',
            referenceId: c.id,
            recordedById: treasurer.id,
            note: `July 2026 contribution from ${member.serviceNumber} ${member.fullName}`,
          },
        });
      }
      count++;
    }
    console.log(`  Recorded ${count} July 2026 contributions (K${(AMOUNT * count).toFixed(2)} total)`);
  });

  // -------------------------------------------------------------------------
  // 6. Post-apply verification
  // -------------------------------------------------------------------------
  console.log(`\n=== Post-apply state ===\n`);

  const newContribCount = await prisma.contribution.count();
  console.log(`Total Contribution rows: ${newContribCount} (expected 43)`);

  const newBuckets = await prisma.bucket.findMany({
    select: { code: true, balance: true },
    orderBy: { code: 'asc' },
  });
  console.log(`\nBucket balances:`);
  for (const b of newBuckets) {
    const expected = expectedAllocations.get(buckets.find((x) => x.code === b.code)!.id) ?? 0;
    const actual = Number(b.balance);
    const ok = Math.abs(expected - actual) < 0.01 ? 'OK' : 'MISMATCH!';
    console.log(`  ${b.code.padEnd(12)} K${actual.toFixed(2).padStart(8)}  (expected K${expected.toFixed(2)})  ${ok}`);
  }

  const after = await prisma.user.findMany({
    where: { serviceNumber: { in: [CHAIR_REAL, VICE_CHAIR_REAL, ...PLACEHOLDERS_TO_DEACTIVATE] } },
    select: { serviceNumber: true, fullName: true, role: true, isActive: true },
  });
  console.log(`\nUser roles after:`);
  for (const u of after) {
    console.log(`  ${u.serviceNumber.padEnd(12)} ${u.fullName.padEnd(25)} role=${u.role.padEnd(20)} isActive=${u.isActive}`);
  }

  console.log(`\n=== DONE ===`);
}

main()
  .catch((e) => {
    console.error('FATAL:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
