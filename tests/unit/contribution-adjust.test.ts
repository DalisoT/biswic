/**
 * Unit tests for the rules that adjust a payment on the ledger: splitting a
 * lump across the months it covers, and voiding a row that was never a
 * payment.
 *
 * The rules decide whether a Treasurer can correct the ledger, so they are
 * verified here rather than trusted. In particular: a split must never move
 * money into a month before the member joined, must never create two
 * payments in one month, and must never lose or invent a cent.
 */

import { describe, it, expect } from 'vitest';
import {
  planContributionSplit,
  planContributionVoid,
  divideAmount,
  splitAllocations,
} from '../../src/lib/contribution-adjust';

const FOUNDING = { year: 2026, month: 7 };
const OCT = { year: 2026, month: 10 };
const SEP = { year: 2026, month: 9 };
const AUG = { year: 2026, month: 8 };

describe('planContributionSplit', () => {
  it('splits a K300 payment into three months of K100', () => {
    const plan = planContributionSplit({
      amount: 300,
      current: SEP,
      months: [AUG, SEP, OCT],
      firstLiable: FOUNDING,
      alreadyPaid: [],
    });
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(plan.shares).toEqual([
        { month: AUG, amount: 100 },
        { month: SEP, amount: 100 },
        { month: OCT, amount: 100 },
      ]);
    }
  });

  it('splits a K200 payment into two months of K100', () => {
    const plan = planContributionSplit({
      amount: 200,
      current: AUG,
      months: [AUG, SEP],
      firstLiable: FOUNDING,
      alreadyPaid: [],
    });
    expect(plan.ok).toBe(true);
    if (plan.ok) expect(plan.shares.map((s) => s.amount)).toEqual([100, 100]);
  });

  it('refuses a split into one month', () => {
    const plan = planContributionSplit({
      amount: 200,
      current: AUG,
      months: [AUG],
      firstLiable: FOUNDING,
      alreadyPaid: [],
    });
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.error).toContain('at least two months');
  });

  it('refuses a split that does not include the month it is booked against', () => {
    const plan = planContributionSplit({
      amount: 300,
      current: SEP,
      months: [AUG, OCT],
      firstLiable: FOUNDING,
      alreadyPaid: [],
    });
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.error).toContain('must be one of the months');
  });

  it('refuses a split that lists the same month twice', () => {
    const plan = planContributionSplit({
      amount: 300,
      current: SEP,
      months: [AUG, SEP, SEP],
      firstLiable: FOUNDING,
      alreadyPaid: [],
    });
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.error).toContain('listed twice');
  });

  it('refuses a split that does not divide evenly', () => {
    // K100 across three months is K33.33 each. Rounding it would make the
    // ledger disagree with the money, so the split is refused outright.
    const plan = planContributionSplit({
      amount: 100,
      current: SEP,
      months: [AUG, SEP, OCT],
      firstLiable: FOUNDING,
      alreadyPaid: [],
    });
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.error).toContain('does not divide evenly');
  });

  it('refuses a split covering a month before the member joined', () => {
    const plan = planContributionSplit({
      amount: 300,
      current: SEP,
      months: [{ year: 2026, month: 6 }, SEP, OCT],
      firstLiable: FOUNDING,
      alreadyPaid: [],
    });
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.error).toContain('before joining');
  });

  it('allows a split covering the exact month the member joined', () => {
    const plan = planContributionSplit({
      amount: 200,
      current: AUG,
      months: [FOUNDING, AUG],
      firstLiable: FOUNDING,
      alreadyPaid: [],
    });
    expect(plan.ok).toBe(true);
  });

  it('refuses a split onto a month the member has already paid', () => {
    const plan = planContributionSplit({
      amount: 300,
      current: SEP,
      months: [AUG, SEP, OCT],
      firstLiable: FOUNDING,
      alreadyPaid: [AUG],
    });
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.error).toContain('already has a payment booked');
  });

  it('does not count the month it is booked against as already paid', () => {
    const plan = planContributionSplit({
      amount: 300,
      current: SEP,
      months: [AUG, SEP, OCT],
      firstLiable: FOUNDING,
      alreadyPaid: [SEP],
    });
    expect(plan.ok).toBe(true);
  });
});

describe('divideAmount', () => {
  it('divides evenly', () => {
    expect(divideAmount(300, 3)).toEqual([100, 100, 100]);
    expect(divideAmount(200, 2)).toEqual([100, 100]);
  });

  it('always adds back up to the original amount', () => {
    for (const [amount, parts] of [[100, 3], [150, 4], [70, 3], [1, 3], [1000, 7]] as const) {
      const sum = divideAmount(amount, parts).reduce((s, v) => s + v, 0);
      expect(Number(sum.toFixed(2))).toBe(amount);
    }
  });

  it('keeps every part to whole cents', () => {
    for (const part of divideAmount(100, 3)) {
      expect(Number((part * 100).toFixed(4))).toBe(Number((Math.round(part * 100)).toFixed(4)));
    }
  });
});

describe('splitAllocations', () => {
  it('keeps each bucket\'s money in that bucket', () => {
    const allocations = [
      { bucketId: 'land', amount: 150 },
      { bucketId: 'business', amount: 60 },
      { bucketId: 'funeral', amount: 45 },
      { bucketId: 'admin', amount: 12 },
    ];
    const split = splitAllocations(allocations, 3);
    expect(split.map((s) => s.amounts)).toEqual([
      [50, 50, 50],
      [20, 20, 20],
      [15, 15, 15],
      [4, 4, 4],
    ]);
    for (const s of split) {
      expect(Number(s.amounts.reduce((a, b) => a + b, 0).toFixed(2))).toBe(
        allocations.find((a) => a.bucketId === s.bucketId)!.amount,
      );
    }
  });
});

describe('planContributionVoid', () => {
  it('accepts a void with a reason', () => {
    const plan = planContributionVoid({ otherPaymentCount: 2, reason: 'Never paid; row was created to unlock a login.' });
    expect(plan.ok).toBe(true);
  });

  it('refuses a void without a reason', () => {
    const plan = planContributionVoid({ otherPaymentCount: 2, reason: '  ' });
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.error).toContain('Give a reason');
  });

  it('warns when the void would lock the member out', () => {
    const plan = planContributionVoid({ otherPaymentCount: 0, reason: 'Never paid at all.' });
    expect(plan.ok).toBe(true);
    if (plan.ok) expect(plan.warning).toContain('lock them out');
  });
});
