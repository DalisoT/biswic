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
        className="text-emerald-700 border-emerald-200 bg-emerald-50"
      >
        <CheckCircle2 className="mr-2 h-4 w-4" />
        Completed
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={handleClick} disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving...
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
