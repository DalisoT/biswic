import { requireUser } from '@/lib/auth/require-user';
import { prisma } from '@/lib/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate, monthName } from '@/lib/utils';
import { canRecordContributions, canViewAllMembers } from '@/lib/permissions';
import { AddContributionForm } from '@/components/contributions/add-contribution-form';
import { BulkContributionForm } from '@/components/contributions/bulk-contribution-form';
import { config } from '@/lib/config';

export const dynamic = 'force-dynamic';

export default async function ContributionsPage() {
  const user = await requireUser();

  const role = user.role;
  const canRecord = canRecordContributions(role);
  const canViewAll = canViewAllMembers(role);

  const myContributions = await prisma.contribution.findMany({
    where: { memberId: user.id },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
    include: { member: { select: { serviceNumber: true, fullName: true } } },
  });

  const totalContributions = myContributions.reduce((s, c) => s + c.amount, 0);

  // For officers: arrears list
  const activeMemberCount = await prisma.user.count({
    where: { isActive: true, role: 'MEMBER' },
  });

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const recentContributions = await prisma.contribution.findMany({
    where: { month: currentMonth, year: currentYear },
    take: 50,
    orderBy: { receivedAt: 'desc' },
    include: { member: { select: { serviceNumber: true, fullName: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading">{canViewAll ? 'Contributions' : 'My Contributions'}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {canViewAll
            ? `${activeMemberCount} active members · ${formatCurrency(config.monthlyContributionPerMember)} per member per month`
            : 'Track your monthly contributions'}
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total paid</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(totalContributions)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Months paid</CardDescription>
            <CardTitle className="text-2xl">{myContributions.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Expected monthly</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(config.monthlyContributionPerMember)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Add contribution (officers only) */}
      {canRecord && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AddContributionForm />
          <BulkContributionForm />
        </div>
      )}

      {/* My contribution history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{canViewAll ? `Recent contributions · ${monthName(currentMonth)} ${currentYear}` : 'My contribution history'}</CardTitle>
        </CardHeader>
        <CardContent>
          {myContributions.length === 0 && recentContributions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No contributions yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  {canViewAll && <TableHead>Member</TableHead>}
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Receipt</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(canViewAll ? recentContributions : myContributions).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{monthName(c.month)} {c.year}</TableCell>
                    {canViewAll && (
                      <TableCell>
                        <div className="font-medium">{('member' in c) ? c.member.serviceNumber : ''}</div>
                        <div className="text-xs text-muted-foreground">{('member' in c) ? c.member.fullName : ''}</div>
                      </TableCell>
                    )}
                    <TableCell className="font-semibold">{formatCurrency(c.amount)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{c.paymentMethod.replace('_', ' ')}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{c.receiptNumber ?? '—'}</TableCell>
                    <TableCell className="text-xs">{formatDate(c.receivedAt)}</TableCell>
                    <TableCell>
                      <Badge variant="success">PAID</Badge>
                    </TableCell>
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
