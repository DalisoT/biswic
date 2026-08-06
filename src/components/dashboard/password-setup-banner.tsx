'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { KeyRound, X } from 'lucide-react';

const DISMISS_KEY = 'biswic.passwordSetupBanner.dismissedAt';

interface Props {
  serviceNumber: string;
}

/**
 * Yellow/amber banner at the top of the dashboard that asks the user to
 * set their own password. Renders only when the server-side user row has
 * `lastPasswordChangedAt === null` (i.e. they are still on a system-set
 * password).
 *
 * The user can dismiss the banner per-session via the X button. The
 * dismissal is recorded in localStorage with a 24h TTL so they don't
 * see it again on every page render, but it does come back the next
 * day until they actually reset the password (which clears
 * lastPasswordChangedAt and the banner stops rendering server-side).
 */
export function PasswordSetupBanner({ serviceNumber }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(true);
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      if (raw) {
        const dismissedAt = Number(raw);
        // 24 hour TTL on the dismiss
        if (Number.isFinite(dismissedAt) && Date.now() - dismissedAt < 24 * 60 * 60 * 1000) {
          setDismissed(true);
        }
      }
    } catch {
      // localStorage may be disabled (e.g. incognito in some browsers)
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
      className="relative flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4 rounded-md border border-amber-300 bg-amber-50 text-amber-900"
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <KeyRound className="h-5 w-5 shrink-0 mt-0.5 text-amber-700" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Set your own password</p>
          <p className="text-xs mt-0.5 text-amber-800">
            You&apos;re still on the password that was set for you. Set your
            own so only you know it -- it takes 30 seconds.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button asChild size="sm" variant="default" className="bg-amber-700 hover:bg-amber-800">
          <Link href="/forgot-password">
            <KeyRound className="h-3.5 w-3.5 mr-1" />
            Set my password
          </Link>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Dismiss for 24 hours"
          onClick={handleDismiss}
          className="text-amber-900 hover:bg-amber-100"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
