import type { ReportPeriod } from './contribution-report';

/**
 * The shape of a contribution filter, described independently of Prisma so
 * the rule can be unit tested without a database or a generated client.
 * It is structurally assignable to Prisma's `ContributionWhereInput`.
 */
export interface ContributionPeriodWhere {
  year?: number | { gt?: number; gte?: number; lt?: number; lte?: number };
  month?: number | { gt?: number; gte?: number; lt?: number; lte?: number };
  OR?: ContributionPeriodWhere[];
}

/**
 * The one place that knows how to turn a reporting period into a database
 * filter for contributions.
 *
 * The report page and the CSV export both used to carry their own copy of
 * this filter, and both copies were wrong in the same way. The filter they
 * used was:
 *
 *   year: { gte: startYear, lte: endYear },
 *   AND: [
 *     { year: startYear, month: { gte: startMonth } },
 *     { year: endYear,   month: { lte: endMonth }   },
 *   ]
 *
 * Those two AND clauses pin `year` to two different values. A contribution
 * row has exactly one year, so nothing can satisfy both of them. For a
 * period that spans more than one year -- which the default "All time" view
 * does, 2025-01 to 2026-11 -- the query returned ZERO rows, the report
 * showed "Contributed K0" and billed all 67 members K2,300 each in arrears.
 *
 * A single-year period was unaffected because both clauses collapsed onto
 * the same year, which is why the bug survived so long: the broken view was
 * the default one nobody had opened.
 *
 * The shape below must agree with `isMonthInPeriod` in
 * src/lib/contribution-report.ts. tests/unit/contribution-period-filter.test.ts
 * checks that they agree for every month in a multi-year grid.
 */
export function contributionPeriodWhere(
  period: ReportPeriod,
): ContributionPeriodWhere {
  const { startYear, startMonth, endYear, endMonth } = period;

  // A single-year period has to be expressed as one month range. Splitting
  // it into a "from" edge and a "to" edge would over-match, and an empty
  // period (a year that has not started, where endMonth is 0) would then
  // match every month of that year.
  if (startYear === endYear) {
    return {
      year: startYear,
      month: { gte: startMonth, lte: endMonth },
    };
  }

  return {
    OR: [
      // Years strictly between the first and the last: every month counts.
      { year: { gt: startYear, lt: endYear } },
      // First year: from the start month onwards.
      { year: startYear, month: { gte: startMonth } },
      // Last year: up to the end month.
      { year: endYear, month: { lte: endMonth } },
    ],
  };
}
