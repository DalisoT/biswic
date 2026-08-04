import { requireUser } from '@/lib/auth/require-user';
import { prisma } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDate } from '@/lib/utils';
import { config } from '@/lib/config';
import { ArrowLeft, AlertTriangle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

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

export default async function SoftLoanDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const loan = await prisma.softLoan.findUnique({
    where: { id: params.id },
    include: {
      repayments: { orderBy: { dueDate: 'asc' } },
      applicant: { select: { serviceNumber: true, fullName: true, id: true } },
    },
  });
  if (!loan) notFound();
  if (loan.applicantId !== user.id) {
    return <div className="text-center py-12"><p>You can only view your own loans.</p></div>;
  }

  const isLate = (dueDate: Date, paidAt: Date | null) => !paidAt && new Date(dueDate) < new Date();
  const totalPaid = loan.repayments.reduce(
    (s, r) => s + Number(r.paidPrincipal ?? 0) + Number(r.paidInterest ?? 0),
    0,
  );
  const totalOwed = Number(loan.totalRepayment) - totalPaid;
  const missedCount = loan.repayments.filter((r) => r.missed).length;
  const isDefaulted = loan.status === 'DEFAULTED';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/soft-loans"><ArrowLeft className="h-4 w-4 mr-1" /> Back to soft loans</Link>
      </Button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">Soft Loan</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Applied {formatDate(loan.appliedAt)} · ID {loan.id.slice(0, 8)}
          </p>
        </div>
        <Badge variant={statusVariant[loan.status] ?? 'outline'}>{loan.status}</Badge>
      </div>

      {isDefaulted && (
        <Card className="border-destructive bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-base text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Loan in default
            </CardTitle>
            <CardDescription>
              {missedCount} repayment{missedCount !== 1 ? 's' : ''} missed. Constitution Art. 5.5(f): you are
              ineligible for new soft loans. Outstanding balance may be deducted from future welfare
              payouts with your written consent. The case has been referred to the Committee.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Principal" value={formatCurrency(loan.principal)} />
          <Row label="Interest rate" value={`${(Number(loan.interestRate) * 100).toFixed(2)}% p.a.`} />
          <Row label="Term" value={`${loan.termMonths} months`} />
          <Row label="Total to repay" value={formatCurrency(loan.totalRepayment)} />
          <Row label="Monthly payment" value={formatCurrency(loan.monthlyPayment)} />
          <Row label="Total paid" value={formatCurrency(totalPaid)} />
          <Row label="Outstanding balance" value={<span className="font-semibold">{formatCurrency(Number(loan.balance))}</span>} />
          {loan.disbursedAt && <Row label="Disbursed" value={formatDate(loan.disbursedAt)} />}
          {loan.completedAt && <Row label="Completed" value={formatDate(loan.completedAt)} />}
          {loan.defaultedAt && <Row label="Defaulted" value={formatDate(loan.defaultedAt)} />}
          {loan.rejectionReason && (
            <Row label="Rejection reason" value={<span className="text-destructive">{loan.rejectionReason}</span>} />
          )}
        </CardContent>
        <CardContent className="border-t pt-3">
          <div className="text-xs text-muted-foreground">Purpose</div>
          <p className="text-sm mt-1">{loan.purpose}</p>
        </CardContent>
      </Card>

      {/* Sub-committee approvals */}
      {(loan.status === 'PENDING' || loan.status === 'APPROVED') && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lending Sub-Committee approvals</CardTitle>
            <CardDescription>
              Constitution Art. 5.5(d): {config.softLoans.requiredApprovals} of 3 required. If the
              applicant is a Sub-Committee member, the other {config.softLoans.requiredApprovals} must approve.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              <SigBlock label="Chair (FW)" ts={loan.chairApprovedAt} />
              <SigBlock label="Member 1" ts={loan.member1ApprovedAt} />
              <SigBlock label="Member 2" ts={loan.member2ApprovedAt} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Repayment schedule */}
      {loan.repayments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Repayment schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b">
                  <th className="text-left py-2">Due</th>
                  <th className="text-right py-2">Expected</th>
                  <th className="text-right py-2">Paid</th>
                  <th className="text-center py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {loan.repayments.map((r) => {
                  const late = isLate(r.dueDate, r.paidAt);
                  return (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="py-2">{formatDate(r.dueDate)}</td>
                      <td className="text-right py-2">
                        {formatCurrency(Number(r.expectedPrincipal) + Number(r.expectedInterest))}
                      </td>
                      <td className="text-right py-2">
                        {r.paidAt
                          ? formatCurrency(Number(r.paidPrincipal ?? 0) + Number(r.paidInterest ?? 0))
                          : '—'}
                      </td>
                      <td className="text-center py-2">
                        {r.paidAt ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700">
                            <CheckCircle2 className="h-3 w-3" /> Paid
                          </span>
                        ) : r.missed || late ? (
                          <span className="inline-flex items-center gap-1 text-destructive">
                            <XCircle className="h-3 w-3" /> {r.missed ? 'Missed' : 'Late'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <Clock className="h-3 w-3" /> Pending
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="text-muted-foreground">{label}</div>
      <div className="col-span-2">{value}</div>
    </div>
  );
}

function SigBlock({ label, ts }: { label: string; ts: Date | null }) {
  return (
    <div className="flex items-center gap-2 p-3 border rounded-md">
      {ts ? (
        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
      ) : (
        <Clock className="h-5 w-5 text-muted-foreground" />
      )}
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-medium">{ts ? formatDate(ts) : 'Pending'}</div>
      </div>
    </div>
  );
}
