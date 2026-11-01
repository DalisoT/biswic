/**
 * Unit tests for the contributions-report period filter.
 *
 * THE BUG THIS FILE EXISTS FOR
 * ----------------------------
 * The report shipped (7c892bb) with this filter:
 *
 *   where: {
 *     year: { gte: startYear, lte: endYear },
 *     AND: [
 *       { year: startYear, month: { gte: startMonth } },
 *       { year: endYear,   month: { lte: endMonth }   },
 *     ],
 *   }
 *
 * Those two AND clauses pin `year` to two DIFFERENT values. A contribution
 * row has exactly one year, so no row can ever satisfy both of them.
 *
 * For the default "All time" view (2025-01 to 2026-11) the query therefore
 * returned ZERO rows, always. Expected was still computed from the roster
 * (correct), but contributed came from an empty list, so the report showed
 * "Contributed K0", 0% compliance and billed all 67 members K2,300 each in
 * arrears -- K146,300 that does not exist.
 *
 * The single-year view was unaffected because both clauses collapsed onto
 * the same year, which is why the bug survived: the one view nobody looked
 * at was the broken one.
 *
 * The filter lives in one shared module now, because it was duplicated
 * verbatim in the page and in the CSV export and both had to be wrong in
 * exactly the same way.
 */

import { describe, it, expect } from 'vitest';
import { contributionPeriodWhere } from '../../src/lib/contribution-period-filter';
import { isMonthInPeriod, type ReportPeriod } from '../../src/lib/contribution-report';

/* -------------------------------------------------------------------------
   A tiny evaluator for the { year, month } filters Prisma accepts, so the
   tests check what the filter actually MATCHES rather than how it is
   spelled. It understands the subset of operators the filter may use.
   ------------------------------------------------------------------------- */

type NumFilter = number | { gt?: number; gte?: number; lt?: number; lte?: number };

interface Clause {
  year?: NumFilter;
  month?: NumFilter;
}

interface Where extends Clause {
  OR?: Clause[];
  AND?: Clause[];
}

function matchesNum(value: number, filter: NumFilter): boolean {
  if (typeof filter === 'number') return value === filter;
  if (filter.gt !== undefined && !(value > filter.gt)) return false;
  if (filter.gte !== undefined && !(value >= filter.gte)) return false;
  if (filter.lt !== undefined && !(value < filter.lt)) return false;
  if (filter.lte !== undefined && !(value <= filter.lte)) return false;
  return true;
}

function matchesClause(row: { year: number; month: number }, clause: Clause): boolean {
  if (clause.year !== undefined && !matchesNum(row.year, clause.year)) return false;
  if (clause.month !== undefined && !matchesNum(row.month, clause.month)) return false;
  return true;
}

function matchesWhere(row: { year: number; month: number }, where: Where): boolean {
  if (where.OR && !where.OR.some((c) => matchesClause(row, c))) return false;
  if (where.AND && !where.AND.every((c) => matchesClause(row, c))) return false;
  if (where.year !== undefined && !matchesNum(row.year, where.year)) return false;
  if (where.month !== undefined && !matchesNum(row.month, where.month)) return false;
  return true;
}

/** The filter exactly as it shipped in 7c892bb, for the regression check. */
function brokenAllTimeFilter(period: ReportPeriod): Where {
  return {
    year: { gte: period.startYear, lte: period.endYear },
    AND: [
      { year: period.startYear, month: { gte: period.startMonth } },
      { year: period.endYear, month: { lte: period.endMonth } },
    ],
  };
}

const ALL_TIME: ReportPeriod = {
  startYear: 2025,
  startMonth: 1,
  endYear: 2026,
  endMonth: 11,
};

const YEAR_2026: ReportPeriod = {
  startYear: 2026,
  startMonth: 1,
  endYear: 2026,
  endMonth: 11,
};

describe('contributionPeriodWhere', () => {
  it('matches contributions in BOTH years of an all-time period', () => {
    const where = contributionPeriodWhere(ALL_TIME);

    expect(matchesWhere({ year: 2025, month: 1 }, where)).toBe(true);
    expect(matchesWhere({ year: 2025, month: 7 }, where)).toBe(true);
    expect(matchesWhere({ year: 2025, month: 12 }, where)).toBe(true);
    expect(matchesWhere({ year: 2026, month: 1 }, where)).toBe(true);
    expect(matchesWhere({ year: 2026, month: 11 }, where)).toBe(true);
  });

  it('excludes months outside an all-time period', () => {
    const where = contributionPeriodWhere(ALL_TIME);

    expect(matchesWhere({ year: 2024, month: 12 }, where)).toBe(false);
    expect(matchesWhere({ year: 2026, month: 12 }, where)).toBe(false);
    expect(matchesWhere({ year: 2027, month: 1 }, where)).toBe(false);
  });

  it('regression: the filter that shipped matched nothing at all', () => {
    // This is what the report was doing before the fix. If this ever starts
    // matching rows again, the two filters have converged by accident and
    // the shared-module rule has been broken.
    const broken = brokenAllTimeFilter(ALL_TIME);

    expect(matchesWhere({ year: 2025, month: 3 }, broken)).toBe(false);
    expect(matchesWhere({ year: 2026, month: 3 }, broken)).toBe(false);
  });

  it('agrees with isMonthInPeriod for every month in a three-year grid', () => {
    const where = contributionPeriodWhere(ALL_TIME);

    for (let year = 2024; year <= 2027; year++) {
      for (let month = 1; month <= 12; month++) {
        const row = { year, month };
        expect(
          matchesWhere(row, where),
          `filter disagreed at ${year}-${month}`,
        ).toBe(isMonthInPeriod(year, month, ALL_TIME));
      }
    }
  });

  it('still handles a single-year period', () => {
    const where = contributionPeriodWhere(YEAR_2026);

    expect(matchesWhere({ year: 2026, month: 1 }, where)).toBe(true);
    expect(matchesWhere({ year: 2026, month: 11 }, where)).toBe(true);
    expect(matchesWhere({ year: 2026, month: 12 }, where)).toBe(false);
    expect(matchesWhere({ year: 2025, month: 6 }, where)).toBe(false);
  });

  it('matches nothing for a period that has not started', () => {
    // yearPeriod() for a future year returns endMonth 0, so the period is
    // empty and no contribution can fall inside it.
    const empty: ReportPeriod = {
      startYear: 2027,
      startMonth: 1,
      endYear: 2027,
      endMonth: 0,
    };
    const where = contributionPeriodWhere(empty);

    for (let month = 1; month <= 12; month++) {
      expect(matchesWhere({ year: 2027, month }, where)).toBe(false);
    }
  });
});
