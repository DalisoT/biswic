'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { recordAdminExpenseAction } from '@/server/actions/admin-expenses';
import { EXPENSE_CATEGORIES } from '@/lib/admin-expense';

/**
 * Record money spent on running the cooperative.
 *
 * The amount comes out of the Admin & Audit bucket, so the kitty falls by the
 * amount spent and the committee can see, month by month, what administration
 * has cost the cooperative.
 */
export function AdminExpenseForm({ available }: { available: number }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setMsg(null);
    startTransition(async () => {
      const res = await recordAdminExpenseAction(fd);
      if (res?.error) {
        setMsg({ ok: false, text: res.error });
        return;
      }
      if (res?.success) {
        setMsg({ ok: true, text: 'Expense recorded. It has come out of the Admin & Audit bucket.' });
        (e.target as HTMLFormElement).reset();
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Record an administration expense</CardTitle>
        <CardDescription>
          K{available.toFixed(2)} is left in the Admin & Audit bucket. Recording an
          expense takes the money out of that bucket and out of the kitty.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="expense-amount">Amount (K)</Label>
              <Input
                id="expense-amount"
                name="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="expense-date">Date spent</Label>
              <Input
                id="expense-date"
                name="spentOn"
                type="date"
                defaultValue={today}
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="expense-category">What it was for</Label>
            <select
              id="expense-category"
              name="category"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              defaultValue={EXPENSE_CATEGORIES[0]}
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="expense-description">Description</Label>
            <Input
              id="expense-description"
              name="description"
              placeholder="What was bought or paid for"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="expense-payee">Paid to (optional)</Label>
              <Input id="expense-payee" name="payee" placeholder="Who was paid" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="expense-receipt">Receipt number (optional)</Label>
              <Input id="expense-receipt" name="receiptNumber" placeholder="RCT-2026-..." />
            </div>
          </div>

          {msg && (
            <div
              className={
                'flex items-start gap-2 p-3 rounded-md text-sm ' +
                (msg.ok
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-destructive/10 text-destructive')
              }
            >
              {msg.ok ? (
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              )}
              <span>{msg.text}</span>
            </div>
          )}

          <Button type="submit" disabled={pending} className="w-full">
            {pending ? 'Recording…' : 'Record the expense'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
