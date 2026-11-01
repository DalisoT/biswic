import { config } from './config';

/**
 * Per-member contributions report engine.
 * ---------------------------------------------------------------------------
 * WHY THIS IS SEPARATE AND PURE
 *
 * Arrears are money owed to the cooperative. Getting the arithmetic wrong
 * would put a member's balance in front of the committee, so the logic here is
 * deliberately free of Prisma and React: it takes plain records and returns
 * plain records, so it can be unit tested without a database.
 *
 * The rules implemented here match the ones already used by the dashboard and
 * the finance screens (src/server/actions/contributions.ts):
 *   - A founding member owes from the cooperative's first month.
 *   - Any other member owes from the month they joined.
 *   - A member who has left owes up to the month they left.
 *   - One contribution per member per month (schema: @@unique([memberId, month, year])).
 */

export interface ContributionRecord {
  memberId: string;
  month: number; // 1-12
  year: number;
  amount: number;
}

export interface MemberRecord {
  id: string;
  serviceNumber: string;
  fullName: string;
  rank: string | null;
  isActive: boolean;
  isFoundingMember: boolean;
  joinedAt: Date;
  leftAt: Date | null;
}

export interface ReportPeriod {
  /** Inclusive start of the reporting period. */
  startYear: number;
  startMonth: number; // 1-12
  /** Inclusive end of the reporting period. */
  endYear: number;
  endMonth: number; // 1-12
}

export interface ContributionReportRow {
  memberId: string;
  serviceNumber: string;
  fullName: string;
  rank: string | null;
  status: 'Active' | 'Left';
  isFoundingMember: boolean;
  /** Months the member was eligible to pay within the period. */
  monthsDue: number;
  /** Months INSIDE the member's own liability window that were paid. */
  monthsPaid: number;
  /** Liability months with no contribution recorded for that month. */
  monthsMissed: number;
  /**
   * Money received for months OUTSIDE the member's liability window -- in
   * practice, months before they joined.
   *
   * It does not cancel an arrears month: the arrears figure counts the
   * months a member owed and did not pay. This is reported separately so the
   * committee can see that the money exists and decide whether to refund it
   * or carry it forward.
   */
  receivedBeforeJoining: number;
  /** monthsDue x monthly contribution. */
  expected: number;
  /** Sum of contributions recorded in the period. */
  contributed: number;
  /** monthsMissed x monthly contribution. */
  arrears: number;
  /** Percentage of due months that were paid, 0-100. */
  compliance: number;
}

export interface ContributionReport {
  rows: ContributionReportRow[];
  totals: {
    members: number;
    monthsDue: number;
    monthsPaid: number;
    monthsMissed: number;
    receivedBeforeJoining: number;
    expected: number;
    contributed: number;
    arrears: number;
    compliance: number;
  };
  period: ReportPeriod;
  monthlyContribution: number;
}

