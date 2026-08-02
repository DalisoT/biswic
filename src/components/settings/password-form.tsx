'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { requestPasswordResetAction } from '@/server/actions/auth';

interface PasswordFormProps {
  serviceNumber: string;
}

/**
 * Replaces the old self-service "change password" form. Per the runbook
 * constraint, password changes go through the reset-email flow. The
 * current page only offers a shortcut: email yourself a reset link
 * without leaving the settings page.
 */
export function PasswordForm({ serviceNumber }: PasswordFormProps) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const handleSendReset = () => {
    setMsg(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('serviceNumber', serviceNumber);
      const res = await requestPasswordResetAction(fd);
      if (res?.error) {
        setMsg({ ok: false, text: res.error });
      } else {
        setMsg({
          ok: true,
          text: 'A password-reset link has been emailed to the address on file. Open it to set a new password.',
        });
      }
    });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        To change your password, send yourself a reset link. It will be sent
        to the email on file for service number{' '}
        <span className="font-mono text-foreground">{serviceNumber}</span>.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={handleSendReset} disabled={pending}>
          {pending ? 'Sending…' : 'Email me a reset link'}
        </Button>
        <Button asChild variant="ghost">
          <Link href="/forgot-password">Go to forgot-password page</Link>
        </Button>
      </div>

      {msg && (
        <div
          className={`flex items-start gap-2 p-3 rounded-md text-sm ${
            msg.ok
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-destructive/10 text-destructive'
          }`}
        >
          {msg.ok ? (
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          )}
          <span>{msg.text}</span>
        </div>
      )}
    </div>
  );
}
