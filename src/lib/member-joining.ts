import { config } from './config';
import { monthKey } from './contribution-report';
import { compareMonth, formatMonthLabel, MONTH_NAMES } from './member-leaving';

/**
 * Joining dates for members.
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS
 *
 * `User.joinedAt` is the canonical "this member joined the cooperative" date
 * and the contributions report starts billing a member from that month. It was
 * written once, by the seed, and nothing in the app could ever change it: the
 * seed set it from the founding register for the 63 founding members, and from
 * a LATE_JOINERS list for everyone else.
 *
 * The problem is that a record created on the platform is not the same thing as
 * a member joining. Three members on the live register had their records
 * created on 6 August, 6 September and 7 September 2026, and the seed wrote
 * those dates into `joinedAt`. All three had in fact paid cash on 15 July
 * 2026 against real receipts, in the same series as every other July payer.
 *
 * So the platform was billing them from a month they had joined, and treating
 * their July and August money as "received before joining" -- money held on
 * account and reported on its own line, unable to cancel an arrears month.
 * The chairman confirmed on 2 November 2026 that all three joined on 22 July
 * 2026, the day the founding register was signed.
 *
 * So the Treasurer needs a way to record WHEN a member actually joined. This
 * module holds that rule in pure form so it can be unit tested without a
 * database, and so the edit form, the server action and the report all agree
 * on what a joining date means.
 *
 * THE RULES
 *
 *   1. A joining date is recorded at DAY granularity ("YYYY-MM-DD"), because
 *      a joining register is signed on a date. The cooperative's ledger is
 *      monthly, so only the MONTH of this date changes what a member owes.
 *   2. The date is stored at MIDDAY UTC. The contributions report reads it
 *      with LOCAL date getters, and a midnight-UTC timestamp reads as the
 *      PREVIOUS day anywhere west of UTC -- the same trap that made the
 *      founding members' July bills shift a month. Midday is far from both
 *      day boundaries, so the date reads the same in every timezone.
 *   3. A joining date cannot be in the future.
 *   4. A joining date cannot be earlier than the month the cooperative was
 *      founded: nobody joined before the cooperative existed.
 *   5. A joining date cannot be later than the month the member left.
 *   6. A blank field means "leave the joining date as it is" -- the same
 *      convention as the optional email field. Every member has a joining
 *      date; it is never cleared.
 */

export interface MonthKey {
  year: number;
  month: number; // 1-12
}

/** The value carried by an `<input type="date">` -- "YYYY-MM-DD". */
export type JoiningDateValue = string;

const DATE_VALUE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * A date anchored at midday UTC on the given day.
 *
 * See rule 2 above: the report and the member list both read dates with local
 * getters, so a midnight-UTC timestamp can display as the previous day.
 */
