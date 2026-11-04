'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { adjustBucketsAction } from '@/server/actions/buckets';

interface BucketOption {
  code: string;
  name: string;
}

interface Row {
  code: string;
  amount: string;
}

/**
 * Move money between buckets.
 *
 * A plus amount credits the bucket, a minus amount takes from it. The rows
 * must add up to zero: an adjustment moves money, it never creates it. The
 * running total is shown live so the officer can see it balance before
 * applying.
 */
export function BucketAdjustmentForm({ buckets }: { buckets: BucketOption[] }) {
  const [rows, setRows] = useState<Row[]>([
    { code: buckets[0]?.code ?? 'LAND', amount: '' },
    { code: buckets[1]?.code ?? 'ADMIN', amount: '' },
  ]);
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const net = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const balanced = Math.abs(net) < 0.005;

  const setRow = (index: number, patch: Partial<Row>) =>
    setRows((current) => current.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  const addRow = () =>
    setRows((current) => [...current, { code: buckets[0]?.code ?? 'LAND', amount: '' }]);

  const removeRow = (index: number) =>
    setRows((current) => current.filter((_, i) => i !== index));

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMsg(null);
    const fd = new FormData();
    for (const row of rows) {
      fd.append('moveCode', row.code);
      fd.append('moveAmount', row.amount);
    }
    fd.append('reason', reason);
    if (confirmed) fd.append('confirm', 'on');

    startTransition(async () => {
      const res = await adjustBucketsAction(fd);
      if (res?.error) {
        setMsg({ ok: false, text: res.error });
        return;
      }
      if (res?.success) {
        setMsg({ ok: true, text: 'Adjustment applied. The bucket ledger has the entry.' });
        setRows([
          { code: buckets[0]?.code ?? 'LAND', amount: '' },
          { code: buckets[1]?.code ?? 'ADMIN', amount: '' },
        ]);
        setReason('');
        setConfirmed(false);
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Adjust the buckets</CardTitle>
        <CardDescription>
          Move money from one bucket to another. A plus adds to the bucket, a
          minus takes from it, and the rows must add up to zero. Nothing is
          created and nothing is lost.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-2">
            {rows.map((row, index) => (
              <div key={index} className="grid grid-cols-[1fr_120px_auto] gap-2 items-end">
                <div className="space-y-1">
                  <Label htmlFor={'bucket-code-' + index}>Bucket</Label>
                  <select
                    id={'bucket-code-' + index}
                    name={'moveCode'}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={row.code}
                    onChange={(e) => setRow(index, { code: e.target.value })}
                  >
                    {buckets.map((b) => (
                      <option key={b.code} value={b.code}>
                        {b.code} - {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor={'bucket-amount-' + index}>Amount (K)</Label>
                  <Input
                    id={'bucket-amount-' + index}
                    name={'moveAmount'}
                    type="number"
                    step="0.01"
                    placeholder="-100"
                    value={row.amount}
                    onChange={(e) => setRow(index, { amount: e.target.value })}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remove this row"
                  onClick={() => removeRow(index)}
                  disabled={rows.length <= 2}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <Button type="button" variant="outline" size="sm" onClick={addRow}>
              <Plus className="h-4 w-4" />
              Add a row
            </Button>
            <span
              className={
                'text-sm font-medium ' +
                (balanced ? 'text-emerald-700' : 'text-destructive')
              }
            >
              {balanced
                ? 'Balanced'
                : 'Must add up to zero - currently K' + net.toFixed(2)}
            </span>
          </div>

          <div className="space-y-1">
            <Label htmlFor="adjustment-reason">Reason (kept in the audit log)</Label>
            <Input
              id="adjustment-reason"
              name="reason"
              placeholder="Why this money is moving"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              I have checked this against the books. This moves money between
              buckets and will show in the bucket ledger.
            </span>
          </label>

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

          <Button type="submit" disabled={pending || !balanced} className="w-full">
            {pending ? 'Applying…' : 'Apply the adjustment'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
