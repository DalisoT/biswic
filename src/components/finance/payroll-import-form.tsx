'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { bulkImportPayrollAction, type PayrollBulkResult } from '@/server/actions/contributions';
import { CheckCircle2, AlertCircle, Loader2, Upload } from 'lucide-react';
import { config } from '@/lib/config';

interface Props {
  defaultMonth: number;
  defaultYear: number;
  defaultDate: string;
}

export function PayrollImportForm({ defaultMonth, defaultYear, defaultDate }: Props) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<PayrollBulkResult | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setResult(null);
    startTransition(async () => {
      const res = await bulkImportPayrollAction(fd);
      setResult(res);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="space-y-1">
          <Label htmlFor="month">Month</Label>
          <select
            id="month"
            name="month"
            defaultValue={defaultMonth}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            required
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="year">Year</Label>
          <Input id="year" name="year" type="number" defaultValue={defaultYear} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="paymentMethod">Payment method</Label>
          <select
            id="paymentMethod"
            name="paymentMethod"
            defaultValue="PAYROLL_DEDUCTION"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            required
          >
            <option value="PAYROLL_DEDUCTION">Payroll Deduction</option>
            <option value="CASH">Cash</option>
            <option value="MOBILE_MONEY">Mobile Money</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="receivedAt">Date received</Label>
          <Input id="receivedAt" name="receivedAt" type="date" defaultValue={defaultDate} required />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="csv">Schedule (one service number per line)</Label>
        <textarea
          id="csv"
          name="csv"
          rows={12}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
          placeholder={`# ${config.cooperativeShortName} payroll deduction\n106147\n105152\n106302,100\n# ...`}
          required
        />
      </div>

      {result && result.error && (
        <div className="flex items-start gap-2 p-3 rounded-md text-sm bg-destructive/10 text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{result.error}</span>
        </div>
      )}

      {result && !result.error && result.imported !== undefined && (
        <div className="rounded-md border bg-emerald-50 border-emerald-200 p-4 space-y-2">
          <div className="flex items-start gap-2 text-emerald-700 font-medium">
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Imported {result.imported} of {result.total} contribution{result.total !== 1 ? 's' : ''}
              {result.skipped && result.skipped > 0 ? ` · ${result.skipped} already paid` : ''}
            </span>
          </div>

          {result.unknown && result.unknown.length > 0 && (
            <div className="text-xs">
              <div className="font-semibold text-amber-700">
                {result.unknown.length} unknown service number{result.unknown.length !== 1 ? 's' : ''}:
              </div>
              <div className="font-mono text-amber-800 mt-1">
                {result.unknown.slice(0, 20).join(', ')}
                {result.unknown.length > 20 && ` ... +${result.unknown.length - 20} more`}
              </div>
            </div>
          )}

          {result.alreadyPaid && result.alreadyPaid.length > 0 && (
            <div className="text-xs">
              <div className="font-semibold text-slate-600">
                {result.alreadyPaid.length} already paid (skipped):
              </div>
              <div className="font-mono text-slate-700 mt-1">
                {result.alreadyPaid.slice(0, 20).join(', ')}
                {result.alreadyPaid.length > 20 && ` ... +${result.alreadyPaid.length - 20} more`}
              </div>
            </div>
          )}

          {result.invalid && result.invalid.length > 0 && (
            <div className="text-xs">
              <div className="font-semibold text-destructive">
                {result.invalid.length} invalid row{result.invalid.length !== 1 ? 's' : ''}:
              </div>
              <ul className="text-destructive mt-1 list-disc list-inside">
                {result.invalid.slice(0, 10).map((m, i) => (
                  <li key={i} className="font-mono">{m}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Importing…
          </>
        ) : (
          <>
            <Upload className="h-4 w-4 mr-1" />
            Import contributions
          </>
        )}
      </Button>
    </form>
  );
}
