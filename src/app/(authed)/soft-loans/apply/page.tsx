'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { applyForLoanAction } from '@/server/actions/soft-loans';
import { computeLoanSchedule } from '@/lib/soft-loan-math';
import { config } from '@/lib/config';
import { formatCurrency } from '@/lib/utils';
import { CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ApplyForLoanPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [principal, setPrincipal] = useState(config.softLoans.maxPrincipal);
  const [termMonths, setTermMonths] = useState(config.softLoans.maxTermMonths);
  const [conflictDeclared, setConflictDeclared] = useState(false);

  const schedule = computeLoanSchedule(principal, termMonths);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await applyForLoanAction(fd);
      if (res?.error) setMsg({ ok: false, text: res.error });
      else if (res?.success) {
        setMsg({ ok: true, text: 'Application submitted.' });
        setTimeout(() => router.push(`/soft-loans/${res.loanId}`), 1000);
      }
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/soft-loans"><ArrowLeft className="h-4 w-4 mr-1" /> Back to soft loans</Link>
      </Button>

      <div>
        <h1 className="text-2xl font-bold font-heading">Apply for a Soft Loan</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Constitution Art. 5.5: max K{config.softLoans.maxPrincipal.toLocaleString()}, up to {config.softLoans.maxTermMonths} months, {(config.softLoans.interestRatePerAnnum * 100).toFixed(0)}% p.a. interest.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Loan details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="principal">Principal (K)</Label>
                <Input
                  id="principal"
                  name="principal"
                  type="number"
                  min="1"
                  max={config.softLoans.maxPrincipal}
                  step="0.01"
                  value={principal}
                  onChange={(e) => setPrincipal(Number(e.target.value))}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="termMonths">Term (months)</Label>
                <Input
                  id="termMonths"
                  name="termMonths"
                  type="number"
                  min="1"
                  max={config.softLoans.maxTermMonths}
                  step="1"
                  value={termMonths}
                  onChange={(e) => setTermMonths(Number(e.target.value))}
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="purpose">
                Purpose
                <span className="text-xs text-muted-foreground ml-1">Constitution Art. 5.5(e) - personal/family emergency only</span>
              </Label>
              <textarea
                id="purpose"
                name="purpose"
                rows={3}
                minLength={10}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                placeholder="Describe the personal or family emergency this loan will address..."
                required
              />
            </div>

            <div className="flex items-start gap-2 pt-2">
              <input
                id="conflictDeclared"
                name="conflictDeclared"
                type="checkbox"
                checked={conflictDeclared}
                onChange={(e) => setConflictDeclared(e.target.checked)}
                className="mt-0.5"
              />
              <Label htmlFor="conflictDeclared" className="text-xs leading-snug">
                I declare that a Lending Sub-Committee member is a member of my immediate family
                (Constitution Art. 5.5(h)). The Chairperson (FW) will be required to countersign this application.
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* Live schedule preview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Repayment preview</CardTitle>
            <CardDescription>Indicative - confirmed on approval</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-3 text-center">
              <div>
                <div className="text-xs text-muted-foreground">Total to repay</div>
                <div className="text-lg font-semibold">{formatCurrency(schedule.totalRepayment)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Monthly payment</div>
                <div className="text-lg font-semibold">{formatCurrency(schedule.monthlyPayment)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Total interest</div>
                <div className="text-lg font-semibold">{formatCurrency(schedule.totalInterest)}</div>
              </div>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b">
                  <th className="text-left py-1">Month</th>
                  <th className="text-right py-1">Principal</th>
                  <th className="text-right py-1">Interest</th>
                  <th className="text-right py-1">Payment</th>
                </tr>
              </thead>
              <tbody>
                {schedule.schedule.map((s) => (
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

        {msg && (
          <div className={`flex items-start gap-2 p-3 rounded-md text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-destructive/10 text-destructive'}`}>
            {msg.ok ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />}
            <span>{msg.text}</span>
          </div>
        )}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? 'Submitting…' : 'Submit application'}
        </Button>
      </form>
    </div>
  );
}
