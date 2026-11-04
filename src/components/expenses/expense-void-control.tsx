'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { voidAdminExpenseAction } from '@/server/actions/admin-expenses';

/**
 * Withdraw a recorded expense.
 *
 * The entry is never deleted: the money goes back to the Admin & Audit bucket
 * and the ledger shows the reversal, so the committee can see that the expense
 * was entered and then withdrawn.
 */
export function ExpenseVoidControl({ transactionId }: { transactionId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData();
    fd.append('transactionId', transactionId);
    fd.append('reason', reason);
    setMsg(null);
    startTransition(async () => {
      const res = await voidAdminExpenseAction(fd);
      if (res?.error) {
        setMsg({ ok: false, text: res.error });
        return;
      }
      if (res?.success) {
        setMsg({ ok: true, text: 'Withdrawn. The money is back in the bucket.' });
        setOpen(false);
        setReason('');
      }
    });
  };

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Withdraw
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col items-end gap-2">
      <Input
        name="reason"
        placeholder="Why is it being withdrawn?"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="h-8 w-64 text-xs"
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? 'Withdrawing…' : 'Confirm'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      {msg && (
        <span
          className={
            'text-xs ' + (msg.ok ? 'text-emerald-700' : 'text-destructive')
          }
        >
          {msg.text}
        </span>
      )}
    </form>
  );
}
