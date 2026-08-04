/**
 * July 2026 Contributions Backfill (one-shot, resumable)
 * ----------------------------------------------------------------------------
 * Does 4 things:
 *   0. CREATES the 6 buckets if they don't exist (Constitution Art. 4.1 mix).
 *   1. PROMOTES 106147 SGT MWANSA M J to CHAIRPERSON (real Chairman, was
 *      the placeholder CHAIR-001 'Col. James Mwamba').
 *   2. PROMOTES 105152 SGT FOLOSHI T to VICE_CHAIRPERSON (real Vice, was
 *      the placeholder VICE-001 'Maj. Sylvia Banda'). The roll spelling is
 *      FWOLOSHI; user's list used FOLOSHI - same person, alternate spelling.
 *   3. RECORDS 43 contributions of K100 each for July 2026, payment method
 *      MOBILE_MONEY. The 4 unmatched names (MPHANDE G, SUCHILILA S, CHEWE J,
 *      MUTALE J) are NOT in this list - the user will add them via the
 *      in-app Add Member form after the founding lock is released.
 *
 * Designed to be RESUMABLE: if the script is killed mid-way, re-running it
 * skips already-recorded contributions (idempotent via the unique
 * (memberId, month, year) constraint) and the setup is fully idempotent.
 *
 * Usage:
 *   pnpm tsx scripts/july-2026-contributions.ts          # dry-run (default)
 *   pnpm tsx scripts/july-2026-contributions.ts --apply  # actually do it
 *
 * Why not one big transaction: 43 contributions * 13 queries = ~560
 * sequential queries against a remote DB (Supabase eu-central-1). That's
 * slow enough that a single transaction can time out. Splitting into
 * independent writes means a kill only loses the in-flight query, not
 * the whole batch.
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
  '106302', '105638', '106759', '104797', '104905', '104879', '105079',
  '105370', '104760', '104865', '105257', '105358', '106180', '105725',
  '106481', '106366', '105046', '106691', '106788', '105600', '106312',
  '105242', '104784', '105801', '105716', '106593', '106108', '106324',
  '106641', '105065', '106809', '106075', '105346', '104914', '106529',
  '105399', '105099', '105636', '104969', '106633', '106288',
];

const PLACEHOLDERS_TO_DEACTIVATE = ['CHAIR-001', 'VICE-001'];
const CHAIR_REAL = '106147';
const VICE_CHAIR_REAL = '105152';

async function ensureSetup() {
  // 0a. Create the 6 buckets (Constitution Art. 4.1)
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

  // 0b. Promote 106147 -> CHAIRPERSON
  await prisma.user.update({
    where: { serviceNumber: CHAIR_REAL },
    data: { role: 'CHAIRPERSON' },
  });

  // 0c. Promote 105152 -> VICE_CHAIRPERSON
  await prisma.user.update({
    where: { serviceNumber: VICE_CHAIR_REAL },
    data: { role: 'VICE_CHAIRPERSON' },
  });

  // 0d. Deactivate placeholders
  for (const sn of PLACEHOLDERS_TO_DEACTIVATE) {
    await prisma.user.update({
      where: { serviceNumber: sn },
      data: { isActive: false },
    });
  }
}

async function recordOneContribution(
  member: { id: string; serviceNumber: string; fullName: string },
  treasurerId: string,
  allocationInput: { bucketId: string; bucketCode: string; percentage: number }[],
): Promise<'recorded' | 'skipped'> {
  // Idempotency: skip if a July 2026 contribution already exists for this member
  const existing = await prisma.contribution.findUnique({
    where: { memberId_month_year: { memberId: member.id, month: MONTH, year: YEAR } },
  });
  if (existing) return 'skipped';

  const allocs = allocateToBuckets(AMOUNT, allocationInput);
  assertAllocationsSumExactly(AMOUNT, allocs);

  const receiptNumber = `RCT-${YEAR}-${String(MONTH).padStart(2, '0')}-${member.id.slice(-6).toUpperCase()}`;
  const receivedAt = new Date(YEAR, MONTH - 1, 15);

  const c = await prisma.contribution.create({
    data: {
      memberId: member.id,
      amount: AMOUNT,
      month: MONTH,
      year: YEAR,
      paymentMethod: PAYMENT_METHOD,
      receiptNumber,
      receivedAt,
      recordedById: treasurerId,
      allocations: {
        create: allocs.map((a) => ({ bucketId: a.bucketId, amount: a.amount })),
      },
    },
  });

  for (const a of allocs) {
    await prisma.bucket.update({
      where: { id: a.bucketId },
      data: { balance: { increment: a.amount } },
    });
    await prisma.bucketTransaction.create({
      data: {
        bucketId: a.bucketId,
        amount: a.amount,
        type: 'CONTRIBUTION_ALLOCATION',
        referenceType: 'Contribution',
        referenceId: c.id,
        recordedById: treasurerId,
        note: `July 2026 contribution from ${member.serviceNumber} ${member.fullName}`,
      },
    });
  }

  return 'recorded';
}

async function recomputeBucketBalances() {
  const buckets = await prisma.bucket.findMany({ select: { id: true, code: true } });
  for (const b of buckets) {
    const sum = await prisma.bucketTransaction.aggregate({
      where: { bucketId: b.id },
      _sum: { amount: true },
    });
    await prisma.bucket.update({
      where: { id: b.id },
      data: { balance: sum._sum.amount ?? 0 },
    });
  }
}

async function main() {
  console.log('=== July 2026 Contributions Backfill ===\n');
  console.log(`Mode: ${APPLY ? 'APPLY (will write to DB)' : 'DRY-RUN (no writes)'}\n`);

  // -------------------------------------------------------------------------
  // 1. Validate preconditions
  // -------------------------------------------------------------------------
  const treasurer = await prisma.user.findUnique({
    where: { serviceNumber: 'TR-001' },
    select: { id: true, serviceNumber: true, fullName: true },
  });
  if (!treasurer) {
    throw new Error('Treasurer (TR-001) not found.');
  }
  console.log(`Recording as: ${treasurer.fullName} (${treasurer.serviceNumber})`);

  const members = await prisma.user.findMany({
    where: { serviceNumber: { in: PAID_MEMBERS_SERVICE_NUMBERS } },
    select: { id: true, serviceNumber: true, fullName: true, isActive: true, isFoundingMember: true },
  });
  const foundServiceNumbers = new Set(members.map((m) => m.serviceNumber));
  const missing = PAID_MEMBERS_SERVICE_NUMBERS.filter((sn) => !foundServiceNumbers.has(sn));
  if (missing.length > 0) {
    throw new Error(`Missing service numbers: ${missing.join(', ')}`);
  }
  console.log(`Found all ${members.length} members to record payments for.`);

  // -------------------------------------------------------------------------
  // 2. Run setup to make sure buckets + promotions are in place
  // -------------------------------------------------------------------------
  // Create the 6 buckets (idempotent)
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

  const allocationInput = buckets.map((b) => ({
    bucketId: b.id,
    bucketCode: b.code,
    percentage: Number(b.percentage) * 100,
  }));

  // Show allocation preview
  const previewAllocations = allocateToBuckets(AMOUNT, allocationInput);
  assertAllocationsSumExactly(AMOUNT, previewAllocations);
  console.log(`\nOne K100 contribution allocates to:`);
  for (const a of previewAllocations) {
    console.log(`  ${a.bucketCode.padEnd(12)} K${a.amount.toFixed(2)}`);
  }

  // -------------------------------------------------------------------------
  // 3. Check current state of contributions (how many are already there)
  // -------------------------------------------------------------------------
  const existingContribCount = await prisma.contribution.count({
    where: { month: MONTH, year: YEAR },
  });
  console.log(`\n${existingContribCount} of ${members.length} July 2026 contributions already exist.`);
  console.log(`${members.length - existingContribCount} still to record.`);

  // -------------------------------------------------------------------------
  // 4. Show "before" state of the 4 affected users
  // -------------------------------------------------------------------------
  const before = await prisma.user.findMany({
    where: { serviceNumber: { in: [CHAIR_REAL, VICE_CHAIR_REAL, ...PLACEHOLDERS_TO_DEACTIVATE] } },
    select: { serviceNumber: true, fullName: true, role: true, isActive: true },
  });
  console.log(`\nBefore:`);
  for (const u of before) {
    console.log(`  ${u.serviceNumber.padEnd(12)} ${u.fullName.padEnd(25)} role=${u.role.padEnd(20)} isActive=${u.isActive}`);
  }

  if (!APPLY) {
    console.log(`\n*** DRY-RUN COMPLETE. Re-run with --apply to execute. ***`);
    return;
  }

  // -------------------------------------------------------------------------
  // 5. APPLY: run setup, then record 43 contributions
  // -------------------------------------------------------------------------
  console.log(`\n>>> APPLYING <<<\n`);

  console.log('Phase 1: setup (buckets + promotions + deactivations)...');
  await ensureSetup();
  console.log('  Buckets ensured, 106147 -> CHAIRPERSON, 105152 -> VICE_CHAIRPERSON, placeholders deactivated.');

  console.log(`\nPhase 2: record ${members.length} July 2026 contributions (one at a time, resumable)...`);
  let recorded = 0;
  let skipped = 0;
  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    process.stdout.write(`  [${String(i + 1).padStart(2, ' ')}/${members.length}] ${member.serviceNumber} ${member.fullName.padEnd(20)} ... `);
    try {
      const result = await recordOneContribution(member, treasurer.id, allocationInput);
      if (result === 'recorded') {
        recorded++;
        console.log('OK');
      } else {
        skipped++;
        console.log('skipped (already exists)');
      }
    } catch (e: any) {
      console.log(`FAILED: ${e.message}`);
      throw e;
    }
  }
  console.log(`  Recorded ${recorded}, skipped ${skipped}.`);

  console.log(`\nPhase 3: recompute bucket balances from ledger (safety net)...`);
  await recomputeBucketBalances();

  // -------------------------------------------------------------------------
  // 6. Post-apply verification
  // -------------------------------------------------------------------------
  console.log(`\n=== Post-apply state ===\n`);

  const newContribCount = await prisma.contribution.count({
    where: { month: MONTH, year: YEAR },
  });
  console.log(`July 2026 contributions: ${newContribCount} (expected ${members.length})`);

  const newBuckets = await prisma.bucket.findMany({
    select: { code: true, balance: true },
    orderBy: { code: 'asc' },
  });
  console.log(`\nBucket balances (expected K${AMOUNT * members.length} total):`);
  let totalActual = 0;
  for (const b of newBuckets) {
    const expected = AMOUNT * members.length * previewAllocations.find((a) => a.bucketCode === b.code)!.amount / 100;
    const actual = Number(b.balance);
    totalActual += actual;
    const ok = Math.abs(expected - actual) < 0.01 ? 'OK' : 'MISMATCH!';
    console.log(`  ${b.code.padEnd(12)} K${actual.toFixed(2).padStart(8)}  (expected K${expected.toFixed(2)})  ${ok}`);
  }
  console.log(`  ${'TOTAL'.padEnd(12)} K${totalActual.toFixed(2)}`);

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
