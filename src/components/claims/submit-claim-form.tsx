'use client';

import { useState, useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { submitClaimAction } from '@/server/actions/claims';
import { config } from '@/lib/config';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function SubmitClaimForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setMsg(null);
    startTransition(async () => {
      const res = await submitClaimAction(fd);
      if (res?.error) setMsg({ ok: false, text: res.error });
      else if (res?.success) {
        setMsg({ ok: true, text: 'Claim submitted. You will be notified when reviewed.' });
        setTimeout(() => router.push('/claims'), 1500);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="type">Claim type</Label>
        <select
          id="type"
          name="type"
          required
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Select type…</option>
          <option value="FUNERAL">Funeral (max {formatK(config.welfareCaps.funeral.amountPerEvent)})</option>
          <option value="MEDICAL">Medical (max {formatK(config.welfareCaps.medical.amountPerEvent)})</option>
        </select>
      </div>

      <div className="space-y-1">
        <Label htmlFor="beneficiary">Beneficiary</Label>
        <select
          id="beneficiary"
          name="beneficiary"
          required
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">Select…</option>
          <option value="self">Self</option>
          <option value="spouse">Spouse</option>
          <option value="parent">Parent</option>
          <option value="father">Father</option>
          <option value="mother">Mother</option>
          <option value="child">Child</option>
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="eventDate">Event date</Label>
          <Input
            id="eventDate"
            name="eventDate"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            required
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="amountRequested">Amount requested (K)</Label>
          <Input
            id="amountRequested"
            name="amountRequested"
            type="number"
            step="0.01"
            min="1"
            required
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="description">Description</Label>
        <textarea
          id="description"
          name="description"
          rows={4}
          required
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="Briefly describe the event and provide any reference numbers (death certificate, hospital admission, etc.)"
        />
      </div>

      <div className="space-y-1">
        <Label htmlFor="supportingDocUrl">Supporting document URL (optional)</Label>
        <Input
          id="supportingDocUrl"
          name="supportingDocUrl"
          type="text"
          placeholder="https://..."
        />
      </div>

      {msg && (
        <div className={`flex items-start gap-2 p-3 rounded-md text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-destructive/10 text-destructive'}`}>
          {msg.ok ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />}
          <span>{msg.text}</span>
        </div>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Submitting…' : 'Submit claim'}
      </Button>
    </form>
  );
}

function formatK(amount: number) {
  return `K${amount.toLocaleString()}`;
}
