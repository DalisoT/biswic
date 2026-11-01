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
  /** Months in the period with a recorded contribution. */
  monthsPaid: number;
  /** Months due with no contribution recorded. */
  monthsMissed: number;
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
 * The first month a member is liable to pay for.
 * Founding members are on the register from the cooperative's first month;
 * everyone else from the month they joined.
 */
export function eligibilityStart(member: MemberRecord): {
  year: number;
  month: number;
} {
  if (member.isFoundingMember) {
    return monthKey(config.cooperativeStartDate);
  }
  return monthKey(member.joinedAt);
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
 * How many months within the reporting period this member was liable to pay.
 */
export function monthsDueFor(
  member: MemberRecord,
  period: ReportPeriod,
): number {
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

  if (startYear > endYear) return 0;
  if (startYear === endYear && startMonth > endMonth) return 0;

  return monthsBetween(startYear, startMonth, endYear, endMonth);
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
  const byMember = new Map<string, { months: Set<string>; sum: number; rows: ContributionRecord[] }>();

  for (const c of contributions) {
    const key = `${c.year}-${c.month}`;
    let agg = byMember.get(c.memberId);
    if (!agg) {
      agg = { months: new Set<string>(), sum: 0, rows: [] };
      byMember.set(c.memberId, agg);
    }
    agg.months.add(key);
    agg.sum += c.amount;
    agg.rows.push(c);
  }

  const rows: ContributionReportRow[] = members.map((member) => {
    const monthsDue = monthsDueFor(member, period);
    const agg = byMember.get(member.id);
    const monthsPaid = agg ? agg.months.size : 0;

    // Only count payments that fall inside the reporting period.
    const contributed = agg
      ? agg.rows
          .filter(
            (c) =>
              c.year >= period.startYear &&
              c.year <= period.endYear &&
              (c.year > period.startYear || c.month >= period.startMonth) &&
              (c.year < period.endYear || c.month <= period.endMonth),
          )
          .reduce((sum, c) => sum + c.amount, 0)
      : 0;

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
