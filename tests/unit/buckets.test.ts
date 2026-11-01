/**
 * Unit tests for the SACRED bucket allocation rule (S1).
 * "Every contribution MUST be split exactly into the active buckets per
 *  percentages. Total of allocations MUST equal the contribution amount
 *  exactly."
 *
 * GM vote 2026-10-12: FUNERAL and MEDICAL buckets were closed and the freed
 * 18% rebalanced into LAND +10, SOFT_LOANS +7, ADMIN +1. The active split is
 * now 60 / 20 / 15 / 5 across four buckets.
 */

import { describe, it, expect } from 'vitest';
import { allocateToBuckets, assertAllocationsSumExactly } from '../../src/lib/buckets';
import { config } from '../../src/lib/config';

const ALL_BUCKETS = Object.values(config.buckets).map((b) => ({
  bucketId: `bucket_${b.code}`,
  bucketCode: b.code,
  percentage: b.percentage,
}));

describe('allocateToBuckets', () => {
  it('allocates K100 contribution exactly per the percentages', () => {
    const result = allocateToBuckets(100, ALL_BUCKETS);
    const allocations = Object.fromEntries(result.map((r) => [r.bucketCode, r.amount]));

    expect(allocations.LAND).toBe(60);
    expect(allocations.BUSINESS).toBe(20);
    expect(allocations.SOFT_LOANS).toBe(15);
    expect(allocations.ADMIN).toBe(5);
  });

  it('sums exactly to the contribution amount', () => {
    const amounts = [100, 50, 200, 333, 99.99, 1000, 12345.67];
    for (const amount of amounts) {
      const result = allocateToBuckets(amount, ALL_BUCKETS);
      assertAllocationsSumExactly(amount, result);
      const sum = result.reduce((s, a) => s + a.amount, 0);
      expect(Number(sum.toFixed(2))).toBe(Number(amount.toFixed(2)));
    }
  });

  it('handles tricky amounts that produce rounding errors', () => {
    // 33.33 / 100 * 60 = 19.998 (rounds to 20.00)
    const result = allocateToBuckets(33.33, ALL_BUCKETS);
    assertAllocationsSumExactly(33.33, result);
  });

  it('handles 0 contribution', () => {
    const result = allocateToBuckets(0, ALL_BUCKETS);
    assertAllocationsSumExactly(0, result);
    for (const r of result) {
      expect(r.amount).toBe(0);
    }
  });

  it('produces 4 allocations', () => {
    const result = allocateToBuckets(100, ALL_BUCKETS);
    expect(result).toHaveLength(4);
  });

  it('never allocates to the closed FUNERAL or MEDICAL buckets', () => {
    const result = allocateToBuckets(100, ALL_BUCKETS);
    const codes = result.map((r) => r.bucketCode);
    expect(codes).not.toContain('FUNERAL');
    expect(codes).not.toContain('MEDICAL');
  });

  it('throws if allocations do not sum exactly (safety net)', () => {
    const fake = [
      { bucketId: '1', bucketCode: 'A', amount: 50 },
      { bucketId: '2', bucketCode: 'B', amount: 50 },
    ];
    expect(() => assertAllocationsSumExactly(100, fake)).not.toThrow();
    expect(() => assertAllocationsSumExactly(101, fake)).toThrow(/Bucket allocation mismatch/);
  });
});

describe('config invariants', () => {
  it('bucket percentages sum to 100', () => {
    const total = Object.values(config.buckets).reduce((s, b) => s + b.percentage, 0);
    expect(total).toBe(100);
  });

  it('has exactly 4 active buckets', () => {
    expect(Object.keys(config.buckets)).toHaveLength(4);
  });

  it('has the GM-approved 60/20/15/5 split', () => {
    const byCode = Object.fromEntries(
      Object.values(config.buckets).map((b) => [b.code, b.percentage]),
    );
    expect(byCode).toEqual({ LAND: 60, BUSINESS: 20, SOFT_LOANS: 15, ADMIN: 5 });
  });

  it('bucket codes are unique', () => {
    const codes = Object.values(config.buckets).map((b) => b.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('has a flat funeral cap with no initial period', () => {
    // The cooperative was founded on 22 July 2026 and has no expected end
    // date, so there is no "initial period" to cap and no Year 1-2 vs
    // Year 3+ split: the funeral cap is a single flat rule. The chair
    // confirmed this on 2026-11-01.
    expect(Object.keys(config.welfareCaps.funeral).sort()).toEqual([
      'amountPerEvent',
      'disabled',
      'maxPerYear',
    ]);
  });
});
