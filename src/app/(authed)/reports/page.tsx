import { requireUser } from '@/lib/auth/require-user';
import { canActAs, canActAsAnyRole, canViewReconciliation } from '@/lib/permissions';
import { prisma } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency, computeMonthlyInflow, sumField } from '@/lib/utils';
import { config } from '@/lib/config';
import { redirect } from 'next/navigation';
import { BucketBars } from '@/components/dashboard/bucket-bars';
import { KittyScopeNote } from '@/components/buckets/kitty-scope-note';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const user = await requireUser();

  const allowedRoles = ['FW', 'CHAIRPERSON', 'TREASURER', 'DEPUTY_TREASURER'];
  if (!canActAsAnyRole(user, allowedRoles)) {
    redirect('/dashboard');
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [allBuckets, contributionsThisYear, activeMemberCount] = await Promise.all([
    // Active buckets only — closed FUNERAL/MEDICAL are kept in the DB for
    // audit but hidden from operational views.
    prisma.bucket.findMany({ orderBy: { code: 'asc' } }),
    prisma.contribution.findMany({
      where: { year: currentYear },
      include: { member: { select: { serviceNumber: true, fullName: true } } },
    }),
    prisma.user.count({ where: { isActive: true, role: 'MEMBER' } }),
  ]);

  const buckets = allBuckets.filter((b) => b.isActive);
  const closedBuckets = allBuckets
    .filter((b) => !b.isActive)
    .map((b) => ({ code: b.code, balance: Number(b.balance) }));
  const totalKitty = sumField(buckets, (b) => b.balance);
  const totalContributionsThisYear = sumField(contributionsThisYear, (c) => c.amount);

  // Monthly breakdown
  const monthlyBreakdown: Array<{ month: number; total: number; count: number }> = [];
  for (let m = 1; m <= 12; m++) {
    const monthContribs = contributionsThisYear.filter((c) => c.month === m);
    monthlyBreakdown.push({
      month: m,
      total: sumField(monthContribs, (c) => c.amount),
      count: monthContribs.length,
    });
  }

  const monthlyInflow = computeMonthlyInflow(activeMemberCount);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading">Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">Financial year {currentYear}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total kitty (active buckets)</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(totalKitty)}</CardTitle>
            <KittyScopeNote closed={closedBuckets} showReconciliationCard={canActAs(user, canViewReconciliation)} />
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Contributions YTD</CardDescription>
            <CardTitle className="text-2xl text-navy-700">{formatCurrency(totalContributionsThisYear)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active members</CardDescription>
            <CardTitle className="text-2xl">{activeMemberCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bucket balances</CardTitle>
        </CardHeader>
        <CardContent>
          <BucketBars buckets={buckets.map((b) => ({
            code: b.code,
            name: b.name,
            balance: b.balance,
            percentage: b.percentage,
          }))} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monthly collection</CardTitle>
          <CardDescription>
            Expected per month: {formatCurrency(monthlyInflow)} ({activeMemberCount} × {formatCurrency(config.monthlyContributionPerMember)})
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead>Members paid</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>vs expected</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyBreakdown.map((m) => {
                const expected = monthlyInflow;
                const pct = expected > 0 ? Math.round((m.total / expected) * 100) : 0;
                return (
                  <TableRow key={m.month}>
                    <TableCell>{new Date(currentYear, m.month - 1, 1).toLocaleDateString('en-GB', { month: 'long' })}</TableCell>
                    <TableCell>{m.count}</TableCell>
                    <TableCell>{formatCurrency(m.total)}</TableCell>
                    <TableCell>
                      <span className={pct >= 95 ? 'text-emerald-700' : pct >= 80 ? 'text-amber-700' : 'text-rose-700'}>
                        {pct}%
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

    </div>
  );
}
