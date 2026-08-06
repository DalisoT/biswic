'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { clearMemberLockAction } from '@/server/actions/members';
import { CheckCircle2, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';

interface Props {
  memberId: string;
  serviceNumber: string;
}

export function ClearLockButton({ memberId, serviceNumber }: Props) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const handleClear = () => {
    setMsg(null);
    const fd = new FormData();
    fd.set('memberId', memberId);
    startTransition(async () => {
      const res = await clearMemberLockAction(fd);
      if (res?.error) {
        setMsg({ ok: false, text: res.error });
      } else {
        setMsg({
          ok: true,
          text: `Cleared. ${serviceNumber} can sign in now.`,
        });
      }
    });
  };

  return (
    <div className="flex flex-col items-start sm:items-end gap-1 shrink-0">
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={handleClear}
        disabled={pending}
        className="border-emerald-300 text-emerald-800 hover:bg-emerald-50"
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
        ) : (
          <ShieldCheck className="h-3.5 w-3.5 mr-1" />
        )}
        Clear lockout
      </Button>
      {msg && (
        <div
          className={`flex items-center gap-1 text-xs ${msg.ok ? 'text-emerald-700' : 'text-destructive'}`}
        >
          {msg.ok ? (
            <CheckCircle2 className="h-3 w-3" />
          ) : (
            <AlertCircle className="h-3 w-3" />
          )}
          <span>{msg.text}</span>
        </div>
      )}
    </div>
  );
}
