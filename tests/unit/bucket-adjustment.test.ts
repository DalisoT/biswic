import { describe, it, expect } from 'vitest';
import {
  planBucketAdjustment,
  round2,
  type BucketBalance,
  type BucketMove,
} from '../../src/lib/bucket-adjustment';

const BALANCES: BucketBalance[] = [
  { code: 'LAND', balance: 10330 },
  { code: 'BUSINESS', balance: 3440 },
  { code: 'SOFT_LOANS', balance: 2587 },
  { code: 'ADMIN', balance: 861 },
  { code: 'FUNERAL', balance: -15 },
  { code: 'MEDICAL', balance: -3 },
];

function problemOf(moves: BucketMove[]) {
  const result = planBucketAdjustment(BALANCES, moves);
  if ('problem' in result) return result.problem;
  return null;
}

describe('planBucketAdjustment', () => {
  it('accepts a move that sums to zero and leaves every bucket known', () => {
    const result = planBucketAdjustment(BALANCES, [
      { code: 'LAND', amount: -10 },
      { code: 'FUNERAL', amount: 15 },
      { code: 'MEDICAL', amount: 3 },
      { code: 'SOFT_LOANS', amount: -7 },
      { code: 'ADMIN', amount: -1 },
    ]);
    expect('plan' in result).toBe(true);
    if (!('plan' in result)) return;
    expect(result.plan.net).toBe(0);
    expect(result.plan.after.LAND).toBe(10320);
    expect(result.plan.after.FUNERAL).toBe(0);
    expect(result.plan.after.MEDICAL).toBe(0);
    expect(result.plan.after.SOFT_LOANS).toBe(2580);
    expect(result.plan.after.ADMIN).toBe(860);
    expect(result.plan.after.BUSINESS).toBeUndefined();
  });

  it('refuses a move that does not sum to zero', () => {
    const problem = problemOf([
      { code: 'LAND', amount: -10 },
      { code: 'ADMIN', amount: 5 },
    ]);
    expect(problem?.code).toBe('NOT_ZERO_SUM');
  });

  it('refuses a move that touches only one bucket', () => {
    const problem = problemOf([
      { code: 'LAND', amount: -10 },
      { code: 'LAND', amount: 10 },
    ]);
    expect(problem?.code).toBe('ONE_BUCKET');
  });

  it('refuses an empty move list', () => {
    expect(problemOf([])?.code).toBe('NO_MOVES');
    expect(problemOf([{ code: 'LAND', amount: 0 }])?.code).toBe('NO_MOVES');
  });

  it('refuses a bucket that would end up below zero', () => {
    const problem = problemOf([
      { code: 'ADMIN', amount: -900 },
      { code: 'LAND', amount: 900 },
    ]);
    expect(problem?.code).toBe('NEGATIVE_BALANCE');
  });

  it('refuses an unknown bucket', () => {
    const problem = problemOf([
      { code: 'NOWHERE', amount: -10 },
      { code: 'LAND', amount: 10 },
    ]);
    expect(problem?.code).toBe('UNKNOWN_BUCKET');
  });

  it('refuses an amount that is not a number', () => {
    const problem = problemOf([
      { code: 'LAND', amount: Number.NaN },
      { code: 'ADMIN', amount: 10 },
    ]);
    expect(problem?.code).toBe('BAD_AMOUNT');
  });

  it('allows a bucket that is already negative to be brought back to zero', () => {
    const result = planBucketAdjustment(BALANCES, [
      { code: 'FUNERAL', amount: 15 },
      { code: 'MEDICAL', amount: 3 },
      { code: 'LAND', amount: -10 },
      { code: 'SOFT_LOANS', amount: -7 },
      { code: 'ADMIN', amount: -1 },
    ]);
    expect('plan' in result).toBe(true);
    if (!('plan' in result)) return;
    expect(result.plan.after.FUNERAL).toBe(0);
    expect(result.plan.after.MEDICAL).toBe(0);
  });

  it('never creates money: the total across buckets is unchanged', () => {
    const result = planBucketAdjustment(BALANCES, [
      { code: 'LAND', amount: -10 },
      { code: 'FUNERAL', amount: 15 },
      { code: 'MEDICAL', amount: 3 },
      { code: 'SOFT_LOANS', amount: -7 },
      { code: 'ADMIN', amount: -1 },
    ]);
    if (!('plan' in result)) throw new Error('expected a plan');
    const before = BALANCES.reduce((s, b) => s + b.balance, 0);
    const after = Object.values(result.plan.after).reduce((s, v) => s + v, 0);
    const untouched = BALANCES.filter((b) => result.plan.after[b.code] === undefined);
    const untouchedTotal = untouched.reduce((s, b) => s + b.balance, 0);
    expect(round2(after + untouchedTotal)).toBe(round2(before));
  });
});