/** Convert a date to its (year, month) pair, month is 1-12. */
export function monthKey(date: Date): { year: number; month: number } {
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

/**
 * Inclusive count of months between two month keys.
 * Returns 0 when the end precedes the start.
 */
export function monthsBetween(
  startYear: number,
  startMonth: number,
  endYear: number,
  endMonth: number,
): number {
  const months =
    (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
  return months > 0 ? months : 0;
}

/**
 * Is a (year, month) pair inside the reporting period?
 *
 * This is the single definition of "inside the period" for the whole report.
 * The database filter in src/lib/contribution-period-filter.ts must agree
 * with it -- tests/unit/contribution-period-filter.test.ts checks that the
 * two agree for every month in a multi-year grid.
 */
export function isMonthInPeriod(
  year: number,
  month: number,
  period: ReportPeriod,
): boolean {
  if (year < period.startYear || year > period.endYear) return false;
  if (year === period.startYear && month < period.startMonth) return false;
  if (year === period.endYear && month > period.endMonth) return false;
  return true;
}

/**
 * The first month a member may contribute for.
 *
 * Founding members are on the register from the cooperative's first month;
 * everyone else from the month they joined.
 *
 * This is the single definition of when a member becomes liable. The payroll
 * import uses it to refuse contributions for months before a member joined,
 * and the arrears engine uses it to work out which months a member owes.
 */
export function firstLiableMonth(member: {
  isFoundingMember: boolean;
  joinedAt: Date;
}): { year: number; month: number } {
  if (member.isFoundingMember) {
    return monthKey(config.cooperativeStartDate);
  }
  return monthKey(member.joinedAt);
}

/**
 * The first month a member is liable to pay for.
 * Founding members are on the register from the cooperative's first month;
 * everyone else from the month they joined.
 */
export function eligibilityStart(member: MemberRecord): {
  year: number;
  month: number;
} {
  return firstLiableMonth(member);
}

/**
 * The last month a member is liable to pay for. Members who have left stop at
 * their leaving month; everyone else runs to the end of the period.
 */
export function eligibilityEnd(
  member: MemberRecord,
  period: ReportPeriod,
): { year: number; month: number } {
  if (member.leftAt) {
    const left = monthKey(member.leftAt);
    // Never extend beyond the reporting period.
    if (
      left.year < period.endYear ||
      (left.year === period.endYear && left.month <= period.endMonth)
    ) {
      return left;
    }
  }
  return { year: period.endYear, month: period.endMonth };
}

/**
 * The months a member is liable to pay for, inside the reporting period.
 *
 * This is the month-by-month form of the liability window, and the arrears
 * engine needs the individual months rather than a count. A member who has
 * paid three months of a three-month window has not necessarily paid the
 * three months that were DUE -- they may have paid the two months before
 * they joined. Counting months instead of comparing them against the window
 * produced a false "100% compliant, K0 arrears" for a member who had not
 * paid October, and it would have kept doing so for every late joiner.
 */
export function liabilityMonths(
  member: MemberRecord,
  period: ReportPeriod,
): { year: number; month: number }[] {
  const start = eligibilityStart(member);
  const end = eligibilityEnd(member, period);

  // Overlap the member's liability window with the reporting period.
  const startYear = Math.max(start.year, period.startYear);
  const startMonth =
    start.year > period.startYear
      ? start.month
      : start.year === period.startYear
        ? Math.max(start.month, period.startMonth)
        : period.startMonth;

  const endYear = Math.min(end.year, period.endYear);
  const endMonth =
    end.year < period.endYear
      ? end.month
      : end.year === period.endYear
        ? Math.min(end.month, period.endMonth)
        : period.endMonth;

  if (startYear > endYear) return [];
  if (startYear === endYear && startMonth > endMonth) return [];

  const months: { year: number; month: number }[] = [];
  let year = startYear;
  let month = startMonth;
  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push({ year, month });
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return months;
}

/**
 * How many months within the reporting period this member was liable to pay.
 */
export function monthsDueFor(
  member: MemberRecord,
  period: ReportPeriod,
): number {
  return liabilityMonths(member, period).length;
}

/**
 * Build the full report.
 *
 * @param members    every member on the register (active and left)
 * @param contributions every contribution row for the period
 * @param period     the reporting window
 * @param monthlyContribution per-member monthly amount (defaults to config)
 */
export function buildContributionReport(
  members: MemberRecord[],
  contributions: ContributionRecord[],
  period: ReportPeriod,
  monthlyContribution: number = config.monthlyContributionPerMember,
): ContributionReport {
  // Index contributions by member so we don't rescan the array per member.
  //
  // Only contributions INSIDE the reporting period are indexed. The report
  // must not depend on the caller having pre-filtered the rows: monthsPaid
  // used to count every month a member had ever paid, which would have
  // inflated "months paid" and made arrears look better than they were
  // whenever a caller passed a wider set than the period.
  //
  // The amount is kept per month rather than only the month set, so money
  // received for a month the member was NOT liable for can be reported
  // separately instead of quietly disappearing.
  const byMember = new Map<string, { months: Map<string, number>; sum: number }>();

  for (const c of contributions) {
    if (!isMonthInPeriod(c.year, c.month, period)) continue;
    const key = `${c.year}-${c.month}`;
    let agg = byMember.get(c.memberId);
    if (!agg) {
      agg = { months: new Map<string, number>(), sum: 0 };
      byMember.set(c.memberId, agg);
    }
    agg.months.set(key, (agg.months.get(key) ?? 0) + c.amount);
    agg.sum += c.amount;
  }

  const rows: ContributionReportRow[] = members.map((member) => {
    // The months this member was actually liable for.
    const window = liabilityMonths(member, period);
    const monthsDue = window.length;
    const windowKeys = new Set(window.map((m) => `${m.year}-${m.month}`));

    const agg = byMember.get(member.id);
    let monthsPaid = 0;
    let receivedBeforeJoining = 0;
    if (agg) {
      for (const [key, amount] of agg.months) {
        if (windowKeys.has(key)) {
          monthsPaid += 1;
        } else {
          receivedBeforeJoining += amount;
        }
      }
    }

    const contributed = agg ? agg.sum : 0;
    const monthsMissed = Math.max(0, monthsDue - monthsPaid);
    const expected = monthsDue * monthlyContribution;
    const arrears = monthsMissed * monthlyContribution;
    const compliance =
      monthsDue > 0 ? Math.round((monthsPaid / monthsDue) * 100) : 100;

    return {
      memberId: member.id,
      serviceNumber: member.serviceNumber,
      fullName: member.fullName,
      rank: member.rank,
      status: member.isActive ? ('Active' as const) : ('Left' as const),
      isFoundingMember: member.isFoundingMember,
      monthsDue,
      monthsPaid,
      monthsMissed,
      receivedBeforeJoining,
      expected,
      contributed,
      arrears,
      compliance,
    };
  });

  // Worst arrears first, then alphabetical -- this is the order the committee
  // needs to read it in.
  rows.sort((a, b) => {
    if (b.arrears !== a.arrears) return b.arrears - a.arrears;
    return a.fullName.localeCompare(b.fullName);
  });

  const totals = rows.reduce(
    (acc, r) => {
      acc.members += 1;
      acc.monthsDue += r.monthsDue;
      acc.monthsPaid += r.monthsPaid;
      acc.monthsMissed += r.monthsMissed;
      acc.receivedBeforeJoining += r.receivedBeforeJoining;
      acc.expected += r.expected;
      acc.contributed += r.contributed;
      acc.arrears += r.arrears;
      return acc;
    },
    {
      members: 0,
      monthsDue: 0,
      monthsPaid: 0,
      monthsMissed: 0,
      receivedBeforeJoining: 0,
      expected: 0,
      contributed: 0,
      arrears: 0,
      compliance: 0,
    },
  );
  totals.compliance =
    totals.monthsDue > 0
      ? Math.round((totals.monthsPaid / totals.monthsDue) * 100)
      : 100;

  return { rows, totals, period, monthlyContribution };
}

/** The all-time period: from the cooperative's first month to the current one. */
export function allTimePeriod(now: Date = new Date()): ReportPeriod {
  const start = monthKey(config.cooperativeStartDate);
  const end = monthKey(now);
  return {
    startYear: start.year,
    startMonth: start.month,
    endYear: end.year,
    endMonth: end.month,
  };
}

/**
 * A single calendar year.
 *
 * `asOf` caps the period at the month that has already happened. Without it
 * the period runs to December, which counts a month that has not occurred yet
 * as due: on 1 November 2026 the year view was showing December 2026 as
 * unpaid for every member, adding K100 of phantom arrears to each of the 67
 * members and overstating expected collections by K6,300.
 *
 * The all-time view already stops at the current month (see `allTimePeriod`),
 * so the year view now behaves the same way. Pass the current date at the
 * call sites; omit it only where a whole calendar year is wanted.
 */
export function yearPeriod(year: number, asOf?: Date): ReportPeriod {
  if (!asOf) {
    return { startYear: year, startMonth: 1, endYear: year, endMonth: 12 };
  }
  const currentYear = asOf.getFullYear();
  if (year > currentYear) {
    // A year that has not started yet: nothing is due.
    return { startYear: year, startMonth: 1, endYear: year, endMonth: 0 };
  }
  const endMonth = year === currentYear ? asOf.getMonth() + 1 : 12;
  return { startYear: year, startMonth: 1, endYear: year, endMonth };
}

/** Escape a value for CSV output. */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Render the report as CSV, with a totals row at the end. */
export function reportToCsv(
  report: ContributionReport,
  currencyPrefix = 'K',
): string {
  const header = [
    'Service Number',
    'Name',
    'Rank',
    'Status',
    'Founding Member',
    'Months Due',
    'Months Paid',
    'Months Missed',
    'Received Before Joining',
    `Expected (${currencyPrefix})`,
    `Contributed (${currencyPrefix})`,
    `Arrears (${currencyPrefix})`,
    'Compliance %',
  ];

  const lines: string[] = [header.map(csvCell).join(',')];

  for (const r of report.rows) {
    lines.push(
      [
        r.serviceNumber,
        r.fullName,
        r.rank ?? '',
        r.status,
        r.isFoundingMember ? 'Yes' : 'No',
        r.monthsDue,
        r.monthsPaid,
        r.monthsMissed,
        r.receivedBeforeJoining.toFixed(2),
        r.expected.toFixed(2),
        r.contributed.toFixed(2),
        r.arrears.toFixed(2),
        r.compliance,
      ]
        .map(csvCell)
        .join(','),
    );
  }

  const t = report.totals;
  lines.push(
    [
      'TOTAL',
      `${t.members} members`,
      '',
      '',
      '',
      t.monthsDue,
      t.monthsPaid,
      t.monthsMissed,
      t.receivedBeforeJoining.toFixed(2),
      t.expected.toFixed(2),
      t.contributed.toFixed(2),
      t.arrears.toFixed(2),
      t.compliance,
    ]
      .map(csvCell)
      .join(','),
  );

  return lines.join('\r\n');
}
