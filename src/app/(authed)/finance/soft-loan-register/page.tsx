import { requireUser } from '@/lib/auth/require-user';
import { prisma } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { canViewAllMembers } from '@/lib/permissions';
import { HandCoins, BookText } from 'lucide-react';
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

export default async function SoftLoanRegisterPage() {
  const user = await requireUser();
  if (!canViewAllMembers(user.role) && user.role !== 'TREASURER' && user.role !== 'DEPUTY_TREASURER') {
    return <div className="text-center py-12"><p>You do not have permission to view this page.</p></div>;
  }

  const [loans, bucket, summary] = await Promise.all([
    prisma.softLoan.findMany({
      orderBy: { createdAt: 'desc' },
      include: { applicant: { select: { serviceNumber: true, fullName: true, rank: true, unit: true } } },
    }),
    prisma.bucket.findUnique({ where: { code: 'SOFT_LOANS' } }),
    prisma.softLoan.aggregate({
      _sum: { principal: true, totalRepayment: true, balance: true },
      _count: true,
    }),
  ]);

  const totalDisbursed = Number(summary._sum.principal ?? 0);
  const totalExpected = Number(summary._sum.totalRepayment ?? 0);
  const totalOutstanding = Number(summary._sum.balance ?? 0);
  const totalRepaid = totalExpected - totalOutstanding;
  const defaultedCount = loans.filter((l) => l.status === 'DEFAULTED').length;
  const activeCount = loans.filter((l) => ['PENDING', 'APPROVED', 'DISBURSED', 'REPAYING'].includes(l.status)).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
          <BookText className="h-6 w-6" />
          Soft Loan Register
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Constitution Art. 5.5(g) - maintained by the Deputy Treasurer, reconciled by the Finance Warrant.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Bucket balance</CardDescription>
            <CardTitle className="text-2xl">{bucket ? formatCurrency(bucket.balance) : '—'}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total disbursed</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(totalDisbursed)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total repaid</CardDescription>
            <CardTitle className="text-2xl text-emerald-700">{formatCurrency(totalRepaid)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Outstanding</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(totalOutstanding)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Active / Defaulted</CardDescription>
            <CardTitle className="text-2xl">{activeCount} / <span className="text-destructive">{defaultedCount}</span></CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Register */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All loans</CardTitle>
        </CardHeader>
        <CardContent>
          {loans.length === 0 ? (
            <div className="text-center py-12">
              <HandCoins className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <p className="text-muted-foreground mt-2">No loans yet.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Applied</TableHead>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Principal</TableHead>
                  <TableHead>Total repay</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Disbursed</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loans.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs">{formatDate(l.appliedAt)}</TableCell>
                    <TableCell>
                      <div className="font-medium">{l.applicant.serviceNumber}</div>
                      <div className="text-xs text-muted-foreground">{l.applicant.fullName}</div>
                    </TableCell>
                    <TableCell>{formatCurrency(l.principal)}</TableCell>
                    <TableCell>{formatCurrency(l.totalRepayment)}</TableCell>
                    <TableCell className="font-medium">{formatCurrency(l.balance)}</TableCell>
                    <TableCell className="text-xs">
                      {l.disbursedAt ? formatDate(l.disbursedAt) : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[l.status] ?? 'outline'}>{l.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Link href={`/finance/soft-loan-applications/${l.id}`} className="text-xs text-navy-700 hover:underline">
                        View
                      </Link>
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
