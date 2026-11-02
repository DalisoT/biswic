'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import {
  moveContributionAction,
  splitContributionAction,
  voidContributionAction,
} from '@/server/actions/contributions';
import { ArrowRightLeft, Split, Ban, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface Props {
  contributionId: string;
  /** The month the payment is booked against. */
  month: number;
  year: number;
  /** The amount on the payment, in kwacha. */
  amount: number;
  memberName: string;
  /** The periods the member already has a payment booked against. */
  paidPeriods: { month: number; year: number }[];
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

type Mode = 'move' | 'split' | 'void' | null;

type ActionResult = {
  error?: string;
  success?: boolean;
  message?: string;
  warning?: string;
};

/**
 * The three corrections a Treasurer can make to a payment on the ledger:
 * move it to another month, spread it across the months it covers, or void
 * an entry that was never a payment at all.
 */
export function ContributionAdjustControl({
  contributionId,
  month,
  year,
  amount,
  memberName,
  paidPeriods,
}: Props) {
  const [mode, setMode] = useState<Mode>(null);
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const close = () => {
    setMode(null);
    setMsg(null);
  };

  const run = (
    action: (fd: FormData) => Promise<ActionResult>,
    e: React.FormEvent<HTMLFormElement>,
  ) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setMsg(null);
    startTransition(async () => {
      const res = await action(fd);
      if (res.error) {
        setMsg({ ok: false, text: res.error });
        return;
      }
      const warning = res.warning;
      setMsg({
        ok: true,
        text: warning
          ? (res.message ?? 'Done.') + ' ' + warning
          : (res.message ?? 'Done.'),
      });
      if (!warning) setMode(null);
    });
  };

  const button = (m: Exclude<Mode, null>, label: string, Icon: typeof ArrowRightLeft) => (
    <Button
      variant="outline"
      size="sm"
      type="button"
      onClick={() => {
        setMsg(null);
        setMode(mode === m ? null : m);
      }}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Button>
  );

  const isPaid = (m: number, y: number) =>
    paidPeriods.some((p) => p.month === m && p.year === y);

  /** One row of 12 month checkboxes for a given year. */
  const monthGrid = (y: number) => (
    <div className="grid grid-cols-6 gap-1">
      {MONTHS.map((m, i) => {
        const value = i + 1;
        const isCurrent = value === month && y === year;
        const paid = isPaid(value, y);
        return (
          <label
            key={y + '-' + m}
            title={y + ' ' + m}
            className={[
              'flex items-center gap-1 rounded border px-1 py-0.5 text-[10px]',
              isCurrent ? 'border-primary bg-primary/5 font-medium' : '',
              paid && !isCurrent ? 'opacity-40' : '',
            ].join(' ')}
          >
            <input
              type="checkbox"
              name="months"
              value={y + '-' + value}
              defaultChecked={isCurrent}
              disabled={isCurrent || (paid && !isCurrent)}
              className="h-3 w-3"
            />
            {m.slice(0, 3)}
          </label>
        );
      })}
    </div>
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {button('move', 'Move month', ArrowRightLeft)}
        {button('split', 'Split', Split)}
        {button('void', 'Void', Ban)}
      </div>

      {mode === 'move' && (
        <form
          onSubmit={(e) => run(moveContributionAction, e)}
          className="flex items-end gap-1.5"
        >
          <input type="hidden" name="contributionId" value={contributionId} />
          <div className="space-y-0.5">
            <label
              htmlFor={`mv-month-${contributionId}`}
              className="block text-[10px] uppercase tracking-wide text-muted-foreground"
            >
              Month
            </label>
            <select
              id={`mv-month-${contributionId}`}
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
              htmlFor={`mv-year-${contributionId}`}
              className="block text-[10px] uppercase tracking-wide text-muted-foreground"
            >
              Year
            </label>
            <select
              id={`mv-year-${contributionId}`}
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
          <Button type="button" size="sm" variant="ghost" onClick={close}>
            Cancel
          </Button>
        </form>
      )}

      {mode === 'split' && (
        <form
          onSubmit={(e) => run(splitContributionAction, e)}
          className="space-y-2 rounded-md border border-input p-2"
        >
          <input type="hidden" name="contributionId" value={contributionId} />
          <p className="text-[11px] text-muted-foreground">
            K{amount.toFixed(2)} for {memberName}. Tick every month this payment
            covers. The month it is booked against ({MONTHS[month - 1]} {year})
            is always included, and the money is divided evenly between them.
          </p>
          <div className="space-y-1">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {year}
            </p>
            {monthGrid(year)}
          </div>
          {year + 1 <= 2030 && (
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {year + 1}
              </p>
              {monthGrid(year + 1)}
            </div>
          )}
          <input
            name="reason"
            placeholder="Reason (recorded in the audit log)"
            required
            className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
          />
          <div className="flex gap-1.5">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Split across months
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={close}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {mode === 'void' && (
        <form
          onSubmit={(e) => run(voidContributionAction, e)}
          className="space-y-2 rounded-md border border-destructive/40 bg-destructive/5 p-2"
        >
          <input type="hidden" name="contributionId" value={contributionId} />
          <p className="text-[11px] text-destructive">
            Remove this entry from the ledger. Only use this for an entry that
            was never a payment received from the member.
          </p>
          <textarea
            name="reason"
            rows={2}
            required
            placeholder="Why was this never a payment? (recorded in the audit log)"
            className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
          />
          <label className="flex items-center gap-1.5 text-[11px]">
            <input type="checkbox" name="confirm" required className="h-3 w-3" />
            I confirm this entry was never a payment received from the member.
          </label>
          <div className="flex gap-1.5">
            <Button type="submit" size="sm" variant="destructive" disabled={pending}>
              {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Void entry
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={close}>
              Cancel
            </Button>
          </div>
        </form>
      )}

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
