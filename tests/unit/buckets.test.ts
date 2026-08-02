/**
 * Unit tests for the SACRED bucket allocation rule (S1).
 * "Every contribution MUST be split exactly into the 6 buckets per percentages.
 *  Total of allocations MUST equal the contribution amount exactly."
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

    expect(allocations.LAND).toBe(50);
    expect(allocations.BUSINESS).toBe(20);
    expect(allocations.FUNERAL).toBe(15);
    expect(allocations.MEDICAL).toBe(8);
    expect(allocations.ADMIN).toBe(4);
    expect(allocations.EDUCATION).toBe(3);
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
    // 33.33 / 100 * 50 = 16.665 (rounds to 16.67)
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

  it('produces 6 allocations', () => {
    const result = allocateToBuckets(100, ALL_BUCKETS);
    expect(result).toHaveLength(6);
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

  it('has exactly 6 buckets', () => {
    expect(Object.keys(config.buckets)).toHaveLength(6);
  });

  it('bucket codes are unique', () => {
    const codes = Object.values(config.buckets).map((b) => b.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe('isInInitialPeriod', () => {
  it('is true within the first 24 months', async () => {
    const { isInInitialPeriod } = await import('../../src/lib/config');
    const start = config.cooperativeStartDate;
    const sixMonthsLater = new Date(start);
    sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);
    expect(isInInitialPeriod(sixMonthsLater)).toBe(true);
  });

  it('is false after 24 months', async () => {
    const { isInInitialPeriod } = await import('../../src/lib/config');
    const start = config.cooperativeStartDate;
    const farFuture = new Date(start);
    farFuture.setMonth(farFuture.getMonth() + 30);
    expect(isInInitialPeriod(farFuture)).toBe(false);
  });
});
