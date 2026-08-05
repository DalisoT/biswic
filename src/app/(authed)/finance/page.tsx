import { requireUser } from '@/lib/auth/require-user';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate, monthName } from '@/lib/utils';
import { canRecordContributions, canViewAllMembers } from '@/lib/permissions';
import { config } from '@/lib/config';
import Link from 'next/link';
import { Coins, AlertCircle, Upload, FileText, Wallet, Briefcase, Heart, Stethoscope, Building2, LineChart, PiggyBank } from 'lucide-react';
import { bucketColor } from '@/lib/buckets';

export const dynamic = 'force-dynamic';

const BUCKET_ICONS: Record<string, typeof Coins> = {
  LAND: Building2,
  BUSINESS: Briefcase,
  FUNERAL: Heart,
  MEDICAL: Stethoscope,
  ADMIN: LineChart,
  SOFT_LOANS: PiggyBank,
};

export default async function FinanceDashboardPage() {
  const user = await requireUser();
  if (!canViewAllMembers(user.role)) {
    redirect('/dashboard');
  }

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const [buckets, monthContribs, allTime, defaulters] = await Promise.all([
    prisma.bucket.findMany({ orderBy: { code: 'asc' } }),
    prisma.contribution.findMany({
      where: { month, year },
      select: { id: true, memberId: true, amount: true, receivedAt: true, paymentMethod: true, member: { select: { serviceNumber: true, fullName: true } } },
      orderBy: { receivedAt: 'desc' },
      take: 50,
    }),
    prisma.contribution.aggregate({ _sum: { amount: true }, _count: true }),
    prisma.user.findMany({
      where: {
        isActive: true,
        joinedAt: { lte: new Date(year, month - 1, 1) },
        contributions: { none: { month, year } },
      },
      select: { serviceNumber: true, fullName: true, rank: true },
      take: 10,
    }),
  ]);

  const totalBucketBalance = buckets.reduce((s, b) => s + Number(b.balance), 0);
  const monthReceived = monthContribs.reduce((s, c) => s + Number(c.amount), 0);
  const totalActiveMembers = await prisma.user.count({ where: { isActive: true } });
  const expectedThisMonth = totalActiveMembers * config.monthlyContributionPerMember;
  const payerRate = totalActiveMembers > 0 ? monthContribs.length / totalActiveMembers : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
            <Wallet className="h-6 w-6" />
            Finance
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {monthName(month)} {year} · {totalActiveMembers} active members
          </p>
        </div>
        {canRecordContributions(user.role) && (
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/finance/contributions">
                <FileText className="h-4 w-4 mr-1" />
                All contributions
              </Link>
            </Button>
            <Button asChild>
              <Link href="/finance/contributions/import">
                <Upload className="h-4 w-4 mr-1" />
                Import payroll schedule
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* This month snapshot */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>This month received</CardDescription>
            <CardTitle className="text-2xl text-emerald-600">{formatCurrency(monthReceived)}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            of {formatCurrency(expectedThisMonth)} expected ({Math.round(payerRate * 100)}% paid)
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Payers this month</CardDescription>
            <CardTitle className="text-2xl">{monthContribs.length} <span className="text-base text-muted-foreground">/ {totalActiveMembers}</span></CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            {defaulters.length} member{defaulters.length !== 1 ? 's' : ''} haven&apos;t paid yet
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total bucket balance</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(totalBucketBalance)}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            Across {buckets.length} buckets
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>All-time contributions</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(Number(allTime._sum.amount ?? 0))}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            {allTime._count} contribution{allTime._count !== 1 ? 's' : ''} recorded
          </CardContent>
        </Card>
      </div>

      {/* Bucket balances */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bucket balances</CardTitle>
          <CardDescription>Constitution Art. 4.1 mix · {config.buckets.LAND_CAPITAL.percentage}% / {config.buckets.BUSINESS_SEED.percentage}% / {config.buckets.FUNERAL.percentage}% / {config.buckets.SOFT_LOANS.percentage}% / {config.buckets.ADMIN.percentage}% / {config.buckets.MEDICAL.percentage}%</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {buckets.map((b) => {
              const Icon = BUCKET_ICONS[b.code] ?? Coins;
              return (
                <div
                  key={b.id}
                  className="rounded-md border p-3 flex flex-col gap-1"
                  style={{ borderLeftColor: bucketColor(b.code), borderLeftWidth: 4 }}
                >
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Icon className="h-3.5 w-3.5" />
                    {b.name}
                  </div>
                  <div className="text-lg font-bold">{formatCurrency(Number(b.balance))}</div>
                  <div className="text-[10px] text-muted-foreground">{Number(b.percentage) * 100}% allocation</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent payments this month */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent · {monthName(month)} {year}</CardTitle>
          </CardHeader>
          <CardContent>
            {monthContribs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No contributions yet this month.</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {monthContribs.map((c) => (
                  <div key={c.id} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                    <div>
                      <div className="font-medium">{c.member.fullName}</div>
                      <div className="text-xs text-muted-foreground font-mono">{c.member.serviceNumber} · {c.paymentMethod.replace('_', ' ')}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatCurrency(Number(c.amount))}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(c.receivedAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Defaulters this month */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              Haven&apos;t paid {monthName(month)} yet
            </CardTitle>
            <CardDescription>{defaulters.length} of {totalActiveMembers} active member{totalActiveMembers !== 1 ? 's' : ''}</CardDescription>
          </CardHeader>
          <CardContent>
            {defaulters.length === 0 ? (
              <p className="text-sm text-emerald-600 font-medium">Everyone&apos;s paid! 🎉</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service #</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Rank</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {defaulters.map((d) => (
                    <TableRow key={d.serviceNumber}>
                      <TableCell className="font-mono text-xs">{d.serviceNumber}</TableCell>
                      <TableCell>{d.fullName}</TableCell>
                      <TableCell className="text-xs">{d.rank ?? '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
