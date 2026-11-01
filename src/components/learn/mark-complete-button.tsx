'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { markLessonCompleteAction } from '@/server/actions/learn';

export function MarkCompleteButton({
  lessonId,
  initialComplete,
}: {
  lessonId: string;
  initialComplete: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [complete, setComplete] = useState(initialComplete);
  const [error, setError] = useState<string | null>(null);

  const handleClick = () => {
    setError(null);
    const fd = new FormData();
    fd.set('lessonId', lessonId);
    startTransition(async () => {
      const result = await markLessonCompleteAction(fd);
      if ('error' in result && result.error) {
        setError(result.error);
      } else {
        setComplete(true);
        router.refresh();
      }
    });
  };

  if (complete) {
    return (
      <Button
        variant="outline"
        disabled
        className="h-11 w-full border-emerald-200 bg-emerald-50 text-emerald-700 disabled:opacity-100 sm:w-auto"
      >
        <CheckCircle2 className="mr-2 h-4 w-4" />
        Completed
      </Button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-1 sm:w-auto sm:items-end">
      <Button onClick={handleClick} disabled={pending} className="h-11 w-full sm:w-auto">
        {pending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving
          </>
        ) : (
          <>
            <Check className="mr-2 h-4 w-4" />
            Mark as complete
          </>
        )}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
