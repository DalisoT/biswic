import { requireUser } from '@/lib/auth/require-user';
import { prisma } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate, toNumber } from '@/lib/utils';
import { checkLoanEligibility, getOutstandingLoan } from '@/server/services/soft-loan-service';
import { config } from '@/lib/config';
import { HandCoins, Plus, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'outline'> = {
  PENDING: 'warning',
  APPROVED: 'default',
  REJECTED: 'destructive',
  DISBURSED: 'default',
  REPAYING: 'secondary',
  COMPLETED: 'success',
  DEFAULTED: 'destructive',
};

export default async function SoftLoansPage() {
  const user = await requireUser();

  const [loans, eligibility, outstanding] = await Promise.all([
    prisma.softLoan.findMany({
      where: { applicantId: user.id },
      orderBy: { createdAt: 'desc' },
      include: { repayments: { orderBy: { dueDate: 'asc' } } },
    }),
    checkLoanEligibility(user.id),
    getOutstandingLoan(user.id),
  ]);

  const activeCount = loans.filter(
    (l) => !['REJECTED', 'COMPLETED'].includes(l.status)
  ).length;
  const totalRepaid = loans.reduce(
    (s, l) =>
      s +
      l.repayments.reduce((rs, r) => rs + Number(r.paidPrincipal ?? 0) + Number(r.paidInterest ?? 0), 0),
    0,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">Soft Loans</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Max K{config.softLoans.maxPrincipal.toLocaleString()} per loan · up to {config.softLoans.maxTermMonths} months ·{' '}
            {(config.softLoans.interestRatePerAnnum * 100).toFixed(0)}% p.a.
          </p>
        </div>
        {eligibility.eligible ? (
          <Button asChild>
            <Link href="/soft-loans/apply">
              <Plus className="h-4 w-4 mr-1" />
              Apply for a loan
            </Link>
          </Button>
        ) : (
          <Button disabled variant="secondary">
            <AlertCircle className="h-4 w-4 mr-1" />
            Not eligible
          </Button>
        )}
      </div>

      {/* Eligibility card */}
      {!eligibility.eligible && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-base text-amber-800">You are not eligible for a new loan</CardTitle>
            <CardDescription className="text-amber-700">
              {eligibility.reasons.join(' ')}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active loans</CardDescription>
            <CardTitle className="text-2xl">{activeCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total loans</CardDescription>
            <CardTitle className="text-2xl">{loans.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Outstanding balance</CardDescription>
            <CardTitle className="text-2xl">
              {outstanding ? formatCurrency(toNumber(outstanding.balance)) : 'K0.00'}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total repaid (all time)</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(totalRepaid)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Loans list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">My loans</CardTitle>
        </CardHeader>
        <CardContent>
          {loans.length === 0 ? (
            <div className="text-center py-12">
              <HandCoins className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <p className="text-muted-foreground mt-2">No loans yet.</p>
              {eligibility.eligible && (
                <Button asChild variant="link">
                  <Link href="/soft-loans/apply">Apply for your first loan</Link>
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Applied</TableHead>
                  <TableHead>Principal</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead>Total repay</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loans.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs">{formatDate(l.appliedAt)}</TableCell>
                    <TableCell>{formatCurrency(toNumber(l.principal))}</TableCell>
                    <TableCell>{l.termMonths} mo</TableCell>
                    <TableCell>{formatCurrency(toNumber(l.totalRepayment))}</TableCell>
                    <TableCell>{formatCurrency(toNumber(l.balance))}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[l.status] ?? 'outline'}>{l.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/soft-loans/${l.id}`}>View</Link>
                      </Button>
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
