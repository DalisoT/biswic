'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { formatCurrency, formatDate } from '@/lib/utils';
import { approveLoanAction, rejectLoanAction, disburseLoanAction } from '@/server/actions/soft-loans';
import { ArrowLeft, CheckCircle2, AlertCircle, Clock, Send, XCircle } from 'lucide-react';
import Link from 'next/link';

interface LoanDetailForReviewProps {
  loan: {
    id: string;
    status: string;
    principal: number;
    interestRate: number;
    termMonths: number;
    monthlyPayment: number;
    totalRepayment: number;
    balance: number;
    purpose: string;
    conflictDeclared: boolean;
    appliedAt: Date;
    chairApprovedAt: Date | null;
    member1ApprovedAt: Date | null;
    member2ApprovedAt: Date | null;
    disbursedAt: Date | null;
    applicant: {
      id: string;
      serviceNumber: string;
      fullName: string;
      rank: string | null;
      unit: string | null;
    };
  };
  currentUserId: string;
  committee: {
    chairId: string;
    member1Id: string;
    member2Id: string;
  } | null;
  schedule: { monthIndex: number; payment: number; principal: number; interest: number }[];
}

const roleBadge = (ts: Date | null, label: string, myRole: 'CHAIR' | 'MEMBER1' | 'MEMBER2' | null) => {
  if (ts) {
    return (
      <div className="flex items-center gap-2 p-3 border rounded-md bg-emerald-50">
        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-sm font-medium">Approved {formatDate(ts)}</div>
        </div>
      </div>
    );
  }
  if (myRole) {
    return (
      <div className="flex items-center gap-2 p-3 border rounded-md border-amber-300 bg-amber-50">
        <Clock className="h-5 w-5 text-amber-600" />
        <div>
          <div className="text-xs text-muted-foreground">{label} (you)</div>
          <div className="text-sm font-medium">Pending your approval</div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 p-3 border rounded-md">
      <Clock className="h-5 w-5 text-muted-foreground" />
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-sm font-medium">Pending</div>
      </div>
    </div>
  );
};

export function LoanDetailForReview({ loan, currentUserId, committee, schedule }: LoanDetailForReviewProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const myRole: 'CHAIR' | 'MEMBER1' | 'MEMBER2' | null = committee
    ? committee.chairId === currentUserId ? 'CHAIR'
    : committee.member1Id === currentUserId ? 'MEMBER1'
    : committee.member2Id === currentUserId ? 'MEMBER2'
    : null
    : null;

  const isApplicantOnCommittee = committee
    ? loan.applicant.id === committee.chairId ||
      loan.applicant.id === committee.member1Id ||
      loan.applicant.id === committee.member2Id
    : false;

  const approvals = (loan.chairApprovedAt ? 1 : 0) + (loan.member1ApprovedAt ? 1 : 0) + (loan.member2ApprovedAt ? 1 : 0);

  const handleApprove = (role: 'CHAIR' | 'MEMBER1' | 'MEMBER2') => {
    setMsg(null);
    const fd = new FormData();
    fd.set('loanId', loan.id);
    fd.set('approverRole', role);
    startTransition(async () => {
      const res = await approveLoanAction(fd);
      if (res?.error) setMsg({ ok: false, text: res.error });
      else {
        setMsg({ ok: true, text: 'Approval recorded.' });
        setTimeout(() => router.refresh(), 800);
      }
    });
  };

  const handleReject = () => {
    if (rejectReason.length < 5) {
      setMsg({ ok: false, text: 'Please provide a rejection reason (min 5 chars).' });
      return;
    }
    setMsg(null);
    const fd = new FormData();
    fd.set('loanId', loan.id);
    fd.set('reason', rejectReason);
    startTransition(async () => {
      const res = await rejectLoanAction(fd);
      if (res?.error) setMsg({ ok: false, text: res.error });
      else router.push('/finance/soft-loan-applications');
    });
  };

  const handleDisburse = () => {
    setMsg(null);
    const fd = new FormData();
    fd.set('loanId', loan.id);
    startTransition(async () => {
      const res = await disburseLoanAction(fd);
      if (res?.error) setMsg({ ok: false, text: res.error });
      else {
        setMsg({ ok: true, text: 'Loan disbursed.' });
        setTimeout(() => router.refresh(), 800);
      }
    });
  };

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/finance/soft-loan-applications"><ArrowLeft className="h-4 w-4 mr-1" /> Back to applications</Link>
      </Button>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold font-heading">Review loan application</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Applied {formatDate(loan.appliedAt)} · ID {loan.id.slice(0, 8)}
          </p>
        </div>
        <Badge variant={loan.status === 'APPROVED' ? 'default' : 'warning'}>{loan.status}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Applicant</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <div><span className="text-muted-foreground">Name:</span> <span className="font-medium">{loan.applicant.fullName}</span></div>
          <div><span className="text-muted-foreground">Service #:</span> {loan.applicant.serviceNumber}</div>
          <div><span className="text-muted-foreground">Rank / Unit:</span> {loan.applicant.rank ?? '—'} / {loan.applicant.unit ?? '—'}</div>
          {loan.conflictDeclared && (
            <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
              ⚠ Applicant declared a conflict of interest with a Sub-Committee member.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Loan terms</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Principal</div>
            <div className="text-lg font-semibold">{formatCurrency(loan.principal)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Term</div>
            <div className="text-lg font-semibold">{loan.termMonths} months</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Monthly</div>
            <div className="text-lg font-semibold">{formatCurrency(loan.monthlyPayment)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Total to repay</div>
            <div className="text-lg font-semibold">{formatCurrency(loan.totalRepayment)}</div>
          </div>
          <div className="col-span-2 md:col-span-4 pt-2 border-t">
            <div className="text-xs text-muted-foreground">Purpose</div>
            <p className="text-sm mt-1">{loan.purpose}</p>
          </div>
        </CardContent>
      </Card>

      {loan.status === 'PENDING' && committee && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lending Sub-Committee approvals</CardTitle>
            <CardDescription>
              {isApplicantOnCommittee
                ? `Constitution Art. 5.5(h): applicant is on the Sub-Committee, so the OTHER 2 members must approve.`
                : `2 of 3 approvals required. ${approvals}/3 received.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {roleBadge(loan.chairApprovedAt, 'Chair (FW)', loan.applicant.id === committee.chairId ? null : myRole === 'CHAIR' ? 'CHAIR' : null)}
              {roleBadge(loan.member1ApprovedAt, 'Member 1', loan.applicant.id === committee.member1Id ? null : myRole === 'MEMBER1' ? 'MEMBER1' : null)}
              {roleBadge(loan.member2ApprovedAt, 'Member 2', loan.applicant.id === committee.member2Id ? null : myRole === 'MEMBER2' ? 'MEMBER2' : null)}
            </div>

            {myRole && (
              <div className="pt-2 border-t flex gap-2">
                <Button onClick={() => handleApprove(myRole)} disabled={pending} className="flex-1">
                  <Send className="h-4 w-4 mr-1" />
                  {pending ? 'Approving…' : 'Approve as ' + (myRole === 'CHAIR' ? 'Chair' : myRole)}
                </Button>
                <Button variant="destructive" onClick={() => setShowReject(!showReject)} disabled={pending}>
                  <XCircle className="h-4 w-4 mr-1" />
                  Reject
                </Button>
              </div>
            )}

            {showReject && (
              <div className="space-y-2 p-3 border border-destructive/30 rounded-md bg-destructive/5">
                <Label htmlFor="rejectReason">Rejection reason (required, min 5 chars)</Label>
                <Textarea
                  id="rejectReason"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={2}
                  minLength={5}
                />
                <Button variant="destructive" onClick={handleReject} disabled={pending}>
                  Confirm rejection
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {loan.status === 'APPROVED' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Disburse loan</CardTitle>
            <CardDescription>Move K{Number(loan.principal).toFixed(2)} from the SOFT_LOANS bucket to the applicant.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleDisburse} disabled={pending}>
              {pending ? 'Disbursing…' : 'Disburse now'}
            </Button>
          </CardContent>
        </Card>
      )}

      {schedule.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Repayment schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b">
                  <th className="text-left py-1">Month</th>
                  <th className="text-right py-1">Principal</th>
                  <th className="text-right py-1">Interest</th>
                  <th className="text-right py-1">Payment</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((s) => (
                  <tr key={s.monthIndex} className="border-b last:border-0">
                    <td className="py-1">{s.monthIndex}</td>
                    <td className="text-right py-1">{formatCurrency(s.principal)}</td>
                    <td className="text-right py-1">{formatCurrency(s.interest)}</td>
                    <td className="text-right py-1 font-medium">{formatCurrency(s.payment)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {msg && (
        <div className={`flex items-start gap-2 p-3 rounded-md text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-destructive/10 text-destructive'}`}>
          {msg.ok ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />}
          <span>{msg.text}</span>
        </div>
      )}
    </div>
  );
}
