'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { moveContributionAction } from '@/server/actions/contributions';
import { ArrowRightLeft, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface Props {
  contributionId: string;
  /** The month the payment is booked against today. */
  month: number;
  year: number;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const YEARS = [2025, 2026, 2027, 2028];

/**
 * Move a recorded payment to a different month.
 *
 * A contribution belongs to a period, not to the day the money arrived. When
 * it is booked against the wrong month the member is shown as owing a month
 * they actually paid, and the Treasurer needs a way to put it right.
 */
export function MoveMonthControl({ contributionId, month, year }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setMsg(null);
    startTransition(async () => {
      const res = await moveContributionAction(fd);
      if ('error' in res) {
        setMsg({ ok: false, text: res.error });
        return;
      }
      setMsg({ ok: true, text: res.message });
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        type="button"
        onClick={() => {
          setMsg(null);
          setOpen(true);
        }}
      >
        <ArrowRightLeft className="h-3.5 w-3.5" />
        Move month
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <form onSubmit={handleSubmit} className="flex items-end gap-1.5">
        <input type="hidden" name="contributionId" value={contributionId} />
        <div className="space-y-0.5">
          <label
            htmlFor={`move-month-${contributionId}`}
            className="block text-[10px] uppercase tracking-wide text-muted-foreground"
          >
            Month
          </label>
          <select
            id={`move-month-${contributionId}`}
            name="month"
            defaultValue={month}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-0.5">
          <label
            htmlFor={`move-year-${contributionId}`}
            className="block text-[10px] uppercase tracking-wide text-muted-foreground"
          >
            Year
          </label>
          <select
            id={`move-year-${contributionId}`}
            name="year"
            defaultValue={year}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Move
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setOpen(false);
            setMsg(null);
          }}
        >
          Cancel
        </Button>
      </form>
      {msg && (
        <div
          className={`flex items-start gap-1.5 text-xs ${
            msg.ok ? 'text-emerald-700' : 'text-destructive'
          }`}
        >
          {msg.ok ? (
            <CheckCircle2 className="h-3.5 w-3.5 mt-px shrink-0" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 mt-px shrink-0" />
          )}
          <span>{msg.text}</span>
        </div>
      )}
    </div>
  );
}
