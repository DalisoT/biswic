'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { bulkContributionsAction } from '@/server/actions/contributions';
import { CheckCircle2, AlertCircle } from 'lucide-react';

export function BulkContributionForm() {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const today = new Date();
  const defaultDate = today.toISOString().slice(0, 10);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setMsg(null);
    startTransition(async () => {
      const res = await bulkContributionsAction(fd);
      if (!res) {
        setMsg({ ok: false, text: 'No response from server.' });
      } else if ('error' in res && res.error) {
        setMsg({ ok: false, text: res.error });
      } else if ('success' in res) {
        const success = res.success ?? 0;
        const failed = res.failed ?? 0;
        setMsg({
          ok: true,
          text: `Recorded ${success} contributions${failed > 0 ? ` (${failed} failed)` : ''}.`,
        });
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Bulk CSV upload</CardTitle>
        <CardDescription>One entry per line: service_number,amount,month,year</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="csv">CSV data</Label>
            <textarea
              id="csv"
              name="csv"
              rows={6}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
              placeholder={'MEMBER-001,100,1,2026\nMEMBER-002,100,1,2026\nMEMBER-003,100,1,2026'}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="bulk-paymentMethod">Method</Label>
              <select
                id="bulk-paymentMethod"
                name="paymentMethod"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                defaultValue="PAYROLL_DEDUCTION"
              >
                <option value="PAYROLL_DEDUCTION">Payroll Deduction</option>
                <option value="CASH">Cash</option>
                <option value="MOBILE_MONEY">Mobile Money</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="bulk-receivedAt">Date</Label>
              <Input id="bulk-receivedAt" name="receivedAt" type="date" defaultValue={defaultDate} required />
            </div>
          </div>

          {msg && (
            <div className={`flex items-start gap-2 p-3 rounded-md text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-destructive/10 text-destructive'}`}>
              {msg.ok ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />}
              <span>{msg.text}</span>
            </div>
          )}

          <Button type="submit" disabled={pending} className="w-full">
            {pending ? 'Recording…' : 'Record bulk'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
