'use server';

import { requireUser } from '@/lib/auth/require-user';
import { revalidatePath } from 'next/cache';
import { recordContribution, bulkRecordContributions } from '@/server/services/contribution-service';
import { canRecordContributions, canActAs } from '@/lib/permissions';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { logAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { config } from '@/lib/config';
import { formatDate, monthName } from '@/lib/utils';
import { firstLiableMonth } from '@/lib/contribution-report';
import { checkContributionMove } from '@/lib/contribution-move';
import {
  planContributionSplit,
  planContributionVoid,
  splitAllocations,
} from '@/lib/contribution-adjust';
import { formatMonthLabel, type MonthKey } from '@/lib/member-leaving';
import { createNotification, notifyAllMembers } from '@/server/actions/notifications';

const singleSchema = z.object({
  memberServiceNumber: z.string().min(1),
  amount: z.coerce.number().positive(),
  month: z.coerce.number().min(1).max(12),
  year: z.coerce.number().min(2020).max(2100),
  paymentMethod: z.enum(['PAYROLL_DEDUCTION', 'CASH', 'MOBILE_MONEY', 'BANK_TRANSFER']),
  receiptNumber: z.string().optional(),
  receivedAt: z.string().min(1),
});

/**
 * A member may only contribute for a month they were a member.
 *
 * The Treasurer's payroll list is typed on paper and resolved against the
 * live roster every month, so a service number carried on that list before
 * the member actually joined would otherwise be charged for months they were
 * never a member for. That happened in July and August 2026, and it made
 * three members look paid up when they were not.
 *
 * Returns an error message when the month is before the member joined, and
 * null when the contribution is fine.
 */
function joiningConflict(
  member: { isFoundingMember: boolean; joinedAt: Date },
  month: number,
  year: number,
): string | null {
  const first = firstLiableMonth(member);
  const before =
    first.year > year || (first.year === year && first.month > month);
  if (!before) return null;
  return (
    `Member joined in ${monthName(first.month)} ${first.year} and cannot ` +
    `contribute for ${monthName(month)} ${year} (before joining).`
  );
}

export async function addContributionAction(formData: FormData) {
  const user = await requireUser();

  if (!canActAs(user, canRecordContributions)) {
    return { error: 'You do not have permission to record contributions.' };
  }

  const parsed = singleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: 'Invalid input. ' + parsed.error.issues.map((i) => i.message).join(', ') };
  }

  const { memberServiceNumber, ...rest } = parsed.data;

  const member = await prisma.user.findUnique({
    where: { serviceNumber: memberServiceNumber.toUpperCase() },
  });

  if (!member) {
    return { error: `Member with service number ${memberServiceNumber} not found.` };
  }

  // A member cannot contribute for a month before they joined.
  const conflict = joiningConflict(member, rest.month, rest.year);
  if (conflict) {
    return { error: conflict };
  }

  try {
    await recordContribution({
      memberId: member.id,
      amount: rest.amount,
      month: rest.month,
      year: rest.year,
      paymentMethod: rest.paymentMethod,
      receiptNumber: rest.receiptNumber,
      receivedAt: new Date(rest.receivedAt),
      recordedById: user.id,
    });
  } catch (err: any) {
    return { error: err.message ?? 'Failed to record contribution.' };
  }

  // Notify the member that their contribution was recorded
  await createNotification({
    userId: member.id,
    type: 'CONTRIBUTION',
    title: 'Contribution recorded',
    body: `Your ${config.currency}${rest.amount} contribution for ${rest.month}/${rest.year} has been recorded.`,
    link: '/contributions',
  });

  revalidatePath('/contributions');
  revalidatePath('/dashboard');
  revalidatePath('/group');
  revalidatePath('/notifications');
  return { success: true };
}

// ----------------------------------------------------------------------------
// Monthly bulk import (payroll schedule friendly) -- the only bulk path
// ----------------------------------------------------------------------------
// Takes month+year+method+date ONCE at the top. CSV is just service_number
// (or service_number,amount) one per line. Default amount = monthly K100.
// Reports: imported count, already-paid SN, unknown SN, invalid rows.
//
// This replaces the old `bulkContributionsAction` (the awkward
// "service_number,amount,month,year" per-line format) which is now removed.
// ----------------------------------------------------------------------------

