'use client';

import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { markClaimPaidAction } from '@/server/actions/claims';

export function MarkPaidButton({ claimId }: { claimId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      onClick={() => {
        const fd = new FormData();
        fd.append('claimId', claimId);
        startTransition(async () => {
          await markClaimPaidAction(fd);
          window.location.reload();
        });
      }}
      disabled={pending}
      className="w-full"
      variant="gold"
    >
      {pending ? 'Marking…' : 'Mark as paid'}
    </Button>
  );
}
