'use client';

import { useState, useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { submitClaimAction } from '@/server/actions/claims';
import { config } from '@/lib/config';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { useRouter } from 'next/navigation';

export function SubmitClaimForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // GM vote 2026-10-12 closed the FUNERAL and MEDICAL welfare pools. There
  // are no active claim types left to submit. Show a clear explanation and
  // a path to the next monthly meeting instead of a dead form.
  return (
    <Card>
      <CardContent className="pt-6 space-y-3 text-sm">
        <div className="flex items-start gap-2 text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-3">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <div className="font-medium">Welfare claims are paused</div>
            <p className="mt-1 text-xs leading-relaxed">
              At the General Meeting of 12 October 2026, the Cooperative closed
              the FUNERAL and MEDICAL welfare pools and rebalanced the freed
              18% to LAND (+10%), SOFT_LOANS (+7%), and ADMIN (+1%). New claims
              of those types are no longer accepted.
            </p>
          </div>
        </div>
        <p className="text-muted-foreground text-xs leading-relaxed">
          If you have an emergency or hardship, raise it at the next monthly
          meeting for ad-hoc support. Past approved/paid claims remain visible
          on the <a className="text-primary underline" href="/claims">/claims</a> page for the audit history.
        </p>
        {msg && (
          <div className={`flex items-start gap-2 p-3 rounded-md text-sm ${msg.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-destructive/10 text-destructive'}`}>
            {msg.ok ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" /> : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />}
            <span>{msg.text}</span>
          </div>
        )}
        <Button asChild variant="outline" className="w-full">
          <a href="/meetings">View upcoming meetings</a>
        </Button>
      </CardContent>
    </Card>
  );
}

function formatK(amount: number) {
  return `K${amount.toLocaleString()}`;
}