const payrollBulkSchema = z.object({
  month: z.coerce.number().min(1).max(12),
  year: z.coerce.number().min(2020).max(2100),
  paymentMethod: z.enum(['PAYROLL_DEDUCTION', 'CASH', 'MOBILE_MONEY', 'BANK_TRANSFER']),
  receivedAt: z.string().min(1),
  csv: z.string().min(1),
});

export type PayrollBulkResult = {
  error?: string;
  total?: number;
  imported?: number;
  skipped?: number;
  unknown?: string[];
  invalid?: string[];
  alreadyPaid?: string[];
};

export async function bulkImportPayrollAction(
  formData: FormData,
): Promise<PayrollBulkResult> {
  const user = await requireUser();
  if (!canActAs(user, canRecordContributions)) {
    return { error: 'Only the Treasurer, Deputy Treasurer, or Finance Warrant may import contributions.' };
  }

  const parsed = payrollBulkSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  }
  const { month, year, paymentMethod, receivedAt, csv } = parsed.data;

  // Parse: one entry per line. Format: service_number[,amount]
  const defaultAmount = config.monthlyContributionPerMember;
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'));

  const entries: { serviceNumber: string; amount: number; line: number }[] = [];
  const invalid: string[] = [];
  for (const [idx, line] of lines.entries()) {
    const parts = line.split(/[,\t]|\s{2,}/).map((p) => p.trim()).filter(Boolean);
    const serviceNumber = (parts[0] ?? '').toUpperCase();
    if (!serviceNumber) {
      invalid.push(`Line ${idx + 1}: missing service number`);
      continue;
    }
    const amount = parts[1] ? parseFloat(parts[1]) : defaultAmount;
    if (isNaN(amount) || amount <= 0 || amount > 10000) {
      invalid.push(`Line ${idx + 1} (${serviceNumber}): invalid amount "${parts[1]}"`);
      continue;
    }
    entries.push({ serviceNumber, amount, line: idx + 1 });
  }

  if (entries.length === 0) {
    return { error: 'No valid rows found.', invalid };
  }

  // Resolve service numbers -> user ids
  const users = await prisma.user.findMany({
    where: { serviceNumber: { in: entries.map((e) => e.serviceNumber) } },
    select: {
      id: true,
      serviceNumber: true,
      joinedAt: true,
      isFoundingMember: true,
    },
  });
  const userBySN = new Map(users.map((u) => [u.serviceNumber, u.id]));
  const memberBySN = new Map(users.map((u) => [u.serviceNumber, u]));
  const unknown = entries.filter((e) => !userBySN.has(e.serviceNumber)).map((e) => e.serviceNumber);

  // A member cannot contribute for a month before they joined. The payroll
  // list is typed on paper and resolved against the roster every month, so a
  // service number carried on it early would otherwise be charged for months
  // the member was never part of. Those rows are rejected and reported, not
  // silently imported.
  const joinsAfterMonth: string[] = [];
  for (const e of entries) {
    const m = memberBySN.get(e.serviceNumber);
    if (!m) continue;
    const conflict = joiningConflict(m, month, year);
    if (conflict) {
      invalid.push(`Line ${e.line} (${e.serviceNumber}): ${conflict}`);
      joinsAfterMonth.push(e.serviceNumber);
    }
  }
  const blocked = new Set(joinsAfterMonth);

  // Find which of these already paid this month
  const alreadyPaidRows = await prisma.contribution.findMany({
    where: {
      month,
      year,
      memberId: { in: users.map((u) => u.id) },
    },
    select: { memberId: true },
  });
  const alreadyPaidIds = new Set(alreadyPaidRows.map((r) => r.memberId));
  const alreadyPaid = entries
    .filter((e) => userBySN.has(e.serviceNumber) && alreadyPaidIds.has(userBySN.get(e.serviceNumber)!))
    .map((e) => e.serviceNumber);

  // Build the to-import list
  const toImport = entries.filter(
    (e) =>
      userBySN.has(e.serviceNumber) &&
      !alreadyPaidIds.has(userBySN.get(e.serviceNumber)!) &&
      !blocked.has(e.serviceNumber),
  );

  if (toImport.length === 0) {
    revalidatePath('/finance');
    revalidatePath('/finance/contributions');
    revalidatePath('/contributions');
    revalidatePath('/dashboard');
    return {
      total: entries.length,
      imported: 0,
      skipped: alreadyPaid.length,
      unknown,
      invalid,
      alreadyPaid,
    };
  }

  // Record each contribution. Per-contribution transactions are pgbouncer-safe.
  const result = await bulkRecordContributions(
    toImport.map((e) => ({
      memberId: userBySN.get(e.serviceNumber)!,
      amount: e.amount,
      month,
      year,
    })),
    user.id,
    paymentMethod,
    new Date(receivedAt),
  );

  await logAudit({
    userId: user.id,
    action: AUDIT_ACTIONS.CONTRIBUTION_RECORDED,
    entity: 'Contribution',
    notes: `Payroll bulk import ${year}-${String(month).padStart(2, '0')}: ${result.success} imported, ${alreadyPaid.length} already paid, ${unknown.length} unknown SN`,
  });

  // Live notifications: tell each member their contribution was recorded
  // (best-effort: failures here must not break the import)
  const monthLabel = new Date(year, month - 1, 1).toLocaleString('en', { month: 'long', year: 'numeric' });
  await Promise.all(
    toImport.map((e) =>
      createNotification({
        userId: userBySN.get(e.serviceNumber)!,
        type: 'CONTRIBUTION',
        title: 'Contribution recorded',
        body: `Your ${config.currency}${e.amount} contribution for ${monthLabel} has been recorded.`,
        link: '/contributions',
      }).catch((err) => console.error(`[notify] failed for ${e.serviceNumber}:`, err)),
    ),
  );

  revalidatePath('/finance');
  revalidatePath('/finance/contributions');
  revalidatePath('/contributions');
  revalidatePath('/dashboard');
  revalidatePath('/group');
  revalidatePath('/notifications');

  return {
    total: entries.length,
    imported: result.success,
    skipped: alreadyPaid.length,
    unknown,
    invalid,
    alreadyPaid,
  };
}

