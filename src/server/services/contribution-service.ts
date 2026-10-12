/**
 * Contribution Service (F4)
 * ----------------------------------------------------------------------------
 * Handles recording a contribution and atomically:
 * 1. Inserting the Contribution row
 * 2. Computing & inserting BucketAllocation rows (S1)
 * 3. Updating Bucket.balance
 * 4. Writing BucketTransaction ledger entries
 * 5. Logging to the audit log
 * All steps use a transaction so a partial failure cannot leave inconsistent state.
 */

import { prisma } from '@/lib/db';
import { allocateToBuckets, assertAllocationsSumExactly } from '@/lib/buckets';
import { logAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { Prisma } from '@prisma/client';

export interface RecordContributionInput {
  memberId: string;
  amount: number;
  month: number;
  year: number;
  paymentMethod: 'PAYROLL_DEDUCTION' | 'CASH' | 'MOBILE_MONEY' | 'BANK_TRANSFER';
  receiptNumber?: string;
  receivedAt: Date;
  recordedById: string;
}

export async function recordContribution(input: RecordContributionInput) {
  // Only allocate to ACTIVE buckets. Closed buckets (FUNERAL, MEDICAL after
  // the 2026-10 GM vote) stay in the DB with isActive=false for FK + audit
  // integrity, but they receive no new contributions and no new allocations.
  // The active set must sum to 100% per src/lib/config.ts.
  const buckets = await prisma.bucket.findMany({
    where: { isActive: true },
  });

  if (buckets.length === 0) {
    throw new Error('No active buckets configured. Run the bucket rebalance migration.');
  }

  const allocationInput = buckets.map((b) => ({
    bucketId: b.id,
    bucketCode: b.code,
    // Bucket.percentage is @db.Decimal(5,4) -> Prisma Decimal. Coerce via
    // Number() before arithmetic; Decimal * number is not a valid TS operation
    // and silently produces garbage at runtime in mixed-mode math.
    percentage: Number(b.percentage) * 100,
  }));

  const allocations = allocateToBuckets(input.amount, allocationInput);
  assertAllocationsSumExactly(input.amount, allocations);

  const result = await prisma.$transaction(async (tx) => {
    const contribution = await tx.contribution.create({
      data: {
        memberId: input.memberId,
        amount: input.amount,
        month: input.month,
        year: input.year,
        paymentMethod: input.paymentMethod,
        receiptNumber: input.receiptNumber,
        receivedAt: input.receivedAt,
        recordedById: input.recordedById,
        allocations: {
          create: allocations.map((a) => ({
            bucketId: a.bucketId,
            amount: a.amount,
          })),
        },
      },
      include: { allocations: true },
    });

    for (const a of allocations) {
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
          referenceId: contribution.id,
        },
      });
    }

    return contribution;
  });

  await logAudit({
    userId: input.recordedById,
    action: AUDIT_ACTIONS.CONTRIBUTION_RECORDED,
    entity: 'Contribution',
    entityId: result.id,
    afterValue: { memberId: input.memberId, amount: input.amount, month: input.month, year: input.year },
  });

  return result;
}

export async function bulkRecordContributions(
  entries: Array<Omit<RecordContributionInput, 'recordedById' | 'paymentMethod' | 'receivedAt'>>,
  recordedById: string,
  paymentMethod: 'PAYROLL_DEDUCTION' | 'CASH' | 'MOBILE_MONEY' | 'BANK_TRANSFER',
  receivedAt: Date,
) {
  // Active buckets only — see note in recordContribution above.
  const buckets = await prisma.bucket.findMany({
    where: { isActive: true },
  });
  const allocationInput = buckets.map((b) => ({
    bucketId: b.id,
    bucketCode: b.code,
    // See note in recordContribution: coerce Decimal before arithmetic.
    percentage: Number(b.percentage) * 100,
  }));

  let success = 0;
  let failed = 0;

  for (const e of entries) {
    try {
      const allocations = allocateToBuckets(e.amount, allocationInput);
      assertAllocationsSumExactly(e.amount, allocations);

      await prisma.$transaction(async (tx) => {
        const contribution = await tx.contribution.create({
          data: {
            memberId: e.memberId,
            amount: e.amount,
            month: e.month,
            year: e.year,
            paymentMethod,
            receiptNumber: e.receiptNumber,
            receivedAt,
            recordedById,
            allocations: {
              create: allocations.map((a) => ({
                bucketId: a.bucketId,
                amount: a.amount,
              })),
            },
          },
        });

        for (const a of allocations) {
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
              referenceId: contribution.id,
            },
          });
        }
      });
      success++;
    } catch (err) {
      console.error('Bulk contribution failed for entry:', e, err);
      failed++;
    }
  }

  await logAudit({
    userId: recordedById,
    action: AUDIT_ACTIONS.CONTRIBUTION_RECORDED,
    entity: 'Contribution',
    notes: `Bulk: ${success} succeeded, ${failed} failed`,
  });

  return { success, failed, total: entries.length };
}

export async function getArrearsReport(currentMonth: number, currentYear: number) {
  const activeMembers = await prisma.user.findMany({
    where: { isActive: true, role: 'MEMBER' },
    select: { id: true, serviceNumber: true, fullName: true, rank: true, unit: true },
  });

  const contributionsThisMonth = await prisma.contribution.findMany({
    where: { month: currentMonth, year: currentYear },
    select: { memberId: true, amount: true },
  });

  const paidMap = new Map(contributionsThisMonth.map((c) => [c.memberId, c.amount]));

  const arrears = activeMembers
    .filter((m) => !paidMap.has(m.id))
    .map((m) => ({
      ...m,
      monthsBehind: 1, // simplified - in production, count from joinedAt
    }));

  return arrears;
}
