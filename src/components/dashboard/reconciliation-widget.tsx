'use client';

/**
 * ReconciliationWidget — surfaces bucket-balance drift.
 *
 * For each bucket, we compare the live `Bucket.balance` against the running
 * sum of every `BucketTransaction.amount` for that bucket. If the two
 * match, the ledger is balanced (green). Any drift means an edit bypassed
 * the ledger (manual SQL, a partial transaction, etc.) and deserves
 * attention.
 *
 * Thresholds (configurable inline below):
 *   - abs(drift) <= K0.50  → green   (rounding tolerance)
 *   - abs(drift) <= K5.00  → yellow  (small drift, log a note)
 *   - abs(drift) >  K5.00  → red     (action needed)
 */

import { formatCurrency } from '@/lib/utils';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

export interface BucketReconciliation {
  code: string;
  name: string;
  /** Live `Bucket.balance` snapshot. */
  balance: number;
  /** Sum of all `BucketTransaction.amount` rows for this bucket. */
  ledgerSum: number;
  /** balance − ledgerSum. Zero means perfect agreement. */
  drift: number;
  /** Number of BucketTransaction rows that back the ledgerSum. */
  ledgerEntryCount: number;
  /** Timestamp of the most recent transaction. Null if the bucket has never moved. */
  lastTransactionAt: string | null;
}

const COLORS: Record<string, string> = {
  LAND: '#0a3a5c',
  BUSINESS: '#b45309',
  FUNERAL: '#475569',
  SOFT_LOANS: '#10b981',
  ADMIN: '#64748b',
  MEDICAL: '#0891b2',
};

const GREEN_THRESHOLD = 0.5;
const YELLOW_THRESHOLD = 5.0;

type Status = 'ok' | 'warn' | 'error';

function statusFor(drift: number): Status {
  const abs = Math.abs(drift);
  if (abs <= GREEN_THRESHOLD) return 'ok';
  if (abs <= YELLOW_THRESHOLD) return 'warn';
  return 'error';
}

function StatusBadge({ status }: { status: Status }) {
  if (status === 'ok') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
        <CheckCircle2 className="h-3 w-3" /> Balanced
      </span>
    );
  }
  if (status === 'warn') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
        <AlertTriangle className="h-3 w-3" /> Small drift
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
      <XCircle className="h-3 w-3" /> Drift
    </span>
  );
}

export function ReconciliationWidget({
  buckets,
  generatedAt,
}: {
  buckets: BucketReconciliation[];
  generatedAt: string;
}) {
  const anyError = buckets.some((b) => statusFor(b.drift) === 'error');
  const anyWarn = buckets.some((b) => statusFor(b.drift) === 'warn');
  const overall: Status = anyError ? 'error' : anyWarn ? 'warn' : 'ok';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-muted-foreground">
            Bucket balance vs ledger total
          </div>
          <div className="mt-1 flex items-center gap-2">
            <StatusBadge status={overall} />
            <span className="text-xs text-muted-foreground">
              Checked {new Date(generatedAt).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
            </span>
          </div>
        </div>
        <Link
          href="/finance"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          Open ledger <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {buckets.map((b) => {
          const status = statusFor(b.drift);
          const driftSign = b.drift > 0 ? '+' : '';
          const borderColor =
            status === 'error'
              ? 'border-red-300'
              : status === 'warn'
                ? 'border-amber-300'
                : 'border-green-200';
          return (
            <div key={b.code} className={`border ${borderColor} rounded-md p-3 bg-white`}>
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: COLORS[b.code] ?? '#64748b' }}
                />
                <span className="text-xs font-medium text-muted-foreground">{b.code}</span>
                <span className="ml-auto">
                  <StatusBadge status={status} />
                </span>
              </div>
              <div className="mt-1 font-semibold">{formatCurrency(b.balance)}</div>
              <div className="mt-1 text-[11px] text-muted-foreground space-y-0.5">
                <div className="flex justify-between">
                  <span>Ledger sum ({b.ledgerEntryCount} entries)</span>
                  <span>{formatCurrency(b.ledgerSum)}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>Drift</span>
                  <span className={status === 'ok' ? 'text-green-700' : status === 'warn' ? 'text-amber-700' : 'text-red-700'}>
                    {driftSign}{formatCurrency(b.drift)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {(anyError || anyWarn) && (
        <p className="text-xs text-muted-foreground">
          Drift means a balance change did not flow through the bucket ledger. Common causes: manual SQL edits,
          partial transactions, or year-end carry-overs that bypassed the
          <code className="mx-1 rounded bg-muted px-1">BucketTransaction</code>
          row. Investigate via the audit log + ledger before next month close.
        </p>
      )}
    </div>
  );
}
