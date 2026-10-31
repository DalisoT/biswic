import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/require-user';
import { prisma } from '@/lib/db';
import { canViewAllMembers } from '@/lib/permissions';
import { config } from '@/lib/config';
import {
  buildContributionReport,
  allTimePeriod,
  yearPeriod,
  reportToCsv,
} from '@/lib/contribution-report';

export const dynamic = 'force-dynamic';

/**
 * CSV export of the per-member contributions report.
 *
 * Same permission gate as the on-screen report so the two can never diverge.
 */
export async function GET(request: Request) {
  const user = await requireUser();
  if (!canViewAllMembers(user.role)) {
    return NextResponse.json(
      { error: 'Not authorised to view the contributions report.' },
      { status: 403 },
    );
  }

  const url = new URL(request.url);
  const yearParam = url.searchParams.get('year');
  const now = new Date();

  let period;
  let label;
  if (yearParam && yearParam !== 'all') {
    const year = Number(yearParam);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ error: 'Invalid year.' }, { status: 400 });
    }
    period = yearPeriod(year);
    label = String(year);
  } else {
    period = allTimePeriod(now);
    label = `${period.startYear}-${period.endYear}`;
  }

  const [members, contributions] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        serviceNumber: true,
        fullName: true,
        rank: true,
        isActive: true,
        isFoundingMember: true,
        joinedAt: true,
        leftAt: true,
      },
    }),
    prisma.contribution.findMany({
      where: {
        year: { gte: period.startYear, lte: period.endYear },
        AND: [
          { year: period.startYear, month: { gte: period.startMonth } },
          { year: period.endYear, month: { lte: period.endMonth } },
        ],
      },
      select: { memberId: true, month: true, year: true, amount: true },
    }),
  ]);

  const report = buildContributionReport(
    members.map((m) => ({ ...m })),
    contributions.map((c) => ({ ...c, amount: Number(c.amount) })),
    period,
  );

  const csv = reportToCsv(report, config.currency);

  // Prepend a short provenance header so a downloaded file is self-describing.
  const header = [
    `# BISWIC Contributions Report`,
    `# Period: ${label}`,
    `# Generated: ${now.toISOString()}`,
    `# Members: ${report.totals.members} | Contributed: ${config.currency}${report.totals.contributed.toFixed(2)} | Arrears: ${config.currency}${report.totals.arrears.toFixed(2)}`,
    '',
  ].join('\r\n');

  const filename = `biswic-contributions-${label}.csv`;

  return new NextResponse(header + csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
