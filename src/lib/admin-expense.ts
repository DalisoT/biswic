/**
 * Administration expense rules (pure -- no database, no React).
 * -----------------------------------------------------------------------------
 * The Admin & Audit bucket holds 5% of every contribution. It is the money the
 * cooperative spends to run itself: stationery, transport to meetings, printing,
 * bank charges, audit fees.
 *
 * An expense is recorded against that bucket, so the bucket balance falls by
 * the amount spent and the cooperative's kitty falls with it. Without that the
 * kitty would keep growing while the money was quietly spent.
 *
 * No schema change is needed. The expense IS a row in the bucket ledger:
 *
 *   type 'ADMIN_EXPENSE'      a negative amount on the ADMIN bucket
 *   type 'ADMIN_EXPENSE_VOID'  the positive reversal when an expense is voided
 *
 * The void points back at the expense it reverses through referenceId, so a
 * voided expense can still be listed and explained.
 */

export const ADMIN_EXPENSE_TYPE = 'ADMIN_EXPENSE';
export const ADMIN_EXPENSE_VOID_TYPE = 'ADMIN_EXPENSE_VOID';

export const EXPENSE_CATEGORIES = [
  'Office & stationery',
  'Transport & meetings',
  'Printing & communication',
  'Bank & mobile money charges',
  'Audit, legal & registration',
  'Land & property costs',
  'Other',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export function isExpenseCategory(value: string): value is ExpenseCategory {
  return (EXPENSE_CATEGORIES as readonly string[]).includes(value);
}

export interface ExpenseEntry {
  id: string;
  /** Always positive: the amount spent. */
  amount: number;
  /** ISO date the money was spent (YYYY-MM-DD). */
  spentOn: string;
  category: string;
  description: string;
  payee: string | null;
  receiptNumber: string | null;
  recordedBy: string | null;
  /** True once the expense has been voided and the bucket credited back. */
  voided: boolean;
  voidReason: string | null;
}

export interface ExpenseSummary {
  /** Total spent in the period, ignoring voided expenses. */
  total: number;
  count: number;
  byCategory: Record<string, number>;
}

export interface ExpensePeriod {
  /** Inclusive ISO date, YYYY-MM-DD. */
  from?: string;
  /** Inclusive ISO date, YYYY-MM-DD. */
  to?: string;
}

export function expenseIsInPeriod(spentOn: string, period: ExpensePeriod): boolean {
  const day = spentOn.slice(0, 10);
  if (period.from && day < period.from) return false;
  if (period.to && day > period.to) return false;
  return true;
}

/**
 * Total the expenses in a period. Voided expenses count for nothing: the
 * money was credited back to the bucket, so it was never spent.
 */
export function summariseExpenses(
  entries: ExpenseEntry[],
  period: ExpensePeriod = {},
): ExpenseSummary {
  const summary: ExpenseSummary = { total: 0, count: 0, byCategory: {} };
  for (const e of entries) {
    if (e.voided) continue;
    if (!expenseIsInPeriod(e.spentOn, period)) continue;
    summary.total = Math.round((summary.total + e.amount) * 100) / 100;
    summary.count += 1;
    summary.byCategory[e.category] =
      Math.round(((summary.byCategory[e.category] ?? 0) + e.amount) * 100) / 100;
  }
  return summary;
}

/** The first and last day of a month, as ISO dates. */
export function monthPeriod(year: number, month: number): ExpensePeriod {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    from: year + '-' + String(month).padStart(2, '0') + '-01',
    to: year + '-' + String(month).padStart(2, '0') + '-' + String(last).padStart(2, '0'),
  };
}
