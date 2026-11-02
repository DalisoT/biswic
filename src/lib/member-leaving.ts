import { monthKey } from './contribution-report';

/**
 * Leaving dates for members.
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS
 *
 * `User.leftAt` is the canonical "this member has left the cooperative"
 * timestamp, and the contributions report already stops billing a member at
 * that month. But nothing in the app could ever SET it: the only writer was
 * the redaction flow (`deleteMemberAction`), which also strips the member's
 * PII and deletes their login. So a member who simply stopped paying -- the
 * ordinary way people leave a cooperative -- was deactivated with
 * `isActive = false` and `leftAt = null`, and the report went on billing them
 * for every month of the period, forever.
 *
 * On the live register that was 7 members x 5 months = K3,500 of arrears
 * against people who are no longer with us.
 *
 * So the Treasurer needs a way to record WHEN a member left. This module holds
 * that rule in pure form so it can be unit tested without a database, and so
 * the edit form, the server action and the report all agree on what a leaving
 * month means.
 *
 * THE RULES
 *
 *   1. A leaving date is recorded at MONTH granularity ("YYYY-MM"). The
 *      cooperative's whole ledger is monthly -- one contribution per member per
 *      month -- so a day-level leaving date would be false precision.
 *   2. A member owes contributions UP TO AND INCLUDING the month they left.
 *      Leaving in September means July, August and September are owed.
 *   3. Deactivating a member (an active member being switched off) without
 *      naming a leaving month stops the billing from the CURRENT month.
 *      Leaving the field blank must never leave a member liable forever --
 *      that was the bug this module fixes.
 *   4. Reactivating a member clears the leaving date: they are back on the
 *      register and liable to the end of the period again.
 *   5. A leaving month cannot be earlier than the first month the member owes,
 *      and cannot be in the future.
 *   6. Editing a member who was ALREADY inactive, without naming a leaving
 *      month, leaves the leaving date alone. An unrelated edit -- correcting
 *      a phone number, say -- must not invent a leaving month for a member
 *      whose real leaving month is still unknown. Those stay visibly
 *      unrecorded until the committee supplies the month.
 */

export interface MonthKey {
  year: number;
  month: number; // 1-12
}

/** The value carried by an `<input type="month">` -- "YYYY-MM". */
export type LeavingMonthValue = string;

const MONTH_VALUE_RE = /^(\d{4})-(\d{2})$/;

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** "March 2026" -- used in messages and labels. */
export function formatMonthLabel(key: MonthKey): string {
  return `${MONTH_NAMES[key.month - 1]} ${key.year}`;
}

/** Compare two month keys. Returns -1, 0 or 1. */
export function compareMonth(a: MonthKey, b: MonthKey): number {
  if (a.year !== b.year) return a.year < b.year ? -1 : 1;
  if (a.month !== b.month) return a.month < b.month ? -1 : 1;
  return 0;
}

/** Do two month keys fall in the same month? */
export function sameMonth(a: MonthKey | null, b: MonthKey | null): boolean {
  if (!a || !b) return a === b;
  return compareMonth(a, b) === 0;
}

/**
 * A date anchored at midday UTC on the 15th of the given month.
 *
 * The contributions report reads a leaving date with LOCAL date getters
 * (`monthKey`). A midnight-UTC timestamp therefore reads as the PREVIOUS
 * month anywhere west of UTC -- the same trap that made a bare '2026-03-01'
 * date string turn into a February member in the tests. Midday on the 15th is
 * far from either month boundary, so the month reads the same in every
 * timezone from UTC-12 through UTC+12.
 */
export function monthAnchor(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 15, 12, 0, 0));
}

/** A month key for a date, read with local getters (matching the report). */
export function monthKeyOf(date: Date): MonthKey {
  return monthKey(date);
}

export type ParseMonthResult =
  | { ok: true; month: MonthKey | null }
  | { ok: false; error: string };

/**
 * Parse the raw value of an `<input type="month">`.
 *
 * An empty value is NOT an error -- it means "no leaving month" -- and is
 * reported as `{ ok: true, month: null }`. A non-empty value that is not a
 * valid "YYYY-MM" IS an error.
 */
export function parseLeavingMonth(
  value: string | null | undefined,
): ParseMonthResult {
  if (value === null || value === undefined) return { ok: true, month: null };
  const trimmed = String(value).trim();
  if (trimmed === '') return { ok: true, month: null };

  const match = MONTH_VALUE_RE.exec(trimmed);
  if (!match) {
    return {
      ok: false,
      error: 'The leave month must be in the form YYYY-MM (for example 2026-09).',
    };
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    return {
      ok: false,
      error: 'The leave month must be a real month (01 to 12).',
    };
  }
  if (year < 2000 || year > 2100) {
    return {
      ok: false,
      error: 'The leave month must be between the years 2000 and 2100.',
    };
  }
  return { ok: true, month: { year, month } };
}

