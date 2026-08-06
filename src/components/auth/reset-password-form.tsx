'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';
import { markPasswordChangedAction } from '@/server/actions/profile';

export function ResetPasswordForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const newPassword = fd.get('newPassword')?.toString() ?? '';
    const confirm = fd.get('confirmPassword')?.toString() ?? '';
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    startTransition(async () => {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      // Stamp our local User.lastPasswordChangedAt so the dashboard
      // "set your password" nudge disappears. Best-effort -- if this
      // fails (e.g. transient DB blip), the user can still sign in;
      // the nudge is a UX nicety, not a security gate.
      try {
        await markPasswordChangedAction();
      } catch (e) {
        console.warn('markPasswordChangedAction failed:', e);
      }
      router.push('/dashboard');
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="newPassword">New password</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          minLength={8}
          required
          disabled={pending}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm new password</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          minLength={8}
          required
          disabled={pending}
        />
      </div>
      <p className="text-xs text-muted-foreground">Minimum 8 characters.</p>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-start gap-2 p-3 bg-emerald-50 text-emerald-700 rounded-md text-sm">
        <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
        <span>Clicking save will set your new password and sign you in.</span>
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Saving…' : 'Save new password'}
      </Button>
    </form>
  );
}