export type MonthlyContributionStats = {
  month: number;
  year: number;
  expected: number;
  received: number;
  payerCount: number;
  totalActiveMembers: number;
  payerRate: number;
  topDefaulters: { serviceNumber: string; fullName: string; rank: string | null }[];
};

export async function getMonthlyContributionStats(
  month: number = new Date().getMonth() + 1,
  year: number = new Date().getFullYear(),
): Promise<MonthlyContributionStats> {
  const activeMembers = await prisma.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      serviceNumber: true,
      fullName: true,
      rank: true,
      joinedAt: true,
      isFoundingMember: true,
    },
  });

  const startOfMonth = new Date(year, month - 1, 1);
  // A member is eligible to pay for (month, year) if they're a founding
  // member (the cooperative was registered with them on file, so they owe
  // from month 1) OR if they joined on or before the 1st of the current
  // month. Without the OR fallback, the seed's joinedAt (= seed run date)
  // would exclude all founding members and the dashboard would say
  // "everyone paid" even when no one has paid for the current month.
  const eligibleMembers = activeMembers.filter(
    (m) => m.isFoundingMember || new Date(m.joinedAt) <= startOfMonth,
  );

  const contributions = await prisma.contribution.findMany({
    where: { month, year },
    select: { memberId: true, amount: true },
  });
  const paidIds = new Set(contributions.map((c) => c.memberId));

  const defaulters = eligibleMembers
    .filter((m) => !paidIds.has(m.id))
    .slice(0, 10)
    .map((m) => ({
      serviceNumber: m.serviceNumber,
      fullName: m.fullName,
      rank: m.rank,
    }));

  const received = contributions.reduce((s, c) => s + Number(c.amount), 0);
  const expected = eligibleMembers.length * config.monthlyContributionPerMember;

  return {
    month,
    year,
    expected,
    received,
    payerCount: contributions.length,
    totalActiveMembers: eligibleMembers.length,
    payerRate: eligibleMembers.length > 0 ? contributions.length / eligibleMembers.length : 0,
    topDefaulters: defaulters,
  };
}


