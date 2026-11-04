import { describe, it, expect } from 'vitest';
import {
  summariseExpenses,
  expenseIsInPeriod,
  monthPeriod,
  isExpenseCategory,
  EXPENSE_CATEGORIES,
  type ExpenseEntry,
} from '../../src/lib/admin-expense';

function entry(over: Partial<ExpenseEntry> = {}): ExpenseEntry {
  return {
    id: 'tx-1',
    amount: 100,
    spentOn: '2026-11-03',
    category: 'Office & stationery',
    description: 'Paper and pens',
    payee: null,
    receiptNumber: null,
    recordedBy: '106759',
    voided: false,
    voidReason: null,
    ...over,
  };
}

describe('summariseExpenses', () => {
  it('totals the expenses in a period', () => {
    const entries = [
      entry({ id: 'a', amount: 50, spentOn: '2026-11-02' }),
      entry({ id: 'b', amount: 25, spentOn: '2026-11-20' }),
      entry({ id: 'c', amount: 999, spentOn: '2026-10-31' }),
    ];
    const summary = summariseExpenses(entries, monthPeriod(2026, 11));
    expect(summary.total).toBe(75);
    expect(summary.count).toBe(2);
  });

  it('ignores a voided expense', () => {
    const entries = [
      entry({ id: 'a', amount: 50 }),
      entry({ id: 'b', amount: 70, voided: true, voidReason: 'Entered twice' }),
    ];
    const summary = summariseExpenses(entries);
    expect(summary.total).toBe(50);
    expect(summary.count).toBe(1);
  });

  it('breaks the total down by category', () => {
    const entries = [
      entry({ id: 'a', amount: 50, category: 'Office & stationery' }),
      entry({ id: 'b', amount: 30, category: 'Office & stationery' }),
      entry({ id: 'c', amount: 20, category: 'Transport & meetings' }),
    ];
    const summary = summariseExpenses(entries);
    expect(summary.byCategory['Office & stationery']).toBe(80);
    expect(summary.byCategory['Transport & meetings']).toBe(20);
  });

  it('totals everything when no period is given', () => {
    const summary = summariseExpenses([entry({ amount: 40 }), entry({ amount: 60 })]);
    expect(summary.total).toBe(100);
    expect(summary.count).toBe(2);
  });
});

describe('expenseIsInPeriod', () => {
  it('includes both ends of the period', () => {
    const period = monthPeriod(2026, 11);
    expect(expenseIsInPeriod('2026-11-01', period)).toBe(true);
    expect(expenseIsInPeriod('2026-11-30', period)).toBe(true);
    expect(expenseIsInPeriod('2026-10-31', period)).toBe(false);
    expect(expenseIsInPeriod('2026-12-01', period)).toBe(false);
  });
});

describe('monthPeriod', () => {
  it('covers a 30 day month', () => {
    expect(monthPeriod(2026, 11)).toEqual({ from: '2026-11-01', to: '2026-11-30' });
  });

  it('covers a 31 day month', () => {
    expect(monthPeriod(2026, 12)).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });

  it('covers a leap February', () => {
    expect(monthPeriod(2028, 2)).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });
});

describe('isExpenseCategory', () => {
  it('accepts the known categories', () => {
    for (const c of EXPENSE_CATEGORIES) {
      expect(isExpenseCategory(c)).toBe(true);
    }
  });

  it('rejects anything else', () => {
    expect(isExpenseCategory('Bribes')).toBe(false);
  });
});
