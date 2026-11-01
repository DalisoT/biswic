/**
 * Unit tests for the per-member contributions report engine.
 *
 * Arrears are money owed to the cooperative, so the arithmetic that produces
 * them is verified here rather than being trusted.
 */

import { describe, it, expect } from 'vitest';
import {
  buildContributionReport,
  monthsBetween,
  monthsDueFor,
  eligibilityStart,
  reportToCsv,
  yearPeriod,
  allTimePeriod,
  type MemberRecord,
  type ContributionRecord,
} from '../../src/lib/contribution-report';

function member(overrides: Partial<MemberRecord> = {}): MemberRecord {
  return {
    id: 'm1',
    serviceNumber: '106759',
    fullName: 'TEMBO RICHARD',
    rank: 'CHAIRMAN',
    isActive: true,
    isFoundingMember: true,
    joinedAt: new Date('2025-01-01'),
    leftAt: null,
    ...overrides,
  };
}

function contribution(
  memberId: string,
  year: number,
  month: number,
  amount = 100,
): ContributionRecord {
  return { memberId, year, month, amount };
}

describe('monthsBetween', () => {
  it('counts inclusively', () => {
    expect(monthsBetween(2026, 1, 2026, 1)).toBe(1);
    expect(monthsBetween(2026, 1, 2026, 12)).toBe(12);
    expect(monthsBetween(2026, 1, 2027, 1)).toBe(13);
  });

  it('returns 0 when the end precedes the start', () => {
    expect(monthsBetween(2026, 6, 2026, 5)).toBe(0);
    expect(monthsBetween(2027, 1, 2026, 1)).toBe(0);
  });
});

describe('eligibilityStart', () => {
  it('uses the cooperative start month for founding members', () => {
    const m = member({ isFoundingMember: true, joinedAt: new Date('2025-09-09') });
    expect(eligibilityStart(m)).toEqual({ year: 2025, month: 1 });
  });

  it('uses the joining month for everyone else', () => {
    const m = member({ isFoundingMember: false, joinedAt: new Date('2026-03-17') });
    expect(eligibilityStart(m)).toEqual({ year: 2026, month: 3 });
  });
});

describe('monthsDueFor', () => {
  const period = yearPeriod(2026);

  it('counts the whole year for a founding member', () => {
    expect(monthsDueFor(member(), period)).toBe(12);
  });

  it('counts from the joining month for a new member', () => {
    const m = member({ isFoundingMember: false, joinedAt: new Date('2026-03-17') });
    expect(monthsDueFor(m, period)).toBe(10); // March..December
  });

  it('stops at the leaving month', () => {
    const m = member({ leftAt: new Date('2026-05-30') });
    expect(monthsDueFor(m, period)).toBe(5); // January..May
  });

  it('never extends past the reporting period', () => {
    const m = member();
    expect(monthsDueFor(m, yearPeriod(2025))).toBe(12);
  });

  it('is zero for a member who joined after the period', () => {
    const m = member({ isFoundingMember: false, joinedAt: new Date('2027-01-05') });
    expect(monthsDueFor(m, period)).toBe(0);
  });
});

describe('buildContributionReport', () => {
  const period = yearPeriod(2026);

  it('reports a fully paid member with no arrears', () => {
    const contributions = Array.from({ length: 12 }, (_, i) =>
      contribution('m1', 2026, i + 1),
    );
    const report = buildContributionReport([member()], contributions, period);

    const row = report.rows[0];
    expect(row.monthsDue).toBe(12);
    expect(row.monthsPaid).toBe(12);
    expect(row.monthsMissed).toBe(0);
    expect(row.expected).toBe(1200);
    expect(row.contributed).toBe(1200);
    expect(row.arrears).toBe(0);
    expect(row.compliance).toBe(100);
  });

  it('counts missed months as arrears', () => {
    // Paid Jan, Feb, then skipped March..December.
    const contributions = [
      contribution('m1', 2026, 1),
      contribution('m1', 2026, 2),
    ];
    const report = buildContributionReport([member()], contributions, period);

    const row = report.rows[0];
    expect(row.monthsDue).toBe(12);
    expect(row.monthsPaid).toBe(2);
    expect(row.monthsMissed).toBe(10);
    expect(row.arrears).toBe(1000);
    expect(row.compliance).toBe(17); // 2/12 rounded
  });

  it('excludes contributions outside the reporting period', () => {
    const contributions = [
      contribution('m1', 2025, 12),
      contribution('m1', 2026, 1),
    ];
    const report = buildContributionReport([member()], contributions, period);
    expect(report.rows[0].contributed).toBe(100);
  });

  it('counts only in-period payments towards months paid', () => {
    // The report must not depend on the caller pre-filtering the rows.
    // monthsPaid used to count every month a member had ever paid.
    const contributions = [
      contribution('m1', 2025, 12), // before the period
      contribution('m1', 2026, 1), // inside
      contribution('m1', 2026, 2), // inside
    ];
    const report = buildContributionReport([member()], contributions, period);

    expect(report.rows[0].monthsPaid).toBe(2);
    expect(report.rows[0].monthsMissed).toBe(10);
    expect(report.rows[0].contributed).toBe(200);
  });

  it('counts payments across a multi-year period', () => {
    const allTime = allTimePeriod(new Date('2026-11-01'));
    const contributions = [
      contribution('m1', 2025, 3),
      contribution('m1', 2025, 4),
      contribution('m1', 2026, 1),
    ];
    const report = buildContributionReport([member()], contributions, allTime);

    expect(report.rows[0].monthsPaid).toBe(3);
    expect(report.rows[0].contributed).toBe(300);
    // Jan 2025 to Nov 2026 is 23 months, of which 3 were paid.
    expect(report.rows[0].monthsDue).toBe(23);
    expect(report.rows[0].monthsMissed).toBe(20);
  });

  it('counts each month once even if a duplicate row is supplied', () => {
    const contributions = [
      contribution('m1', 2026, 1),
      contribution('m1', 2026, 1, 250), // same month, different amount
    ];
    const report = buildContributionReport([member()], contributions, period);
    expect(report.rows[0].monthsPaid).toBe(1);
    // Both amounts still count towards the money actually received.
    expect(report.rows[0].contributed).toBe(350);
  });

  it('sorts the largest arrears first', () => {
    const m1 = member({ id: 'a', fullName: 'A', serviceNumber: 'A1' });
    const m2 = member({
      id: 'b',
      fullName: 'B',
      serviceNumber: 'B1',
      isFoundingMember: false,
      joinedAt: new Date('2026-11-01'),
    });
    const report = buildContributionReport([m2, m1], [], period);
    expect(report.rows[0].serviceNumber).toBe('A1');
    expect(report.rows[0].arrears).toBeGreaterThan(report.rows[1].arrears);
  });

  it('marks members who have left', () => {
    const m = member({ isActive: false, leftAt: new Date('2026-04-30') });
    const report = buildContributionReport([m], [], period);
    expect(report.rows[0].status).toBe('Left');
  });

  it('totals the rows', () => {
    const m1 = member({ id: 'a', fullName: 'A', serviceNumber: 'A1' });
    const m2 = member({
      id: 'b',
      fullName: 'B',
      serviceNumber: 'B1',
      isFoundingMember: false,
      joinedAt: new Date('2026-03-01'),
    });
    const contributions = [contribution('a', 2026, 1)];
    const report = buildContributionReport([m1, m2], contributions, period);

    expect(report.totals.members).toBe(2);
    expect(report.totals.monthsDue).toBe(12 + 10);
    expect(report.totals.monthsPaid).toBe(1);
    expect(report.totals.contributed).toBe(100);
    expect(report.totals.arrears).toBe(1100 + 1000);
  });

  it('handles a member with no contributions at all', () => {
    const report = buildContributionReport([member()], [], period);
    expect(report.rows[0].monthsPaid).toBe(0);
    expect(report.rows[0].arrears).toBe(1200);
    expect(report.rows[0].compliance).toBe(0);
  });
});

