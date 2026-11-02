/**
 * Unit tests for the member joining-date rules.
 *
 * The joining date decides from which month the contributions report starts
 * billing a member, so the rules are verified here rather than trusted.
 */

import { describe, it, expect } from 'vitest';
import {
  parseJoiningDate,
  joiningDateValue,
  resolveJoiningDate,
  dateAnchor,
  sameJoiningDay,
} from '../../src/lib/member-joining';
import { firstLiableMonth, monthKey } from '../../src/lib/contribution-report';

/** A local-time date, so the month under test is never shifted by a timezone. */
function localDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

/** The founding members' joinedAt as the seed writes it: UTC midnight. */
const FOUNDING_JOINED_AT = new Date('2026-07-22T00:00:00Z');

const NOW = localDate(2026, 11, 2);

describe('parseJoiningDate', () => {
  it('reads an empty value as "not supplied", not as an error', () => {
    expect(parseJoiningDate('')).toEqual({ ok: true, date: null });
    expect(parseJoiningDate('   ')).toEqual({ ok: true, date: null });
    expect(parseJoiningDate(null)).toEqual({ ok: true, date: null });
    expect(parseJoiningDate(undefined)).toEqual({ ok: true, date: null });
  });

  it('parses a YYYY-MM-DD value and anchors it at midday UTC', () => {
    const result = parseJoiningDate('2026-07-22');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.date?.toISOString()).toBe('2026-07-22T12:00:00.000Z');
  });

  it('ignores surrounding whitespace', () => {
    const result = parseJoiningDate('  2026-07-22  ');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.date?.toISOString()).toBe('2026-07-22T12:00:00.000Z');
  });

  it('rejects a value that is not a full date', () => {
    expect(parseJoiningDate('2026-07').ok).toBe(false);
    expect(parseJoiningDate('22/07/2026').ok).toBe(false);
    expect(parseJoiningDate('July 2026').ok).toBe(false);
  });

  it('rejects an impossible month or day', () => {
    expect(parseJoiningDate('2026-13-01').ok).toBe(false);
    expect(parseJoiningDate('2026-00-10').ok).toBe(false);
    expect(parseJoiningDate('2026-02-30').ok).toBe(false);
    expect(parseJoiningDate('2026-04-31').ok).toBe(false);
  });

  it('accepts 29 February in a leap year and rejects it otherwise', () => {
    expect(parseJoiningDate('2028-02-29').ok).toBe(true);
    expect(parseJoiningDate('2026-02-29').ok).toBe(false);
  });

  it('rejects a year outside the supported range', () => {
    expect(parseJoiningDate('1999-07-22').ok).toBe(false);
    expect(parseJoiningDate('2101-07-22').ok).toBe(false);
  });
});

describe('joiningDateValue', () => {
  it('renders a date for the <input type="date"> field', () => {
    expect(joiningDateValue(dateAnchor(2026, 7, 22))).toBe('2026-07-22');
    expect(joiningDateValue(dateAnchor(2026, 12, 1))).toBe('2026-12-01');
  });

  it('reads the seed\'s UTC-midnight founding date as 22 July 2026', () => {
    expect(joiningDateValue(FOUNDING_JOINED_AT)).toBe('2026-07-22');
  });

  it('round-trips a parsed date', () => {
    const parsed = parseJoiningDate('2026-09-06');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok || !parsed.date) return;
    expect(joiningDateValue(parsed.date)).toBe('2026-09-06');
  });
});

describe('sameJoiningDay', () => {
  it('ignores the time of day', () => {
    expect(sameJoiningDay(FOUNDING_JOINED_AT, dateAnchor(2026, 7, 22))).toBe(true);
    expect(sameJoiningDay(FOUNDING_JOINED_AT, dateAnchor(2026, 7, 23))).toBe(false);
  });
});

describe('resolveJoiningDate', () => {
  it('keeps the existing date when the field is blank', () => {
    const result = resolveJoiningDate({
      value: '',
      existingJoinedAt: FOUNDING_JOINED_AT,
      leftAt: null,
      now: NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.joinedAt).toBe(FOUNDING_JOINED_AT);
    expect(result.changed).toBe(false);
  });

  it('records a corrected joining date', () => {
    const result = resolveJoiningDate({
      value: '2026-07-22',
      existingJoinedAt: new Date('2026-09-07T00:00:00Z'),
      leftAt: null,
      now: NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.joinedAt.toISOString()).toBe('2026-07-22T12:00:00.000Z');
    expect(result.changed).toBe(true);
  });

  it('reports no change when the same day is entered again', () => {
    const result = resolveJoiningDate({
      value: '2026-07-22',
      existingJoinedAt: FOUNDING_JOINED_AT,
      leftAt: null,
      now: NOW,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.changed).toBe(false);
  });

  it('rejects a date in the future', () => {
    const result = resolveJoiningDate({
      value: '2026-12-01',
      existingJoinedAt: FOUNDING_JOINED_AT,
      leftAt: null,
      now: NOW,
    });
    expect(result.ok).toBe(false);
  });

  it('rejects a date before the cooperative was founded', () => {
    const result = resolveJoiningDate({
      value: '2026-06-30',
      existingJoinedAt: FOUNDING_JOINED_AT,
      leftAt: null,
      now: NOW,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/2026|founded/i);
  });

  it('rejects a date later than the month the member left', () => {
    const result = resolveJoiningDate({
      value: '2026-10-01',
      existingJoinedAt: FOUNDING_JOINED_AT,
      leftAt: dateAnchor(2026, 9, 15),
      now: NOW,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/left/i);
  });

  it('allows a joining date in the same month the member left', () => {
    const result = resolveJoiningDate({
      value: '2026-09-06',
      existingJoinedAt: FOUNDING_JOINED_AT,
      leftAt: dateAnchor(2026, 9, 15),
      now: NOW,
    });
    expect(result.ok).toBe(true);
  });
});

describe('the joining date drives the first liable month', () => {
  it('moves a late joiner back to July 2026 when the date is corrected', () => {
    const corrected = resolveJoiningDate({
      value: '2026-07-22',
      existingJoinedAt: new Date('2026-09-07T00:00:00Z'),
      leftAt: null,
      now: NOW,
    });
    expect(corrected.ok).toBe(true);
    if (!corrected.ok) return;

    expect(
      firstLiableMonth({
        isFoundingMember: false,
        joinedAt: new Date('2026-09-07T00:00:00Z'),
      }),
    ).toEqual({ year: 2026, month: 9 });

    expect(
      firstLiableMonth({
        isFoundingMember: false,
        joinedAt: corrected.joinedAt,
      }),
    ).toEqual({ year: 2026, month: 7 });
  });

  it('stores the date so the month reads the same in any timezone', () => {
    // Midday UTC keeps the month stable from UTC-12 through UTC+12.
    const stored = dateAnchor(2026, 7, 22);
    expect(stored.getUTCHours()).toBe(12);
    expect(monthKey(stored)).toEqual({ year: 2026, month: 7 });
  });
});