/**
 * Render a leaving date as the "YYYY-MM" value an `<input type="month">`
 * expects. Returns null when there is no leaving date.
 */
export function leavingMonthValue(leftAt: Date | null): string | null {
  if (!leftAt) return null;
  const key = monthKey(leftAt);
  return `${key.year}-${String(key.month).padStart(2, '0')}`;
}

export interface ResolveLeavingInput {
  /** The raw form value: "YYYY-MM", or empty for "no leaving month". */
  value: string | null | undefined;
  /** Is the member still on the register? */
  isActive: boolean;
  /**
   * Is this edit the moment the member is being deactivated (they were
   * active and now are not)? Only then does a blank leaving month default to
   * the current month -- see rule 3 and rule 6.
   */
  isDeactivating?: boolean;
  /** The leaving date already on file, if any. */
  existingLeftAt: Date | null;
  /** The first month this member is liable to pay for. */
  firstLiable: MonthKey;
  /** "Now" -- injectable so the rules can be tested. */
  now?: Date;
}

export type ResolveLeavingResult =
  | { ok: true; leftAt: Date | null; changed: boolean }
  | { ok: false; error: string };

/**
 * Work out what `leftAt` should become, given the form input and the member's
 * current state.
 *
 * See the rules at the top of this file. The important one is rule 3: a
 * member who is deactivated without a stated leaving month is given the
 * CURRENT month, so the contributions report stops billing them from now on
 * instead of billing them forever.
 */
export function resolveLeavingMonth(
  input: ResolveLeavingInput,
): ResolveLeavingResult {
  const parsed = parseLeavingMonth(input.value);
  if (!parsed.ok) return parsed;

  const now = input.now ?? new Date();
  const nowMonth = monthKey(now);

  // Rule 5: the leaving month cannot be before the first month the member
  // owes, and cannot be in the future.
  if (parsed.month) {
    const key = parsed.month;
    if (compareMonth(key, input.firstLiable) < 0) {
      return {
        ok: false,
        error: `The leave month cannot be earlier than ${formatMonthLabel(
          input.firstLiable,
        )}, the first month this member owes contributions for.`,
      };
    }
    if (compareMonth(key, nowMonth) > 0) {
      return {
        ok: false,
        error: 'The leave month cannot be in the future.',
      };
    }
    const leftAt = monthAnchor(key.year, key.month);
    return {
      ok: true,
      leftAt,
      changed: !sameMonth(monthKey(leftAt), input.existingLeftAt ? monthKey(input.existingLeftAt) : null),
    };
  }

  // No leaving month was given.
  if (input.isActive) {
    // Rule 4: the member is back on the register, so any stale leaving date
    // is cleared.
    return {
      ok: true,
      leftAt: null,
      changed: input.existingLeftAt !== null,
    };
  }

  if (input.existingLeftAt) {
    // The member is inactive and already has a leaving date on file. Keep it:
    // clearing the field must not push their leaving month forward.
    return { ok: true, leftAt: input.existingLeftAt, changed: false };
  }

  // Rule 3: DEACTIVATING a member without a stated month stops the billing
  // from this month. Never leave a newly-deactivated member liable forever.
  if (input.isDeactivating) {
    const fallback =
      compareMonth(nowMonth, input.firstLiable) < 0 ? input.firstLiable : nowMonth;
    return {
      ok: true,
      leftAt: monthAnchor(fallback.year, fallback.month),
      changed: true,
    };
  }

  // Rule 6: this member was ALREADY inactive and no leaving month was given.
  // An unrelated edit must not invent a leaving month for a member whose real
  // leaving month the committee has not supplied yet. Leave it unrecorded.
  return { ok: true, leftAt: null, changed: false };
}

/**
 * Has this member's PII already been redacted?
 *
 * The redaction flow rewrites the service number to `DELETED-<8 hex chars>` and
 * the name to "[Redacted member]". That marker -- not `leftAt` -- is what says
 * "this record has been redacted", because `leftAt` now means "the month they
 * left the cooperative", which is a different thing and may be months before
 * the redaction.
 */
export function isRedactedMember(serviceNumber: string | null | undefined): boolean {
  return !!serviceNumber && serviceNumber.startsWith('DELETED-');
}
