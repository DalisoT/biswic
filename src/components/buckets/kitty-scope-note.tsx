import { formatCurrency } from '@/lib/utils';

export interface KittyScopeNoteProps {
  /** Everything members have contributed since the cooperative opened. */
  collected: number;
  /** Money spent out of the Admin & Audit bucket, net of withdrawals. */
  spent: number;
  /** Money out on soft loans: disbursed and not yet repaid. */
  lentOut: number;
  /** The two closed buckets' net balance. */
  closedTotal?: number;
  /**
   * True for the viewers who can see the dashboard's reconciliation card.
   */
  showReconciliationCard?: boolean;
}

/**
 * Explains what the kitty figure is.
 *
 * The kitty card shows what the cooperative holds right now. That is not the
 * same as what members have paid in: money spent on administration and money
 * lent out on soft loans has left the kitty, and the committee should be able
 * to see that at a glance.
 *
 * The note also carries the residue of the two closed buckets (FUNERAL and
 * MEDICAL) for as long as it is there. It was an old allocation artefact, not
 * money the cooperative owed.
 */
export function KittyScopeNote({
  collected,
  spent,
  lentOut,
  closedTotal = 0,
  showReconciliationCard = false,
}: KittyScopeNoteProps) {
  const residue = Math.abs(closedTotal);
  return (
    <p className="mt-1 text-xs text-muted-foreground">
      {formatCurrency(collected)} collected from members. {formatCurrency(spent)} spent on
      administration, {formatCurrency(lentOut)} out on soft loans.{' '}
      {residue > 0 && (
        <>
          {formatCurrency(residue)} is still sitting in the two closed buckets as an old
          allocation residue, not money owed.{' '}
        </>
      )}
      The kitty above is what the cooperative holds now.
      {showReconciliationCard && ' Every bucket movement is on the reconciliation card.'}
    </p>
  );
}
