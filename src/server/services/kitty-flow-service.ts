import { prisma } from '@/lib/db';

/**
 * Where the cooperative's money is.
 *
 * The kitty card shows what the cooperative holds right now. That is not the
 * same as what members have paid in: money spent on administration and money
 * lent out on soft loans has left the kitty, and the committee needs to be
 * able to say which is which.
 */
export interface MoneyFlow {
  /** Everything members have contributed since the cooperative opened. */
  collected: number;
  /** Money spent out of the Admin & Audit bucket, net of withdrawals. */
  adminSpent: number;
  /** Money out on soft loans: disbursed and not yet repaid. */
  lentOut: number;
}

export async function getMoneyFlow(): Promise<MoneyFlow> {
  const collectedAgg = await prisma.contribution.aggregate({ _sum: { amount: true } });
  const spending = await prisma.bucketTransaction.groupBy({
    by: ['type'],
    _sum: { amount: true },
  });
  const sumFor = (type: string) =>
    Number(spending.find((s) => s.type === type)?._sum.amount ?? 0);

  return {
    collected: Number(collectedAgg._sum.amount ?? 0),
    adminSpent: Math.abs(sumFor('ADMIN_EXPENSE') + sumFor('ADMIN_EXPENSE_VOID')),
    lentOut: Math.abs(sumFor('SOFT_LOAN_DISBURSEMENT') + sumFor('SOFT_LOAN_REPAYMENT')),
  };
}
