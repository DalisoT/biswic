import { requireUser } from '@/lib/auth/require-user';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate, monthName } from '@/lib/utils';
import { canViewAllMembers, canRecordContributions } from '@/lib/permissions';
import { config } from '@/lib/config';
import Link from 'next/link';
import { Upload, FileText } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ month?: string; year?: string }>;
}

export default async function FinanceContributionsPage({ searchParams }: PageProps) {
  const user = await requireUser();
  if (!canViewAllMembers(user.role)) {
    redirect('/dashboard');
  }

  const sp = await searchParams;
  const now = new Date();
  const month = sp.month ? Number(sp.month) : now.getMonth() + 1;
  const year = sp.year ? Number(sp.year) : now.getFullYear();

  const [contribs, monthAgg, totalActive] = await Promise.all([
    prisma.contribution.findMany({
      where: { month, year },
      orderBy: { receivedAt: 'desc' },
      include: {
        member: { select: { serviceNumber: true, fullName: true, rank: true } },
        recordedBy: { select: { fullName: true, serviceNumber: true } },
      },
    }),
    prisma.contribution.aggregate({
      where: { month, year },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.user.count({ where: { isActive: true } }),
  ]);

  const totalReceived = Number(monthAgg._sum.amount ?? 0);
  const expected = totalActive * config.monthlyContributionPerMember;
  const payerRate = totalActive > 0 ? (monthAgg._count / totalActive) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Contributions · {monthName(month)} {year}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {monthAgg._count} of {totalActive} paid · {formatCurrency(totalReceived)} of {formatCurrency(expected)} ({payerRate.toFixed(0)}%)
          </p>
        </div>
        {canRecordContributions(user.role) && (
          <Button asChild>
            <Link href="/finance/contributions/import">
              <Upload className="h-4 w-4 mr-1" />
              Import payroll schedule
            </Link>
          </Button>
        )}
      </div>

      {/* Month filter */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filter</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex gap-2 flex-wrap items-end">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Month</label>
              <select
                name="month"
                defaultValue={month}
                className="flex h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>{monthName(m)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Year</label>
              <select
                name="year"
                defaultValue={year}
                className="flex h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {[2025, 2026, 2027, 2028].map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <Button type="submit">Apply</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All contributions · {monthName(month)} {year}</CardTitle>
        </CardHeader>
        <CardContent>
          {contribs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No contributions recorded for {monthName(month)} {year}.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service #</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Receipt</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Recorded by</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contribs.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{c.member.serviceNumber}</TableCell>
                    <TableCell>
                      <div className="font-medium">{c.member.fullName}</div>
                      <div className="text-xs text-muted-foreground">{c.member.rank ?? ''}</div>
                    </TableCell>
                    <TableCell className="font-semibold">{formatCurrency(Number(c.amount))}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{c.paymentMethod.replace('_', ' ')}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.receiptNumber ?? '—'}</TableCell>
                    <TableCell className="text-xs">{formatDate(c.receivedAt)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.recordedBy.fullName}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
