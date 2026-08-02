'use client';

import { useState, useTransition } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { rejectClaimAction } from '@/server/actions/claims';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

export function RejectForm({ claimId }: { claimId: string }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setMsg(null);
    startTransition(async () => {
      const res = await rejectClaimAction(fd);
      if (res?.error) setMsg({ ok: false, text: res.error });
      else if (res?.success) {
        setMsg({ ok: true, text: 'Claim rejected.' });
        setTimeout(() => window.location.reload(), 1500);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input type="hidden" name="claimId" value={claimId} />
      <div className="space-y-1">
        <Label htmlFor="reason">Reason</Label>
        <textarea
          id="reason"
          name="reason"
          rows={3}
          required
          minLength={5}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="Explain why this claim is being rejected"
        />
      </div>

      {msg && (
        <div className={`flex items-start gap-2 p-3 rounded-md text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-destructive/10 text-destructive'}`}>
          {msg.ok ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />}
          <span>{msg.text}</span>
        </div>
      )}

      <Button type="submit" variant="destructive" disabled={pending} className="w-full">
        {pending ? 'Rejecting…' : 'Reject claim'}
      </Button>
    </form>
  );
}