describe('periods', () => {
  it('yearPeriod spans the calendar year', () => {
    expect(yearPeriod(2026)).toEqual({
      startYear: 2026,
      startMonth: 1,
      endYear: 2026,
      endMonth: 12,
    });
  });

  it('yearPeriod stops at the month that has already happened', () => {
    // On 1 November 2026, December 2026 has not happened yet, so a member
    // cannot owe it. Before this, the year view counted December as due for
    // all 67 members and overstated expected collections by K6,300.
    expect(yearPeriod(2026, new Date('2026-11-01'))).toEqual({
      startYear: 2026,
      startMonth: 1,
      endYear: 2026,
      endMonth: 11,
    });
  });

  it('yearPeriod runs a finished year to December', () => {
    expect(yearPeriod(2025, new Date('2026-11-01'))).toEqual({
      startYear: 2025,
      startMonth: 1,
      endYear: 2025,
      endMonth: 12,
    });
  });

  it('yearPeriod owes nothing for a year that has not started', () => {
    const period = yearPeriod(2027, new Date('2026-11-01'));
    expect(period.endMonth).toBe(0);
    expect(monthsDueFor(member(), period)).toBe(0);
  });

  it('does not count a future month as due for a founding member', () => {
    const period = yearPeriod(2026, new Date('2026-11-01'));
    expect(monthsDueFor(member(), period)).toBe(11); // January..November
  });

  it('still counts a joining month that has passed', () => {
    const period = yearPeriod(2026, new Date('2026-11-01'));
    const m = member({ isFoundingMember: false, joinedAt: new Date('2026-03-17') });
    expect(monthsDueFor(m, period)).toBe(9); // March..November
  });

  it('matches the all-time view at the end of the year', () => {
    const asOf = new Date('2026, 12, 20');
    const year = yearPeriod(2026, asOf);
    const allTime = allTimePeriod(asOf);
    expect(year.endYear).toBe(allTime.endYear);
    expect(year.endMonth).toBe(allTime.endMonth);
  });

  it('allTimePeriod starts at the cooperative start month', () => {
    const p = allTimePeriod(new Date('2026, 5, 15'));
    expect(p.startYear).toBe(2025);
    expect(p.startMonth).toBe(1);
    expect(p.endYear).toBe(2026);
    expect(p.endMonth).toBe(5);
  });
});

describe('reportToCsv', () => {
  it('writes a header, one row per member and a totals row', () => {
    const report = buildContributionReport(
      [member()],
      [contribution('m1', 2026, 1)],
      yearPeriod(2026),
    );
    const csv = reportToCsv(report);
    const lines = csv.split('\r\n');

    expect(lines[0]).toContain('Service Number');
    expect(lines[0]).toContain('Arrears');
    expect(lines).toHaveLength(3); // header + member + totals
    expect(lines[2]).toContain('TOTAL');
  });

  it('escapes values containing commas or quotes', () => {
    const report = buildContributionReport(
      [member({ fullName: 'TEMBO, RICHARD "JR"' })],
      [],
      yearPeriod(2026),
    );
    const csv = reportToCsv(report);
    expect(csv).toContain('"TEMBO, RICHARD ""JR"""');
  });
});
