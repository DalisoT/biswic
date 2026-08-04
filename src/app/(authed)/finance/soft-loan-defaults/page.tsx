import { requireUser } from '@/lib/auth/require-user';
import { prisma } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate } from '@/lib/utils';
import { canViewAllMembers } from '@/lib/permissions';
import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { RunDefaultDetectionButton } from '@/components/soft-loans/run-default-detection-button';

export const dynamic = 'force-dynamic';

export default async function SoftLoanDefaultsPage() {
  const user = await requireUser();
  if (!canViewAllMembers(user.role) && user.role !== 'TREASURER' && user.role !== 'DEPUTY_TREASURER') {
    return <div className="text-center py-12"><p>You do not have permission to view this page.</p></div>;
  }

  const defaulted = await prisma.softLoan.findMany({
    where: { status: 'DEFAULTED' },
    orderBy: { defaultedAt: 'desc' },
    include: {
      applicant: { select: { serviceNumber: true, fullName: true, rank: true, unit: true } },
      repayments: { where: { missed: true }, orderBy: { dueDate: 'asc' } },
    },
  });

  const totalOutstanding = defaulted.reduce((s, l) => s + Number(l.balance), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-destructive" />
          Defaulted Soft Loans
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Constitution Art. 5.5(f): a loan is in default after 2 missed monthly payments. Defaulted
          members are ineligible for new loans; their welfare payouts may be offset by the
          outstanding balance with their written consent; the case is referred to the Committee.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monthly default detection</CardTitle>
          <CardDescription>
            Run on the 6th of each month (after salary-deducted repayments have cleared). When a Supabase
            cron is wired up, this button becomes a fallback.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RunDefaultDetectionButton />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Total defaulted outstanding</CardDescription>
          <CardTitle className="text-2xl text-destructive">{formatCurrency(totalOutstanding)}</CardTitle>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Defaulted loans</CardTitle>
          <CardDescription>{defaulted.length} loan{defaulted.length !== 1 ? 's' : ''} in default</CardDescription>
        </CardHeader>
        <CardContent>
          {defaulted.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No defaulted loans. 🎉</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Defaulted</TableHead>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Principal</TableHead>
                  <TableHead>Outstanding</TableHead>
                  <TableHead>Missed repayments</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {defaulted.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs">{formatDate(l.defaultedAt)}</TableCell>
                    <TableCell>
                      <div className="font-medium">{l.applicant.serviceNumber}</div>
                      <div className="text-xs text-muted-foreground">{l.applicant.fullName}</div>
                    </TableCell>
                    <TableCell>{formatCurrency(l.principal)}</TableCell>
                    <TableCell className="font-semibold text-destructive">{formatCurrency(l.balance)}</TableCell>
                    <TableCell>
                      <Badge variant="destructive">{l.repayments.length}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                      {l.defaultedReason ?? '—'}
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
