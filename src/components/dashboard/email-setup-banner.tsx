'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Mail, X } from 'lucide-react';

const DISMISS_KEY = 'biswic.emailSetupBanner.dismissedAt';

interface Props {
  serviceNumber: string;
}

/**
 * Blue banner at the top of the dashboard that asks the user to add a real
 * email. Renders only when public.User.email is null (i.e. no real email is
 * on file -- the user is still on the sentinel null+{serviceNumber}@biswic.invalid
 * in Supabase auth, which means /forgot-password can't deliver a reset link).
 *
 * Self-service path: the user clicks "Add email" -> /settings -> Profile form.
 * updateProfileAction now mirrors the email into auth.users so password reset
 * starts working immediately.
 *
 * Dismissable per-session via the X button (24h TTL in localStorage).
 */
export function EmailSetupBanner({ serviceNumber }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      if (raw) {
        const dismissedAt = Number(raw);
        if (Number.isFinite(dismissedAt) && Date.now() - dismissedAt < 24 * 60 * 60 * 1000) {
          setDismissed(true);
        }
      }
    } catch {
      // localStorage may be disabled
    }
  }, []);

  if (!ready || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore
    }
  };

  return (
    <div
      role="status"
      className="relative flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 rounded-md border border-sky-300 bg-sky-50 text-sky-900"
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <Mail className="h-5 w-5 shrink-0 mt-0.5 text-sky-700" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Add your email to recover your password</p>
          <p className="text-xs mt-0.5 text-sky-800">
            We don&apos;t have a real email for you yet ({serviceNumber}). Add one
            in Settings so you can reset your password if you forget it -- takes
            30 seconds.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button asChild size="sm" variant="default" className="bg-sky-700 hover:bg-sky-800">
          <Link href="/settings">
            <Mail className="h-3.5 w-3.5 mr-1" />
            Add email
          </Link>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Dismiss for 24 hours"
          onClick={handleDismiss}
          className="text-sky-900 hover:bg-sky-100"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
