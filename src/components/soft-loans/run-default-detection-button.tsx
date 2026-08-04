'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { detectDefaultsAction } from '@/server/actions/soft-loans';
import { RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function RunDefaultDetectionButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const handleClick = () => {
    setMsg(null);
    startTransition(async () => {
      const res = await detectDefaultsAction();
      if (res?.error) setMsg({ ok: false, text: res.error });
      else {
        setMsg({
          ok: true,
          text: `Checked ${res.loansChecked} loans · marked ${res.repaymentsMarked} missed · defaulted ${res.loansDefaulted.length} · opened ${res.casesOpened} case(s)`,
        });
        setTimeout(() => router.refresh(), 1000);
      }
    });
  };

  return (
    <div className="space-y-2">
      <Button onClick={handleClick} disabled={pending} variant="outline">
        <RefreshCw className={`h-4 w-4 mr-1 ${pending ? 'animate-spin' : ''}`} />
        {pending ? 'Running…' : 'Run default detection now'}
      </Button>
      {msg && (
        <div className={`flex items-start gap-2 p-2 rounded text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-destructive/10 text-destructive'}`}>
          {msg.ok ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />}
          <span>{msg.text}</span>
        </div>
      )}
    </div>
  );
}
