'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { addContributionAction } from '@/server/actions/contributions';
import { config } from '@/lib/config';
import { CheckCircle2, AlertCircle } from 'lucide-react';

export function AddContributionForm() {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const today = new Date();
  const defaultDate = today.toISOString().slice(0, 10);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setMsg(null);
    startTransition(async () => {
      const res = await addContributionAction(fd);
      if (res?.error) setMsg({ ok: false, text: res.error });
      else if (res?.success) {
        setMsg({ ok: true, text: 'Contribution recorded successfully.' });
        (e.target as HTMLFormElement).reset();
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Record a contribution</CardTitle>
        <CardDescription>Allocated to all 6 buckets automatically</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="memberServiceNumber">Member service number</Label>
            <Input id="memberServiceNumber" name="memberServiceNumber" placeholder="MEMBER-001" required />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="amount">Amount (K)</Label>
              <Input id="amount" name="amount" type="number" step="0.01" defaultValue={config.monthlyContributionPerMember} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="paymentMethod">Method</Label>
              <select
                id="paymentMethod"
                name="paymentMethod"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                defaultValue="CASH"
              >
                <option value="CASH">Cash</option>
                <option value="PAYROLL_DEDUCTION">Payroll Deduction</option>
                <option value="MOBILE_MONEY">Mobile Money</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="month">Month</Label>
              <select
                id="month"
                name="month"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                defaultValue={today.getMonth() + 1}
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="year">Year</Label>
              <Input id="year" name="year" type="number" defaultValue={today.getFullYear()} required />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="receivedAt">Date received</Label>
            <Input id="receivedAt" name="receivedAt" type="date" defaultValue={defaultDate} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="receiptNumber">Receipt number (optional)</Label>
            <Input id="receiptNumber" name="receiptNumber" placeholder="RCT-2026-..." />
          </div>

          {msg && (
            <div className={`flex items-start gap-2 p-3 rounded-md text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-destructive/10 text-destructive'}`}>
              {msg.ok ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />}
              <span>{msg.text}</span>
            </div>
          )}

          <Button type="submit" disabled={pending} className="w-full">
            {pending ? 'Recording…' : 'Record contribution'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
