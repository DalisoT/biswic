/**
 * Unit tests for the member leaving-date rules.
 *
 * The leaving month decides how long the contributions report keeps billing a
 * member, so the rules are verified here rather than trusted.
 */

import { describe, it, expect } from 'vitest';
import {
  parseLeavingMonth,
  leavingMonthValue,
  monthAnchor,
  resolveLeavingMonth,
  compareMonth,
  formatMonthLabel,
  isRedactedMember,
  type MonthKey,
} from '../../src/lib/member-leaving';

/** A local-time date, so the month under test is never shifted by a timezone. */
function localDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

const FIRST_LIABLE: MonthKey = { year: 2026, month: 7 }; // the founding month
const NOW = localDate(2026, 11, 1);

describe('parseLeavingMonth', () => {
  it('reads an empty value as "no leaving month", not as an error', () => {
    expect(parseLeavingMonth('')).toEqual({ ok: true, month: null });
    expect(parseLeavingMonth('   ')).toEqual({ ok: true, month: null });
    expect(parseLeavingMonth(null)).toEqual({ ok: true, month: null });
    expect(parseLeavingMonth(undefined)).toEqual({ ok: true, month: null });
  });

  it('parses a YYYY-MM value', () => {
    expect(parseLeavingMonth('2026-09')).toEqual({
      ok: true,
      month: { year: 2026, month: 9 },
    });
  });

  it('ignores surrounding whitespace', () => {
    expect(parseLeavingMonth(' 2026-09 ')).toEqual({
      ok: true,
      month: { year: 2026, month: 9 },
    });
  });

  it('rejects a malformed value', () => {
    const result = parseLeavingMonth('September 2026');
    expect(result.ok).toBe(false);
  });

  it('rejects an impossible month', () => {
    expect(parseLeavingMonth('2026-13').ok).toBe(false);
    expect(parseLeavingMonth('2026-00').ok).toBe(false);
  });

  it('rejects a two-digit year', () => {
    expect(parseLeavingMonth('26-09').ok).toBe(false);
  });
});

describe('monthAnchor', () => {
  it('anchors at midday UTC on the 15th', () => {
    expect(monthAnchor(2026, 9).toISOString()).toBe('2026-09-15T12:00:00.000Z');
  });

  it('reads back as the same month whatever the timezone', () => {
    // The contributions report reads the leaving date with LOCAL getters, so
    // an anchor near a month boundary would shift the billed month.
    const anchor = monthAnchor(2026, 9);
    const local = new Date(anchor.getTime());
    expect(local.getFullYear()).toBe(2026);
    expect(local.getMonth() + 1).toBe(9);
  });
});

describe('leavingMonthValue', () => {
  it('renders a leaving date as the month input value', () => {
    expect(leavingMonthValue(monthAnchor(2026, 9))).toBe('2026-09');
    expect(leavingMonthValue(monthAnchor(2026, 12))).toBe('2026-12');
  });

  it('renders nothing when there is no leaving date', () => {
    expect(leavingMonthValue(null)).toBeNull();
  });
});

describe('compareMonth and formatMonthLabel', () => {
  it('orders months', () => {
    expect(compareMonth({ year: 2026, month: 7 }, { year: 2026, month: 8 })).toBe(-1);
    expect(compareMonth({ year: 2026, month: 8 }, { year: 2026, month: 8 })).toBe(0);
    expect(compareMonth({ year: 2027, month: 1 }, { year: 2026, month: 12 })).toBe(1);
  });

  it('labels a month for humans', () => {
    expect(formatMonthLabel({ year: 2026, month: 9 })).toBe('September 2026');
  });
});

describe('resolveLeavingMonth', () => {
  const base = {
    isActive: false,
    existingLeftAt: null,
    firstLiable: FIRST_LIABLE,
    now: NOW,
  };

  it('records the stated leaving month', () => {
    const result = resolveLeavingMonth({ ...base, value: '2026-09' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.leftAt?.toISOString()).toBe('2026-09-15T12:00:00.000Z');
    expect(result.changed).toBe(true);
  });

  it('refuses a leaving month before the member first owes contributions', () => {
    // The cooperative did not exist before July 2026, so a founding member
    // cannot have left in June 2026.
    const result = resolveLeavingMonth({ ...base, value: '2026-06' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('July 2026');
  });

  it('refuses a leaving month in the future', () => {
    const result = resolveLeavingMonth({ ...base, value: '2026-12', now: NOW });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain('future');
  });

  it('clears the leaving month when the member is active again', () => {
    const result = resolveLeavingMonth({
      ...base,
      isActive: true,
      value: '',
      existingLeftAt: monthAnchor(2026, 8),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.leftAt).toBeNull();
    expect(result.changed).toBe(true);
  });

  it('stops the billing from this month when a member is deactivated with no leaving month', () => {
    // This is the fix: before it, a deactivated member kept `leftAt = null`
    // and was billed for every month of the period, forever.
    const result = resolveLeavingMonth({
      ...base,
      value: '',
      isDeactivating: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.leftAt?.toISOString()).toBe('2026-11-15T12:00:00.000Z');
    expect(result.changed).toBe(true);
  });

  it('leaves the leaving month unrecorded when an already-inactive member is edited', () => {
    // An unrelated edit -- correcting a phone number, say -- must not invent
    // a leaving month for a member whose real leaving month the committee
    // has not supplied yet.
    const result = resolveLeavingMonth({ ...base, value: '' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.leftAt).toBeNull();
    expect(result.changed).toBe(false);
  });

  it('keeps the leaving month already on file when the field is cleared', () => {
    // Clearing the field must not push a member's leaving month forward.
    const existing = monthAnchor(2026, 8);
    const result = resolveLeavingMonth({
      ...base,
      value: '',
      existingLeftAt: existing,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.leftAt?.toISOString()).toBe(existing.toISOString());
    expect(result.changed).toBe(false);
  });

  it('never leaves a leaving month earlier than the first month the member owes', () => {
    const result = resolveLeavingMonth({
      ...base,
      value: '',
      isDeactivating: true,
      now: localDate(2026, 8, 1),
      firstLiable: { year: 2026, month: 9 },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.leftAt?.toISOString()).toBe('2026-09-15T12:00:00.000Z');
  });

  it('reports no change when the stated month is the one already on file', () => {
    const result = resolveLeavingMonth({
      ...base,
      value: '2026-08',
      existingLeftAt: monthAnchor(2026, 8),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.changed).toBe(false);
  });

  it('rejects a malformed value', () => {
    const result = resolveLeavingMonth({ ...base, value: 'last month' });
    expect(result.ok).toBe(false);
  });
});

describe('isRedactedMember', () => {
  it('recognises the redaction marker', () => {
    expect(isRedactedMember('DELETED-A1B2C3D4')).toBe(true);
    expect(isRedactedMember('106759')).toBe(false);
    expect(isRedactedMember(null)).toBe(false);
  });
});
