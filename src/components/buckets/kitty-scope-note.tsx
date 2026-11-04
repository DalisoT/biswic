import { formatCurrency } from '@/lib/utils';

export interface ClosedBucket {
  code: string;
  balance: number;
}

/**
 * Explains what the kitty figure leaves out.
 *
 * The kitty card sums the ACTIVE buckets only. The FUNERAL and MEDICAL
 * buckets were closed at the General Meeting of 12 October 2026 and hold
 * nothing the cooperative can spend, so they are kept in the database for the
 * audit trail and shown to the committee on the dashboard's reconciliation
 * card instead.
 *
 * Without this note the two headline figures look like they disagree: the
 * kitty reads K18 higher than the contributions total, and that K18 is
 * exactly what the two closed buckets are in the hole by.
 */
export function KittyScopeNote({
  closed,
  showReconciliationCard = false,
}: {
  closed: ClosedBucket[];
  /**
   * True for the viewers who can see the dashboard's reconciliation card
   * (officers and the platform owner). Everyone else is pointed at the
   * committee's records instead.
   */
  showReconciliationCard?: boolean;
}) {
  if (closed.length === 0) return null;

  const total = closed.reduce((sum, bucket) => sum + bucket.balance, 0);
  const names = closed
    .map((bucket) => bucket.code + ' (' + formatCurrency(bucket.balance) + ')')
    .join(' and ');
  const state =
    total < 0
      ? 'which are ' + formatCurrency(Math.abs(total)) + ' in the hole'
      : 'which hold ' + formatCurrency(total);

  return (
    <p className="mt-1 text-xs text-muted-foreground">
      Active buckets only - excludes the closed {names}, {state}. Every bucket,
      open or closed, is{' '}
      {showReconciliationCard
        ? 'shown on the dashboard reconciliation card.'
        : "accounted for in the committee's records."}
    </p>
  );
}
