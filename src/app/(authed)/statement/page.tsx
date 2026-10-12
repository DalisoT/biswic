import { requireUser } from '@/lib/auth/require-user';
import { prisma } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate, monthName, computeMonthlyInflow, sumField, toNumber } from '@/lib/utils';
import { config } from '@/lib/config';
import { PrintButton } from '@/components/shared/print-button';

export const dynamic = 'force-dynamic';

export default async function StatementPage() {
  const currentUser = await requireUser();

  const user = await prisma.user.findUnique({
    where: { id: currentUser.id },
    select: { serviceNumber: true, fullName: true, rank: true, unit: true, joinedAt: true },
  });
  if (!user) return null;

  const now = new Date();
  const currentYear = now.getFullYear();

  const contributions = await prisma.contribution.findMany({
    where: { memberId: currentUser.id },
    orderBy: [{ year: 'asc' }, { month: 'asc' }],
  });

  const totalContributions = sumField(contributions, (c) => c.amount);

  const claims = await prisma.welfareClaim.findMany({
    where: { memberId: currentUser.id },
    orderBy: { createdAt: 'desc' },
  });

  const claimedPaid = sumField(
    claims.filter((c) => c.status === 'PAID'),
    (c) => c.amountApproved ?? 0,
  );

  const activeMemberCount = await prisma.user.count({ where: { isActive: true, role: 'MEMBER' } });
  const monthlyInflow = computeMonthlyInflow(activeMemberCount);

  // YTD
  const ytdContributions = contributions.filter((c) => c.year === currentYear);
  const ytdTotal = sumField(ytdContributions, (c) => c.amount);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-2xl font-bold font-heading">My Statement</h1>
          <p className="text-sm text-muted-foreground mt-1">Personal financial summary</p>
        </div>
        <PrintButton />
      </div>

      <Card className="print:shadow-none print:border-0">
        <CardHeader>
          <CardTitle>{config.cooperativeShortName} — Member Statement</CardTitle>
          <CardDescription>
            {user.fullName} · {user.serviceNumber} · {user.rank ?? '—'} · {user.unit ?? '—'}
          </CardDescription>
          <CardDescription>Generated on {formatDate(now)}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div>
              <div className="text-xs text-muted-foreground">Member since</div>
              <div className="font-semibold">{formatDate(user.joinedAt)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total contributions</div>
              <div className="font-semibold text-navy-700">{formatCurrency(totalContributions)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">YTD contributions</div>
              <div className="font-semibold">{formatCurrency(ytdTotal)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Welfare received (life)</div>
              <div className="font-semibold text-gold-600">{formatCurrency(claimedPaid)}</div>
            </div>
          </div>

          <h3 className="font-semibold mt-6 mb-2">Contribution history</h3>
          {contributions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No contributions recorded.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Receipt</TableHead>
                  <TableHead>Date received</TableHead>
                  <TableHead>Method</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contributions.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{monthName(c.month)} {c.year}</TableCell>
                    <TableCell>{formatCurrency(toNumber(c.amount))}</TableCell>
                    <TableCell className="text-xs">{c.receiptNumber ?? '—'}</TableCell>
                    <TableCell className="text-xs">{formatDate(c.receivedAt)}</TableCell>
                    <TableCell><Badge variant="outline">{c.paymentMethod.replace('_', ' ')}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <h3 className="font-semibold mt-6 mb-2">Welfare claims history</h3>
          {claims.length === 0 ? (
            <p className="text-sm text-muted-foreground">No claims submitted.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Event date</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Approved</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {claims.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell><Badge variant={c.type === 'FUNERAL' ? 'secondary' : 'outline'}>{c.type}</Badge></TableCell>
                    <TableCell className="text-xs">{formatDate(c.eventDate)}</TableCell>
                    <TableCell>{formatCurrency(toNumber(c.amountRequested))}</TableCell>
                    <TableCell>{c.amountApproved ? formatCurrency(toNumber(c.amountApproved)) : '—'}</TableCell>
                    <TableCell>
                      <Badge variant={
                        c.status === 'PAID' ? 'success' :
                        c.status === 'APPROVED' ? 'default' :
                        c.status === 'REJECTED' ? 'destructive' : 'warning'
                      }>{c.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <div className="mt-8 pt-4 border-t text-xs text-muted-foreground">
            <p>This is a computer-generated statement. The cooperative&apos;s monthly inflow is {formatCurrency(monthlyInflow)} ({activeMemberCount} × {formatCurrency(config.monthlyContributionPerMember)}).</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