// ----------------------------------------------------------------------------
// Moving a payment to a different month
// ----------------------------------------------------------------------------
// A contribution is booked against the month it belongs to, not the month the
// money landed. Payroll is deducted late, mobile money is sent on the day the
// money arrives, and a receipt typed in by hand gets booked against the wrong
// month. On 1 and 2 November 2026 four members paid money that belongs to
// October 2026 and it was booked under November 2026, which left them showing
// as owing October.
//
// The row is updated in place. Only the period changes: the amount, the
// method, the date received, the receipt number and the bucket allocations
// are all left alone, and nothing is ever deleted.
// ----------------------------------------------------------------------------

const moveSchema = z.object({
  contributionId: z.string().uuid(),
  month: z.coerce.number().min(1).max(12),
  year: z.coerce.number().min(2020).max(2100),
});

export type MoveContributionResult =
  | { error: string }
  | { success: true; message: string };

export async function moveContributionAction(
  formData: FormData,
): Promise<MoveContributionResult> {
  const user = await requireUser();

  if (!canActAs(user, canRecordContributions)) {
    return { error: 'You do not have permission to move contributions.' };
  }

  const parsed = moveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      error: 'Invalid input. ' + parsed.error.issues.map((i) => i.message).join(', '),
    };
  }

  const { contributionId, month, year } = parsed.data;

  const contribution = await prisma.contribution.findUnique({
    where: { id: contributionId },
    include: {
      member: {
        select: {
          id: true,
          serviceNumber: true,
          fullName: true,
          joinedAt: true,
          isFoundingMember: true,
        },
      },
    },
  });
  if (!contribution) {
    return { error: 'That payment could not be found.' };
  }

  // The ledger allows one payment per member per month.
  const clash = await prisma.contribution.findFirst({
    where: {
      memberId: contribution.memberId,
      month,
      year,
      id: { not: contribution.id },
    },
    select: { id: true },
  });

  const check = checkContributionMove({
    current: { year: contribution.year, month: contribution.month },
    target: { year, month },
    firstLiable: firstLiableMonth(contribution.member),
    targetAlreadyPaid: !!clash,
  });
  if (!check.ok) {
    return { error: check.error };
  }

  const before = { year: contribution.year, month: contribution.month };
  const after = { year, month };

  try {
    await prisma.contribution.update({
      where: { id: contribution.id },
      data: { month, year },
    });
  } catch (err: any) {
    return { error: err.message ?? 'Failed to move the payment.' };
  }

  await logAudit({
    userId: user.id,
    action: AUDIT_ACTIONS.CONTRIBUTION_MOVED,
    entity: 'Contribution',
    entityId: contribution.id,
    beforeValue: before,
    afterValue: after,
    notes:
      'Payment of ' + config.currency + Number(contribution.amount) + ' for ' +
      contribution.member.fullName + ' (' + contribution.member.serviceNumber +
      ') moved from ' + formatMonthLabel(before) + ' to ' + formatMonthLabel(after) +
      '. The amount, method, date received and receipt number were not changed.',
  });

  // The member was told their payment was recorded for the old month, so
  // correct the record rather than leave the two contradicting each other.
  await createNotification({
    userId: contribution.memberId,
    type: 'CONTRIBUTION',
    title: 'Contribution period corrected',
    body:
      'Your ' + config.currency + Number(contribution.amount) +
      ' contribution received on ' + formatDate(contribution.receivedAt) +
      ' now stands for ' + formatMonthLabel(after) +
      ' (it was recorded under ' + formatMonthLabel(before) + ').',
    link: '/contributions',
  });

  revalidatePath('/finance/contributions');
  revalidatePath('/finance/contributions-report');
  revalidatePath('/finance');
  revalidatePath('/contributions');
  revalidatePath('/dashboard');
  revalidatePath('/group');
  revalidatePath('/notifications');

  return {
    success: true,
    message: 'Payment moved to ' + formatMonthLabel(after) + '.',
  };
}

