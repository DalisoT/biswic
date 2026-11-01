/**
 * Unit tests for the per-member contributions report engine.
 *
 * Arrears are money owed to the cooperative, so the arithmetic that produces
 * them is verified here rather than being trusted.
 */

import { describe, it, expect } from 'vitest';
import { config } from '../../src/lib/config';
import {
  buildContributionReport,
  monthsBetween,
  monthsDueFor,
  eligibilityStart,
  liabilityMonths,
  firstLiableMonth,
  reportToCsv,
  yearPeriod,
  allTimePeriod,
  type MemberRecord,
  type ContributionRecord,
  type ReportPeriod,
} from '../../src/lib/contribution-report';

/**
 * A local-time date.
 *
 * A bare '2026-03-01' date string is parsed as UTC midnight, which is 29
 * February in any timezone west of UTC, so a member "joining in March" would
 * silently be treated as a February member. These tests are about which MONTH
 * a member belongs in, so the dates are built in the runner's local time.
 */
function localDate(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

function member(overrides: Partial<MemberRecord> = {}): MemberRecord {
  return {
    id: 'm1',
    serviceNumber: '106759',
    fullName: 'TEMBO RICHARD',
    rank: 'CHAIRMAN',
    isActive: true,
    isFoundingMember: true,
    joinedAt: localDate(2025, 1, 1),
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

describe('the cooperative start month', () => {
  it('is July 2026 -- the founding register month', () => {
    // The founding register was signed 22 July 2026 (Constitution Art. 2.2)
    // and the first money in the ledger is July 2026 (49 of 60 paid, K5,000,
    // receipts dated 15 July 2026). Nothing was ever collected before then.
    //
    // The placeholder that used to live here was 1 January 2025. It billed
    // every founding member for 18 months that never happened -- K113,400 of
    // the K129,900 "arrears" the report claimed. The chairman confirmed
    // July 2026 as the cooperative's first contribution month on 2026-11-01.
    expect(config.cooperativeStartDate.toISOString().slice(0, 7)).toBe('2026-07');
    // This is the month the report engine actually bills a founding member from.
    expect(eligibilityStart(member())).toEqual({ year: 2026, month: 7 });
  });

  it('caps a founding member at the months that have actually happened', () => {
    // July..November 2026 inclusive.
    expect(monthsDueFor(member(), allTimePeriod(localDate(2026, 11, 1)))).toBe(5);
  });
});

describe('eligibilityStart', () => {
  it('uses the cooperative start month for founding members', () => {
    const m = member({ isFoundingMember: true, joinedAt: localDate(2025, 9, 9) });
    expect(eligibilityStart(m)).toEqual({ year: 2026, month: 7 });
  });

  it('uses the joining month for everyone else', () => {
    const m = member({ isFoundingMember: false, joinedAt: localDate(2026, 3, 17) });
    expect(eligibilityStart(m)).toEqual({ year: 2026, month: 3 });
  });
});

describe('monthsDueFor', () => {
  const period = yearPeriod(2026);

  it('counts from the cooperative start month for a founding member', () => {
    // The period is the whole of 2026, but the cooperative did not exist
    // before July 2026, so January..June can never be owed.
    expect(monthsDueFor(member(), period)).toBe(6); // July..December
  });

  it('counts from the joining month for a new member', () => {
    const m = member({ isFoundingMember: false, joinedAt: localDate(2026, 3, 17) });
    expect(monthsDueFor(m, period)).toBe(10); // March..December
  });

  it('stops at the leaving month', () => {
    const m = member({ leftAt: localDate(2026, 9, 30) });
    expect(monthsDueFor(m, period)).toBe(3); // July..September
  });

  it('never extends past the reporting period', () => {
    const m = member();
    expect(monthsDueFor(m, yearPeriod(2026, localDate(2026, 9, 1)))).toBe(3);
  });

  it('is zero for a member who joined after the period', () => {
    const m = member({ isFoundingMember: false, joinedAt: localDate(2027, 1, 5) });
    expect(monthsDueFor(m, period)).toBe(0);
  });
});

describe('buildContributionReport', () => {
  const period = yearPeriod(2026);

  it('reports a fully paid member with no arrears', () => {
    const contributions = Array.from({ length: 6 }, (_, i) =>
      contribution('m1', 2026, i + 7),
    );
    const report = buildContributionReport([member()], contributions, period);

    const row = report.rows[0];
    expect(row.monthsDue).toBe(6);
    expect(row.monthsPaid).toBe(6);
    expect(row.monthsMissed).toBe(0);
    expect(row.expected).toBe(600);
    expect(row.contributed).toBe(600);
    expect(row.arrears).toBe(0);
    expect(row.compliance).toBe(100);
  });

  it('counts missed months as arrears', () => {
    // Paid July, August, then skipped September..December.
    const contributions = [
      contribution('m1', 2026, 7),
      contribution('m1', 2026, 8),
    ];
    const report = buildContributionReport([member()], contributions, period);

    const row = report.rows[0];
    expect(row.monthsDue).toBe(6);
    expect(row.monthsPaid).toBe(2);
    expect(row.monthsMissed).toBe(4);
    expect(row.arrears).toBe(400);
    expect(row.compliance).toBe(33); // 2/6 rounded
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
    const m = member({
      isFoundingMember: false,
      joinedAt: localDate(2026, 1, 1),
    });
    const contributions = [
      contribution('m1', 2025, 12), // before the period
      contribution('m1', 2026, 1), // inside
      contribution('m1', 2026, 2), // inside
    ];
    const report = buildContributionReport([m], contributions, period);

    expect(report.rows[0].monthsPaid).toBe(2);
    expect(report.rows[0].monthsMissed).toBe(10);
    expect(report.rows[0].contributed).toBe(200);
  });

  it('counts payments across a multi-year period', () => {
    // An explicit multi-year window. The member is NOT a founding member, so
    // they owe from the month they joined (January 2025), not from the
    // cooperative's first month (July 2026).
    const multiYear: ReportPeriod = {
      startYear: 2025,
      startMonth: 1,
      endYear: 2026,
      endMonth: 11,
    };
    const m = member({
      isFoundingMember: false,
      joinedAt: localDate(2025, 1, 1),
    });
    const contributions = [
      contribution('m1', 2025, 3),
      contribution('m1', 2025, 4),
      contribution('m1', 2026, 1),
    ];
    const report = buildContributionReport([m], contributions, multiYear);

    expect(report.rows[0].monthsPaid).toBe(3);
    expect(report.rows[0].contributed).toBe(300);
    // Jan 2025 to Nov 2026 is 23 months, of which 3 were paid.
    expect(report.rows[0].monthsDue).toBe(23);
    expect(report.rows[0].monthsMissed).toBe(20);
  });

  it('counts each month once even if a duplicate row is supplied', () => {
    const m = member({
      isFoundingMember: false,
      joinedAt: localDate(2026, 1, 1),
    });
    const contributions = [
      contribution('m1', 2026, 1),
      contribution('m1', 2026, 1, 250), // same month, different amount
    ];
    const report = buildContributionReport([m], contributions, period);
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
      joinedAt: localDate(2026, 11, 1),
    });
    const report = buildContributionReport([m2, m1], [], period);
    expect(report.rows[0].serviceNumber).toBe('A1');
    expect(report.rows[0].arrears).toBeGreaterThan(report.rows[1].arrears);
  });

  it('marks members who have left', () => {
    const m = member({ isActive: false, leftAt: localDate(2026, 4, 30) });
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
      joinedAt: localDate(2026, 3, 1),
    });
    const contributions = [contribution('a', 2026, 7)];
    const report = buildContributionReport([m1, m2], contributions, period);

    expect(report.totals.members).toBe(2);
    expect(report.totals.monthsDue).toBe(6 + 10);
    expect(report.totals.monthsPaid).toBe(1);
    expect(report.totals.contributed).toBe(100);
    expect(report.totals.arrears).toBe(500 + 1000);
  });

  it('handles a member with no contributions at all', () => {
    const report = buildContributionReport([member()], [], period);
    expect(report.rows[0].monthsPaid).toBe(0);
    expect(report.rows[0].arrears).toBe(600);
    expect(report.rows[0].compliance).toBe(0);
  });

  it('does not count a payment for a month before the member joined', () => {
    // The Mphande George case: joined 6 September 2026, so he owes
    // September, October and November. He paid in July, August and
    // September. Counting the payments instead of comparing them with the
    // months he actually owed made him look 100% compliant with K0 arrears
    // when he had not paid for October at all.
    const m = member({
      isFoundingMember: false,
      joinedAt: localDate(2026, 9, 6),
    });
    const contributions = [
      contribution('m1', 2026, 7),
      contribution('m1', 2026, 8),
      contribution('m1', 2026, 9),
    ];
    const report = buildContributionReport(
      [m],
      contributions,
      allTimePeriod(localDate(2026, 11, 1)),
    );

    const row = report.rows[0];
    expect(row.monthsDue).toBe(3); // September..November
    expect(row.monthsPaid).toBe(1); // only September
    expect(row.monthsMissed).toBe(2); // October and November
    expect(row.arrears).toBe(200);
    expect(row.compliance).toBe(33);
    // The July and August money is real, so it is reported -- not hidden and
    // not quietly used to cancel the months he actually owes.
    expect(row.receivedBeforeJoining).toBe(200);
    expect(row.contributed).toBe(300);
  });

  it('does not let money paid before joining hide a later shortfall', () => {
    // The same member pays July and August but never September. He owes
    // three months and has paid none of them.
    const m = member({
      isFoundingMember: false,
      joinedAt: localDate(2026, 9, 6),
    });
    const contributions = [
      contribution('m1', 2026, 7),
      contribution('m1', 2026, 8),
    ];
    const report = buildContributionReport(
      [m],
      contributions,
      allTimePeriod(localDate(2026, 11, 1)),
    );

    const row = report.rows[0];
    expect(row.monthsPaid).toBe(0);
    expect(row.monthsMissed).toBe(3);
    expect(row.arrears).toBe(300);
    expect(row.receivedBeforeJoining).toBe(200);
  });
});

