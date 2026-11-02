'use client';

import { useState } from 'react';
import { Check, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
  /**
   * The path to share, e.g. "/share/learn/my-module/<lessonId>".
   *
   * The absolute URL is built from window.location.origin, so the link is
   * correct on whatever host the app is running on -- production, a preview
   * deployment, or localhost.
   */
  path: string;
  /** Title used for the share sheet and the preview card. */
  title: string;
  /** What is being shared, e.g. "Share lesson". */
  label: string;
};

/**
 * Shares a lesson or quiz link.
 *
 * On a phone `navigator.share` opens the native sheet, which is the WhatsApp
 * path a member actually wants. Where it is not available the URL is copied to
 * the clipboard instead. Either way the full URL is shown after the action, so
 * a member whose phone refuses the clipboard can still read it out and paste
 * it by hand.
 */
export function ShareButton({ path, title, label }: Props) {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle');

  const absoluteUrl =
    typeof window === 'undefined' ? path : `${window.location.origin}${path}`;

  const share = async () => {
    setState('idle');
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, url: absoluteUrl });
        return; // Shared, or the sheet was dismissed.
      } catch {
        // A dismissed share sheet is not an error -- fall through to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(absoluteUrl);
      setState('copied');
    } catch {
      setState('error');
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="outline" onClick={share} className="w-full sm:w-auto">
        {state === 'copied' ? (
          <Check className="mr-2 h-4 w-4" />
        ) : (
          <Share2 className="mr-2 h-4 w-4" />
        )}
        {state === 'copied' ? 'Link copied' : label}
      </Button>

      {state !== 'idle' && (
        <p className="break-all text-xs text-muted-foreground">
          {state === 'copied' ? 'Link copied. Share it here: ' : 'Copy this link: '}
          <span className="font-mono text-foreground">{absoluteUrl}</span>
        </p>
      )}
    </div>
  );
}