// ----------------------------------------------------------------------------
// Splitting a payment across the months it covers
// ----------------------------------------------------------------------------
// A member pays a lump that covers several months. The arrears engine credits
// ONE month per contribution row, whatever the amount, so a K300 payment that
// covers three months only credits one of them and the member is shown as
// owing the other two.
//
// A split neither moves money nor re-allocates money. The payment stays where
// it is and gains the other months, the amount is divided evenly between
// them, and the bucket allocations are divided with it -- so a payment made
// before the FUNERAL and MEDICAL buckets were closed keeps its share of those
// buckets.
//
// The row booked against one month keeps that month; the other months get new
// rows with the same method, the same date received and no receipt number
// (one receipt, one payment, one row per month).
// ----------------------------------------------------------------------------

type BucketAllocationAmount = { bucketId: string; amount: number };

/**
 * Attach bucket allocations to a contribution, with the matching ledger rows.
 *
 * The balances are NOT moved here: a split moves no money between buckets, so
 * the balance only changes when the two sets of allocations differ. That is
 * netted once for the whole operation (see netBucketChange) rather than one
 * update per bucket per row, which keeps the transaction short enough for the
 * pooled database connection.
 */
async function setBucketAllocations(
  tx: Prisma.TransactionClient,
  args: {
    contributionId: string;
    allocations: BucketAllocationAmount[];
    recordedById: string;
    note: string;
  },
): Promise<void> {
  if (args.allocations.length === 0) return;
  await tx.bucketAllocation.createMany({
    data: args.allocations.map((a) => ({
      contributionId: args.contributionId,
      bucketId: a.bucketId,
      amount: a.amount,
    })),
  });
  await tx.bucketTransaction.createMany({
    data: args.allocations.map((a) => ({
      bucketId: a.bucketId,
      amount: a.amount,
      type: 'CONTRIBUTION_ALLOCATION',
      referenceType: 'Contribution',
      referenceId: args.contributionId,
      note: args.note,
      recordedById: args.recordedById,
    })),
  });
}

/** Take a contribution's bucket allocations and ledger rows off the books. */
async function clearBucketAllocations(
  tx: Prisma.TransactionClient,
  args: { contributionId: string },
): Promise<void> {
  await tx.bucketAllocation.deleteMany({
    where: { contributionId: args.contributionId },
  });
  await tx.bucketTransaction.deleteMany({
    where: { referenceType: 'Contribution', referenceId: args.contributionId },
  });
}

/**
 * The change each bucket's balance has to make.
 *
 * A split replaces one set of allocations with another: the money is in the
 * same buckets, so most of the time the net change is nothing at all and the
 * balance is left alone.
 */
function netBucketChange(
  previous: BucketAllocationAmount[],
  next: BucketAllocationAmount[],
): Map<string, number> {
  const deltas = new Map<string, number>();
  for (const p of previous) {
    deltas.set(p.bucketId, (deltas.get(p.bucketId) ?? 0) - p.amount);
  }
  for (const n of next) {
    deltas.set(n.bucketId, (deltas.get(n.bucketId) ?? 0) + n.amount);
  }
  for (const [bucketId, delta] of Array.from(deltas)) {
    if (Math.abs(delta) < 0.005) deltas.delete(bucketId);
  }
  return deltas;
}

/** Move the bucket balances by the net amount for each bucket. */
async function moveBucketBalances(
  tx: Prisma.TransactionClient,
  deltas: Map<string, number>,
): Promise<void> {
  for (const [bucketId, delta] of deltas) {
    await tx.bucket.update({
      where: { id: bucketId },
      data: { balance: { increment: delta } },
    });
  }
}

const splitSchema = z.object({
  contributionId: z.string().uuid(),
  reason: z.string().min(5),
});