describe('liabilityMonths', () => {
  it('lists the months a founding member owes', () => {
    expect(liabilityMonths(member(), yearPeriod(2026))).toEqual([
      { year: 2026, month: 7 },
      { year: 2026, month: 8 },
      { year: 2026, month: 9 },
      { year: 2026, month: 10 },
      { year: 2026, month: 11 },
      { year: 2026, month: 12 },
    ]);
  });

  it('lists the months a late joiner owes', () => {
    const m = member({
      isFoundingMember: false,
      joinedAt: localDate(2026, 9, 6),
    });
    expect(liabilityMonths(m, yearPeriod(2026))).toEqual([
      { year: 2026, month: 9 },
      { year: 2026, month: 10 },
      { year: 2026, month: 11 },
      { year: 2026, month: 12 },
    ]);
  });

  it('is empty for a member who joined after the period', () => {
    const m = member({
      isFoundingMember: false,
      joinedAt: localDate(2027, 1, 5),
    });
    expect(liabilityMonths(m, yearPeriod(2026))).toEqual([]);
  });
});

describe('firstLiableMonth', () => {
  it('is the cooperative start month for founding members', () => {
    expect(firstLiableMonth(member())).toEqual({ year: 2026, month: 7 });
  });

  it('is the joining month for everyone else', () => {
    const m = member({
      isFoundingMember: false,
      joinedAt: localDate(2026, 9, 6),
    });
    expect(firstLiableMonth(m)).toEqual({ year: 2026, month: 9 });
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
    expect(yearPeriod(2026, localDate(2026, 11, 1))).toEqual({
      startYear: 2026,
      startMonth: 1,
      endYear: 2026,
      endMonth: 11,
    });
  });

  it('yearPeriod runs a finished year to December', () => {
    expect(yearPeriod(2025, localDate(2026, 11, 1))).toEqual({
      startYear: 2025,
      startMonth: 1,
      endYear: 2025,
      endMonth: 12,
    });
  });

  it('yearPeriod owes nothing for a year that has not started', () => {
    const period = yearPeriod(2027, localDate(2026, 11, 1));
    expect(period.endMonth).toBe(0);
    expect(monthsDueFor(member(), period)).toBe(0);
  });

  it('does not count a future month as due for a founding member', () => {
    const period = yearPeriod(2026, localDate(2026, 11, 1));
    expect(monthsDueFor(member(), period)).toBe(5); // July..November
  });

  it('still counts a joining month that has passed', () => {
    const period = yearPeriod(2026, localDate(2026, 11, 1));
    const m = member({ isFoundingMember: false, joinedAt: localDate(2026, 3, 17) });
    expect(monthsDueFor(m, period)).toBe(9); // March..November
  });

  it('matches the all-time view at the end of the year', () => {
    const asOf = localDate(2026, 12, 20);
    const year = yearPeriod(2026, asOf);
    const allTime = allTimePeriod(asOf);
    expect(year.endYear).toBe(allTime.endYear);
    expect(year.endMonth).toBe(allTime.endMonth);
  });

  it('allTimePeriod starts at the cooperative start month', () => {
    const p = allTimePeriod(localDate(2026, 9, 15));
    expect(p.startYear).toBe(2026);
    expect(p.startMonth).toBe(7);
    expect(p.endYear).toBe(2026);
    expect(p.endMonth).toBe(9);
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