export function dateAnchor(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

/** Days in a month, accounting for leap years. */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export type ParseJoiningDateResult =
  | { ok: true; date: Date | null }
  | { ok: false; error: string };

/**
 * Parse the raw value of an `<input type="date">`.
 *
 * An empty value is NOT an error -- it means "not supplied" -- and is reported
 * as `{ ok: true, date: null }`. A non-empty value that is not a valid
 * "YYYY-MM-DD" IS an error.
 */
export function parseJoiningDate(
  value: string | null | undefined,
): ParseJoiningDateResult {
  if (value === null || value === undefined) return { ok: true, date: null };
  const trimmed = String(value).trim();
  if (trimmed === '') return { ok: true, date: null };

  const match = DATE_VALUE_RE.exec(trimmed);
  if (!match) {
    return {
      ok: false,
      error: 'The joining date must be in the form YYYY-MM-DD (for example 2026-07-22).',
    };
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12) {
    return { ok: false, error: 'The joining date must be a real month (01 to 12).' };
  }
  if (year < 2000 || year > 2100) {
    return {
      ok: false,
      error: 'The joining date must be between the years 2000 and 2100.',
    };
  }
  if (day < 1 || day > daysInMonth(year, month)) {
    return {
      ok: false,
      error: 'The joining date must be a real day for that month.',
    };
  }

  return { ok: true, date: dateAnchor(year, month, day) };
}

/**
 * Render a joining date as the "YYYY-MM-DD" value an `<input type="date">`
 * expects.
 *
 * The UTC getters are deliberate: joining dates are stored anchored at midday
 * UTC, so the UTC day IS the intended day. Reading it back with local getters
 * would show the previous day for any server west of UTC.
 */
export function joiningDateValue(joinedAt: Date): string {
  const year = joinedAt.getUTCFullYear();
  const month = joinedAt.getUTCMonth() + 1;
  const day = joinedAt.getUTCDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Render a joining date the way it should read on a member's record:
 * "22 July 2026".
 *
 * The UTC getters are deliberate for the same reason as `joiningDateValue`:
 * the stored date is anchored at midday UTC, so the UTC day IS the intended
 * day.
 */
export function formatJoiningDate(joinedAt: Date): string {
  const month = MONTH_NAMES[joinedAt.getUTCMonth()];
  return `${joinedAt.getUTCDate()} ${month} ${joinedAt.getUTCFullYear()}`;
}

/** Do two dates fall on the same calendar day (read with UTC getters)? */
export function sameJoiningDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

export interface ResolveJoiningInput {
  /** The raw form value: "YYYY-MM-DD", or empty for "not supplied". */
  value: string | null | undefined;
  /** The joining date already on file. */
  existingJoinedAt: Date;
  /** The month the member left, if they have one. */
  leftAt: Date | null;
  /** "Now" -- injectable so the rules can be tested. */
  now?: Date;
}

export type ResolveJoiningResult =
  | { ok: true; joinedAt: Date; changed: boolean }
  | { ok: false; error: string };

/**
 * Work out what `joinedAt` should become, given the form input and the
 * member's current state.
 *
 * See the rules at the top of this file.
 */
export function resolveJoiningDate(
  input: ResolveJoiningInput,
): ResolveJoiningResult {
  const parsed = parseJoiningDate(input.value);
  if (!parsed.ok) return parsed;

  const now = input.now ?? new Date();

  // Rule 6: a blank field means "leave it as it is". Every member has a
  // joining date and it is never cleared.
  if (!parsed.date) {
    return {
      ok: true,
      joinedAt: input.existingJoinedAt,
      changed: false,
    };
  }

  const date = parsed.date;

  // Rule 3: the joining date cannot be in the future. "Today" is read with
  // local getters so the comparison matches the calendar the officer is on.
  const todayUtc = Date.UTC(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const chosenUtc = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
  if (chosenUtc > todayUtc) {
    return { ok: false, error: 'The joining date cannot be in the future.' };
  }

  // Rule 4: nobody joined before the cooperative was founded.
  const foundingMonth = monthKey(config.cooperativeStartDate);
  const joiningMonth = monthKey(date);
  if (compareMonth(joiningMonth, foundingMonth) < 0) {
    return {
      ok: false,
      error: `The joining date cannot be earlier than ${formatMonthLabel(
        foundingMonth,
      )}, when the cooperative was founded.`,
    };
  }

  // Rule 5: a member cannot join after the month they left.
  if (input.leftAt) {
    const leavingMonth = monthKey(input.leftAt);
    if (compareMonth(joiningMonth, leavingMonth) > 0) {
      return {
        ok: false,
        error: `The joining date cannot be later than ${formatMonthLabel(
          leavingMonth,
        )}, the month this member left the cooperative.`,
      };
    }
  }

  return {
    ok: true,
    joinedAt: date,
    changed: !sameJoiningDay(date, input.existingJoinedAt),
  };
}

/** The month key of a joining date, read the way the report reads it. */
export function joiningMonthOf(joinedAt: Date): MonthKey {
  return monthKey(joinedAt);
}
