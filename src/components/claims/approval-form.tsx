'use client';

import { useState, useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { approveClaimAction } from '@/server/actions/claims';
import { CheckCircle2, AlertCircle } from 'lucide-react';

export function ApprovalForm({ claimId, requestedAmount }: { claimId: string; requestedAmount: number }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showOverride, setShowOverride] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setMsg(null);
    startTransition(async () => {
      const res = await approveClaimAction(fd);
      if (res?.error) {
        setMsg({ ok: false, text: res.error });
        setShowOverride(true);
      } else if (res?.success) {
        setMsg({ ok: true, text: 'Approved. The bucket has been deducted.' });
        setTimeout(() => window.location.reload(), 1500);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input type="hidden" name="claimId" value={claimId} />

      <div className="space-y-1">
        <Label htmlFor="amountApproved">Amount approved (K)</Label>
        <Input
          id="amountApproved"
          name="amountApproved"
          type="number"
          step="0.01"
          min="1"
          defaultValue={requestedAmount}
          required
        />
      </div>

      {showOverride && (
        <div className="space-y-1">
          <Label htmlFor="capOverrideNote" className="text-amber-700">
            Cap override note (required if cap exceeded)
          </Label>
          <textarea
            id="capOverrideNote"
            name="capOverrideNote"
            rows={3}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="Reason for overriding the cap (logged to audit trail)"
          />
        </div>
      )}

      {msg && (
        <div className={`flex items-start gap-2 p-3 rounded-md text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-destructive/10 text-destructive'}`}>
          {msg.ok ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />}
          <span>{msg.text}</span>
        </div>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Approving…' : 'Approve claim'}
      </Button>
    </form>
  );
}
