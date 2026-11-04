/**
 * Bucket adjustment rules (pure -- no database, no React).
 * -----------------------------------------------------------------------------
 * A bucket adjustment moves money between buckets without changing the total.
 * It exists for the cases a contribution or an expense cannot cover:
 *
 *   - an allocation residue that has to go back where it came from
 *   - a rebalance the General Meeting voted for
 *   - a correction to a bucket that was credited twice
 *
 * The rules are strict on purpose, because a bucket adjustment is the one
 * place where a mistake silently rewrites the cooperative's books:
 *
 *   1. It must move money, not create it. The moves must sum to zero.
 *   2. It must involve at least two buckets.
 *   3. No bucket may end up with a negative balance.
 *   4. A written reason is mandatory (enforced by the caller).
 *
 * Every adjustment writes a BucketTransaction of type ADJUSTMENT against each
 * bucket it touches, so the reconciliation card keeps showing drift of K0.
 */

export interface BucketBalance {
  code: string;
  balance: number;
}

export interface BucketMove {
  code: string;
  /** Positive credits the bucket, negative debits it. */
  amount: number;
}

export type AdjustmentProblemCode =
  | 'NO_MOVES'
  | 'ONE_BUCKET'
  | 'NOT_ZERO_SUM'
  | 'NEGATIVE_BALANCE'
  | 'UNKNOWN_BUCKET'
  | 'BAD_AMOUNT';

export interface AdjustmentProblem {
  code: AdjustmentProblemCode;
  message: string;
}

export interface AdjustmentPlan {
  moves: BucketMove[];
  /** The balance each touched bucket has now. */
  before: Record<string, number>;
  /** The balance each touched bucket will have after the adjustment. */
  after: Record<string, number>;
  /** Always zero -- a valid adjustment moves money, it never creates it. */
  net: number;
}

/** Kwacha. Two decimals is the precision the bucket balances are stored at. */
export const ADJUSTMENT_TOLERANCE = 0.01;

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Turn a list of raw moves into a plan, or explain why they cannot be applied.
 * A move with an amount of zero is dropped: an empty row in the form is not an
 * error, it is just an empty row.
 */
export function planBucketAdjustment(
  balances: BucketBalance[],
  moves: BucketMove[],
): { plan: AdjustmentPlan } | { problem: AdjustmentProblem } {
  const known = new Map(balances.map((b) => [b.code, b.balance]));

  const cleaned: BucketMove[] = [];
  for (const m of moves) {
    const amount = round2(Number(m.amount));
    if (!Number.isFinite(amount)) {
      return {
        problem: {
          code: 'BAD_AMOUNT',
          message: 'Every amount must be a number.',
        },
      };
    }
    if (Math.abs(amount) < ADJUSTMENT_TOLERANCE) continue;
    if (!known.has(m.code)) {
      return {
        problem: {
          code: 'UNKNOWN_BUCKET',
          message: 'Unknown bucket ' + m.code + '.',
        },
      };
    }
    cleaned.push({ code: m.code, amount });
  }

  if (cleaned.length === 0) {
    return {
      problem: {
        code: 'NO_MOVES',
        message: 'Enter at least one amount to move.',
      },
    };
  }

  const touched = new Set(cleaned.map((m) => m.code));
  if (touched.size < 2) {
    return {
      problem: {
        code: 'ONE_BUCKET',
        message: 'An adjustment must move money between at least two buckets.',
      },
    };
  }

  const net = round2(cleaned.reduce((s, m) => s + m.amount, 0));
  if (Math.abs(net) > ADJUSTMENT_TOLERANCE) {
    return {
      problem: {
        code: 'NOT_ZERO_SUM',
        message:
          'The moves must add up to zero. They currently add up to K' +
          net.toFixed(2) +
          '.',
      },
    };
  }

  const before: Record<string, number> = {};
  const after: Record<string, number> = {};
  for (const m of cleaned) {
    if (before[m.code] === undefined) {
      before[m.code] = known.get(m.code) ?? 0;
      after[m.code] = before[m.code];
    }
    after[m.code] = round2(after[m.code] + m.amount);
  }

  for (const code of Object.keys(after)) {
    if (after[code] < -ADJUSTMENT_TOLERANCE) {
      return {
        problem: {
          code: 'NEGATIVE_BALANCE',
          message:
            code +
            ' would end at K' +
            after[code].toFixed(2) +
            '. A bucket cannot be taken below zero.',
        },
      };
    }
  }

  return { plan: { moves: cleaned, before, after, net } };
}
