import { requireUser } from '@/lib/auth/require-user';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { canViewAllMembers, canActAs } from '@/lib/permissions';
import { config } from '@/lib/config';
import {
  buildContributionReport,
  allTimePeriod,
  yearPeriod,
} from '@/lib/contribution-report';
import { Download, FileBarChart, AlertTriangle } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ year?: string }>;
}

export default async function ContributionsReportPage({ searchParams }: PageProps) {
  const user = await requireUser();
  if (!canActAs(user, canViewAllMembers)) {
    redirect('/dashboard');
  }

  const sp = await searchParams;
  const now = new Date();
  const currentYear = now.getFullYear();

  // "all" = every month since the cooperative started.
  const selectedYear = sp.year && sp.year !== 'all' ? Number(sp.year) : null;
  const period = selectedYear ? yearPeriod(selectedYear, now) : allTimePeriod(now);

  // Only the contributions inside the period are needed.
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
      orderBy: { fullName: 'asc' },
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

  const t = report.totals;
  const periodLabel = selectedYear
    ? String(selectedYear)
    : `${period.startYear}-${period.endYear}`;

  const years = [currentYear, currentYear - 1, currentYear - 2].filter(
    (y) => y >= config.cooperativeStartDate.getFullYear(),
  );

  const exportHref = `/api/reports/contributions?year=${selectedYear ?? 'all'}`;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
            <FileBarChart className="h-6 w-6 shrink-0" />
            Contributions Report
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Every member&apos;s contributions to date &middot; {periodLabel}
          </p>
        </div>
        <Button asChild variant="outline" className="shrink-0">
          <Link href={exportHref} prefetch={false}>
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Link>
        </Button>
      </div>

      {/* Period filter */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Reporting period</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex gap-2 flex-wrap items-end">
            <div className="space-y-1">
              <label htmlFor="year" className="text-xs text-muted-foreground">
                Period
              </label>
              <select
                id="year"
                name="year"
                defaultValue={selectedYear ? String(selectedYear) : 'all'}
                className="flex h-10 rounded-md border border-input bg-background px-3 text-sm min-h-[44px]"
              >
                <option value="all">All time</option>
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit">Apply</Button>
          </form>
        </CardContent>
      </Card>

      {/* Totals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Contributed</CardDescription>
            <CardTitle className="text-xl md:text-2xl text-navy-700">
              {formatCurrency(t.contributed)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Expected</CardDescription>
            <CardTitle className="text-xl md:text-2xl">
              {formatCurrency(t.expected)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Arrears</CardDescription>
            <CardTitle
              className={`text-xl md:text-2xl ${t.arrears > 0 ? 'text-destructive' : 'text-emerald-700'}`}
            >
              {formatCurrency(t.arrears)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Compliance</CardDescription>
            <CardTitle className="text-xl md:text-2xl">{t.compliance}%</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {t.arrears > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 text-amber-800 text-sm border border-amber-200">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            {t.monthsMissed} member-month{t.monthsMissed === 1 ? '' : 's'} are
            unpaid, totalling {formatCurrency(t.arrears)}. Members are sorted
            with the largest arrears first.
          </span>
        </div>
      )}

      {/* Per-member table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Per-member breakdown</CardTitle>
          <CardDescription>
            {t.members} members &middot; {t.monthsPaid} of {t.monthsDue}{' '}
            member-months paid
          </CardDescription>
        </CardHeader>
        <CardContent>
          {report.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service #</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Due</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Contributed</TableHead>
                  <TableHead>Arrears</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.rows.map((r) => (
                  <TableRow key={r.memberId}>
                    <TableCell className="font-mono text-xs whitespace-nowrap">
                      {r.serviceNumber}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{r.fullName}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.rank ?? ''}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {r.monthsDue} mth
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {r.monthsPaid} mth
                    </TableCell>
                    <TableCell className="font-semibold whitespace-nowrap">
                      {formatCurrency(r.contributed)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {r.arrears > 0 ? (
                        <span className="font-semibold text-destructive">
                          {formatCurrency(r.arrears)}
                        </span>
                      ) : (
                        <span className="text-emerald-700">
                          {formatCurrency(0)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.status === 'Active' ? (
                        <Badge variant="success">{r.compliance}%</Badge>
                      ) : (
                        <Badge variant="outline">Left</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Expected = {formatCurrency(report.monthlyContribution)} per member per
        month. A member is liable from the month they joined (or the
        cooperative&apos;s first month for founding members) until the month
        they left, or the end of the reporting period. The current month is
        included.
      </p>
    </div>
  );
}