const voidSchema = z.object({
  contributionId: z.string().uuid(),
  reason: z.string().min(5),
});

export type AdjustContributionResult =
  | { error: string }
  | { success: true; message: string; warning?: string };

/** "2026-8" -> { year: 2026, month: 8 }. */
const MONTH_VALUE = /^(\d{4})-(\d{1,2})$/;

function parseMonthValues(values: string[]): MonthKey[] | null {
  const out: MonthKey[] = [];
  for (const raw of values) {
    const m = MONTH_VALUE.exec(raw.trim());
    if (!m) return null;
    const year = Number(m[1]);
    const month = Number(m[2]);
    if (year < 2000 || year > 2100 || month < 1 || month > 12) return null;
    out.push({ year, month });
  }
  return out;
}

export async function splitContributionAction(
  formData: FormData,
): Promise<AdjustContributionResult> {
  const user = await requireUser();

  if (!canActAs(user, canRecordContributions)) {
    return { error: 'You do not have permission to split contributions.' };
  }

  const parsed = splitSchema.safeParse({
    contributionId: formData.get('contributionId'),
    reason: formData.get('reason'),
  });
  if (!parsed.success) {
    return {
      error: 'Invalid input. ' + parsed.error.issues.map((i) => i.message).join(', '),
    };
  }

  const months = parseMonthValues(formData.getAll('months').map(String));
  if (!months) {
    return { error: 'Invalid input: the months could not be read.' };
  }
  if (months.length < 2) {
    return {
      error:
        'Choose at least two months: the month this payment is booked against, ' +
        'and the month or months it also covers.',
    };
  }

  const contribution = await prisma.contribution.findUnique({
    where: { id: parsed.data.contributionId },
    include: {
      member: {
        select: {
          id: true,
          serviceNumber: true,
          fullName: true,
          joinedAt: true,
          isFoundingMember: true,
        },
      },
      allocations: true,
    },
  });
  if (!contribution) {
    return { error: 'That payment could not be found.' };
  }

  const memberPayments = await prisma.contribution.findMany({
    where: { memberId: contribution.memberId },
    select: { id: true, month: true, year: true },
  });

  const plan = planContributionSplit({
    amount: Number(contribution.amount),
    current: { year: contribution.year, month: contribution.month },
    months,
    firstLiable: firstLiableMonth(contribution.member),
    alreadyPaid: memberPayments.map((p) => ({ year: p.year, month: p.month })),
  });
  if (!plan.ok) {
    return { error: plan.error };
  }

  const amount = Number(contribution.amount);
  const originalAllocations: BucketAllocationAmount[] = contribution.allocations.map((a) => ({
    bucketId: a.bucketId,
    amount: Number(a.amount),
  }));
  const parts = splitAllocations(originalAllocations, plan.shares.length);

  // Share j's allocation for bucket i is parts[i].amounts[j]: each bucket's
  // money is divided by the same number of parts, so the money stays in the
  // buckets it was already in.
  const allocationsForShare = (j: number): BucketAllocationAmount[] =>
    contribution.allocations.map((a, i) => ({
      bucketId: a.bucketId,
      amount: parts[i]!.amounts[j]!,
    }));

  const note =
    'Split from a ' + config.currency + amount.toFixed(2) + ' payment covering ' +
    plan.shares.length + ' months.';

  const created: { id: string; month: number; year: number; amount: number }[] = [];

  try {
    await prisma.$transaction(
      async (tx) => {
        // The share each month gets, and the bucket allocations that go with
        // it: every bucket's money is divided by the same number of parts, so
        // the money stays in the buckets it was already in.
        const shareAllocations = plan.shares.map((_, j) => allocationsForShare(j));

        // One net movement for the whole operation. The shares add back to
        // the original allocation, so the balances usually do not move.
        await moveBucketBalances(
          tx,
          netBucketChange(originalAllocations, shareAllocations.flat()),
        );

        await clearBucketAllocations(tx, { contributionId: contribution.id });

        for (let j = 0; j < plan.shares.length; j++) {
          const share = plan.shares[j]!;
          // share.month is a MonthKey: the period this share covers.
          const { month: shareMonth, year: shareYear } = share.month;
          const allocations = shareAllocations[j]!;

          let rowId = contribution.id;
          if (shareYear === contribution.year && shareMonth === contribution.month) {
            // The month the payment is already booked against keeps the row.
            await tx.contribution.update({
              where: { id: contribution.id },
              data: { amount: share.amount },
            });
          } else {
            const row = await tx.contribution.create({
              data: {
                memberId: contribution.memberId,
                amount: share.amount,
                month: shareMonth,
                year: shareYear,
                paymentMethod: contribution.paymentMethod,
                // One receipt covers one payment. The split rows are the same
                // money seen month by month, so there is no second receipt.
                receiptNumber: null,
                receivedAt: contribution.receivedAt,
                recordedById: contribution.recordedById,
              },
            });
            rowId = row.id;
          }

          await setBucketAllocations(tx, {
            contributionId: rowId,
            allocations,
            recordedById: contribution.recordedById,
            note,
          });

          created.push({
            id: rowId,
            month: shareMonth,
            year: shareYear,
            amount: share.amount,
          });
        }
      },
      // The pooled database connection closes a transaction that runs too
      // long, and the split touches a dozen rows. Give it room.
      { maxWait: 15000, timeout: 30000 },
    );
  } catch (err: any) {
    return { error: err.message ?? 'Failed to split the payment.' };
  }

  const monthsLabel = plan.shares.map((s) => formatMonthLabel(s.month)).join(', ');

  await logAudit({
    userId: user.id,
    action: AUDIT_ACTIONS.CONTRIBUTION_SPLIT,
    entity: 'Contribution',
    entityId: contribution.id,
    beforeValue: {
      memberServiceNumber: contribution.member.serviceNumber,
      memberName: contribution.member.fullName,
      amount,
      month: contribution.month,
      year: contribution.year,
      paymentMethod: contribution.paymentMethod,
      receiptNumber: contribution.receiptNumber,
      receivedAt: contribution.receivedAt.toISOString(),
      allocations: originalAllocations,
    },
    afterValue: {
      reason: parsed.data.reason,
      shares: created,
    },
    notes:
      'Payment of ' + config.currency + amount.toFixed(2) + ' for ' +
      contribution.member.fullName + ' (' + contribution.member.serviceNumber +
      ') split across ' + monthsLabel + ' at ' +
      config.currency + plan.shares[0]!.amount.toFixed(2) + ' each. ' +
      'Reason: ' + parsed.data.reason,
  });

  await createNotification({
    userId: contribution.memberId,
    type: 'CONTRIBUTION',
    title: 'Contribution period corrected',
    body:
      'Your ' + config.currency + amount.toFixed(2) + ' contribution received on ' +
      formatDate(contribution.receivedAt) + ' now stands for ' + monthsLabel +
      ' (' + config.currency + plan.shares[0]!.amount.toFixed(2) + ' each).',
    link: '/contributions',
  });

  revalidatePath('/finance/contributions');
  revalidatePath('/finance/contributions-report');
  revalidatePath('/finance');
  revalidatePath('/contributions');
  revalidatePath('/dashboard');
  revalidatePath('/group');
  revalidatePath('/notifications');

  return {
    success: true,
    message:
      'Split across ' + monthsLabel + ' at ' +
      config.currency + plan.shares[0]!.amount.toFixed(2) + ' each.',
  };
}

