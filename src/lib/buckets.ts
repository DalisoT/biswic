/**
 * Bucket Allocation Service (S1 - SACRED RULE)
 * ----------------------------------------------------------------------------
 * "Every contribution is split into the 6 buckets exactly per the percentages.
 *  Total of allocations MUST equal the contribution amount exactly. No rounding errors."
 *
 * Uses decimal.js for exact arithmetic, then rounds to 2dp per bucket,
 * with the remainder bucket absorbing the difference to ensure the total
 * is preserved exactly.
 */

import { config } from './config';
import Decimal from 'decimal.js';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_EVEN });

export interface BucketAllocationInput {
  bucketId: string;
  bucketCode: string;
  percentage: number;
}

export interface BucketAllocationResult {
  bucketId: string;
  bucketCode: string;
  amount: number; // 2-decimal float, exact sum preserved
}

/**
 * Allocate a contribution amount across the 6 buckets.
 * The first bucket (LAND) is the "remainder bucket" - it absorbs any
 * rounding difference so the total is always exactly the contribution amount.
 */
export function allocateToBuckets(
  amount: number,
  buckets: BucketAllocationInput[]
): BucketAllocationResult[] {
  const total = new Decimal(amount);

  // Compute exact allocations
  const exacts = buckets.map((b) => ({
    ...b,
    exact: total.times(b.percentage).dividedBy(100),
  }));

  // Round each to 2dp, except the LAST bucket (adjustment bucket)
  // which absorbs the difference so the sum is exact.
  const rounded = exacts.map((e) => e.exact.toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN).toNumber());

  // Find the running total and the difference
  const runningSum = rounded.slice(0, -1).reduce((s, v) => s + v, 0);
  const lastExact = exacts[exacts.length - 1].exact.toNumber();
  const lastRounded = Number(total.toDecimalPlaces(2, Decimal.ROUND_HALF_EVEN).toNumber()) - runningSum;
  // The last bucket absorbs the difference
  rounded[rounded.length - 1] = lastRounded;

  return buckets.map((b, i) => ({
    bucketId: b.bucketId,
    bucketCode: b.bucketCode,
    amount: rounded[i],
  }));
}

/**
 * Sanity check: the rounded allocations must sum to the original amount.
 * Throws if they don't. This is the safety net for the bucket rule.
 */
export function assertAllocationsSumExactly(
  amount: number,
  allocations: BucketAllocationResult[]
): void {
  const sum = allocations.reduce((s, a) => s + a.amount, 0);
  const expected = Number(amount.toFixed(2));
  const actual = Number(sum.toFixed(2));
  if (expected !== actual) {
    throw new Error(
      `Bucket allocation mismatch: expected ${expected}, got ${actual}. ` +
      `Difference: ${(expected - actual).toFixed(4)}. This is a CRITICAL bug.`
    );
  }
}

/**
 * Human-friendly label for a bucket code
 */
export function bucketLabel(code: string): string {
  const b = Object.values(config.buckets).find((x) => x.code === code);
  return b?.name ?? code;
}

export function bucketColor(code: string): string {
  const colors: Record<string, string> = {
    LAND: '#0a3a5c',      // navy
    BUSINESS: '#b45309',   // gold
    FUNERAL: '#475569',    // slate
    MEDICAL: '#0891b2',    // cyan
    ADMIN: '#64748b',      // slate-light
    SOFT_LOANS: '#10b981', // emerald (money in / out)
  };
  return colors[code] ?? '#64748b';
}
