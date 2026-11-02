'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { restoreVoidedContributionAction } from '@/server/actions/contributions';
import { Undo2, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface Props {
  /** The audit entry that recorded the void. */
  auditLogId: string;
  /** The member the voided payment belonged to. */
  memberName: string;
  /** The period the payment was booked against. */
  monthLabel: string;
  /** The amount on the payment. */
  amount: number;
}

/**
 * Put back a payment that was voided.
 *
 * A void takes a row off the ledger. When the void was the mistake -- a real
 * payment read as a duplicate -- the row has to go back exactly as it was,
 * so the restore reads it out of the audit log rather than asking for it
 * again.
 */
export function RestoreVoidedControl({ auditLogId, memberName, monthLabel, amount }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setMsg(null);
    startTransition(async () => {
      const res = await restoreVoidedContributionAction(fd);
      if ('error' in res) {
        setMsg({ ok: false, text: res.error });
        return;
      }
      setMsg({ ok: true, text: res.message });
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        type="button"
        onClick={() => {
          setMsg(null);
          setOpen(true);
        }}
      >
        <Undo2 className="h-3.5 w-3.5" />
        Restore
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <form onSubmit={handleSubmit} className="flex items-center gap-1.5">
        <input type="hidden" name="auditLogId" value={auditLogId} />
        <input
          name="reason"
          required
          placeholder={'Why is ' + memberName + ' payment of ' + monthLabel + ' being put back?'}
          className="h-8 w-56 rounded-md border border-input bg-background px-2 text-xs"
        />
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Put back
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setMsg(null);
          }}
        >
          Cancel
        </Button>
      </form>
      <p className="text-[11px] text-muted-foreground">
        K{amount.toFixed(2)} for {memberName}, {monthLabel}.
      </p>
      {msg && (
        <div
          className={`flex items-start gap-1.5 text-xs ${
            msg.ok ? 'text-emerald-700' : 'text-destructive'
          }`}
        >
          {msg.ok ? (
            <CheckCircle2 className="h-3.5 w-3.5 mt-px shrink-0" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 mt-px shrink-0" />
          )}
          <span>{msg.text}</span>
        </div>
      )}
    </div>
  );
}