// ----------------------------------------------------------------------------
// Voiding an entry that was never a payment
// ----------------------------------------------------------------------------
// The other kind of wrong row. Three rows for MWANSA JACOB were written by a
// script whose own header says they exist "so the login good standing gate
// will let him in". They are money that was never received.
//
// A void is the only operation on the ledger that takes a row away, so it
// demands a reason and it is written to the audit log with the whole row --
// amount, month, receipt and bucket allocations -- before it goes. The bucket
// allocations come off the buckets with it, so the balances stay true.
// ----------------------------------------------------------------------------

export async function voidContributionAction(
  formData: FormData,
): Promise<AdjustContributionResult> {
  const user = await requireUser();

  if (!canActAs(user, canRecordContributions)) {
    return { error: 'You do not have permission to void contributions.' };
  }

  const parsed = voidSchema.safeParse({
    contributionId: formData.get('contributionId'),
    reason: formData.get('reason'),
  });
  if (!parsed.success) {
    return {
      error: 'Invalid input. ' + parsed.error.issues.map((i) => i.message).join(', '),
    };
  }

  const confirmed = formData.get('confirm');
  if (confirmed !== 'on' && confirmed !== 'true' && confirmed !== 'yes') {
    return {
      error: 'Confirm that the entry was never a payment before voiding it.',
    };
  }

  const contribution = await prisma.contribution.findUnique({
    where: { id: parsed.data.contributionId },
    include: {
      member: {
        select: { id: true, serviceNumber: true, fullName: true },
      },
      allocations: true,
    },
  });
  if (!contribution) {
    return { error: 'That payment could not be found.' };
  }

  const otherPaymentCount = await prisma.contribution.count({
    where: { memberId: contribution.memberId, id: { not: contribution.id } },
  });

  const plan = planContributionVoid({
    otherPaymentCount,
    reason: parsed.data.reason,
  });
  if (!plan.ok) {
    return { error: plan.error };
  }

  const amount = Number(contribution.amount);
  const allocations: BucketAllocationAmount[] = contribution.allocations.map((a) => ({
    bucketId: a.bucketId,
    amount: Number(a.amount),
  }));

  try {
    await prisma.$transaction(
      async (tx) => {
        // The money goes back off the buckets it was added to.
        await moveBucketBalances(tx, netBucketChange(allocations, []));
        await clearBucketAllocations(tx, { contributionId: contribution.id });
        await tx.contribution.delete({ where: { id: contribution.id } });
      },
      { maxWait: 15000, timeout: 30000 },
    );
  } catch (err: any) {
    return { error: err.message ?? 'Failed to void the entry.' };
  }

  const period = formatMonthLabel({ year: contribution.year, month: contribution.month });

  await logAudit({
    userId: user.id,
    action: AUDIT_ACTIONS.CONTRIBUTION_VOIDED,
    entity: 'Contribution',
    entityId: contribution.id,
    beforeValue: {
      memberServiceNumber: contribution.member.serviceNumber,
      memberName: contribution.member.fullName,
      amount,
      month: contribution.month,
      year: contribution.year,
      paymentMethod: contribution.paymentMethod,
      receiptNumber: contribution.receiptNumber,
      receivedAt: contribution.receivedAt.toISOString(),
      allocations,
    },
    afterValue: {
      voided: true,
      reason: parsed.data.reason,
    },
    notes:
      'Entry of ' + config.currency + amount.toFixed(2) + ' for ' +
      contribution.member.fullName + ' (' + contribution.member.serviceNumber +
      ') booked against ' + period + ' was voided: it was never a payment ' +
      'received from the member, and the money has been taken back off the ' +
      'buckets it was added to. Reason: ' + parsed.data.reason,
  });

  await createNotification({
    userId: contribution.memberId,
    type: 'CONTRIBUTION',
    title: 'Ledger entry removed',
    body:
      'The entry of ' + config.currency + amount.toFixed(2) + ' recorded against ' +
      period + ' has been removed from the ledger because it was never a ' +
      'payment received from you. Reason: ' +
      (parsed.data.reason.length > 160
        ? parsed.data.reason.slice(0, 157) + '...'
        : parsed.data.reason),
    link: '/contributions',
  });

  revalidatePath('/finance/contributions');
  revalidatePath('/finance/contributions-report');
  revalidatePath('/finance');
  revalidatePath('/contributions');
  revalidatePath('/dashboard');
  revalidatePath('/group');
  revalidatePath('/notifications');

  return {
    success: true,
    message:
      'Entry of ' + config.currency + amount.toFixed(2) + ' for ' + period +
      ' removed from the ledger.',
    warning: plan.warning,
  };
}
