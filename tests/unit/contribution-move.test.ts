/**
 * Unit tests for the rules that decide whether a recorded payment may be
 * moved to a different month.
 *
 * The rules decide whether a Treasurer can correct a mis-booked payment, so
 * they are verified here rather than trusted. In particular: a move must
 * never be able to book money against a month before the member joined, and
 * must never create two payments for one member in one month.
 */

import { describe, it, expect } from 'vitest';
import { checkContributionMove } from '../../src/lib/contribution-move';

const FOUNDING: { year: number; month: number } = { year: 2026, month: 7 };

describe('checkContributionMove', () => {
  it('allows a payment to be moved back to an earlier month the member owes', () => {
    const result = checkContributionMove({
      current: { year: 2026, month: 11 },
      target: { year: 2026, month: 10 },
      firstLiable: FOUNDING,
      targetAlreadyPaid: false,
    });
    expect(result.ok).toBe(true);
  });

  it('allows a payment to be moved forward to a later month', () => {
    const result = checkContributionMove({
      current: { year: 2026, month: 9 },
      target: { year: 2026, month: 10 },
      firstLiable: FOUNDING,
      targetAlreadyPaid: false,
    });
    expect(result.ok).toBe(true);
  });

  it('refuses to move a payment to the month it is already booked for', () => {
    const result = checkContributionMove({
      current: { year: 2026, month: 10 },
      target: { year: 2026, month: 10 },
      firstLiable: FOUNDING,
      targetAlreadyPaid: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('already booked');
  });

  it('refuses to move a payment to a month before the member joined', () => {
    const result = checkContributionMove({
      current: { year: 2026, month: 10 },
      target: { year: 2026, month: 6 },
      firstLiable: FOUNDING,
      targetAlreadyPaid: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('before joining');
  });

  it('allows a move to the exact month the member joined', () => {
    const result = checkContributionMove({
      current: { year: 2026, month: 10 },
      target: { year: 2026, month: 7 },
      firstLiable: FOUNDING,
      targetAlreadyPaid: false,
    });
    expect(result.ok).toBe(true);
  });

  it('compares the months across years', () => {
    const result = checkContributionMove({
      current: { year: 2026, month: 10 },
      target: { year: 2025, month: 12 },
      firstLiable: FOUNDING,
      targetAlreadyPaid: false,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('before joining');
  });

  it('refuses to move a payment onto a month the member has already paid', () => {
    const result = checkContributionMove({
      current: { year: 2026, month: 11 },
      target: { year: 2026, month: 10 },
      firstLiable: FOUNDING,
      targetAlreadyPaid: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('already has a payment booked');
  });

  it('allows a move to a month after the member left, which the report shows on its own line', () => {
    const result = checkContributionMove({
      current: { year: 2026, month: 10 },
      target: { year: 2026, month: 12 },
      firstLiable: FOUNDING,
      targetAlreadyPaid: false,
    });
    expect(result.ok).toBe(true);
  });
});
