/**
 * Putting back a payment that was voided.
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS
 *
 * A void takes a row off the ledger. Sometimes the row was never a payment
 * and it must stay gone -- three rows for MWANSA JACOB were written by a
 * script whose own header says they exist "so the login good standing gate
 * will let him in".
 *
 * Sometimes the void was the mistake. A payment that was real was voided
 * because it was read as a duplicate, and the member's ledger then says they
 * never paid. The money is real, the receipt is real, and the only honest
 * repair is to put the row back exactly as it was -- same amount, same
 * month, same receipt, same date received, and the same bucket allocations
 * it was recorded with. Re-recording it through the ordinary form would give
 * it today's bucket percentages instead, which would quietly move money
 * between buckets that were set by a different constitution.
 *
 * So a restore reads the voided row back out of the audit log, where the
 * whole row was recorded before it was removed, and puts it back.
 *
 * THE RULES
 *
 *   1. Only an audit entry that recorded a void can be restored.
 *   2. The member has to still be on the register.
 *   3. The member must not already have a payment booked for that month.
 *   4. The receipt number must not already be carrying another payment.
 *   5. A restore needs a reason. It is written to the audit log.
 */

export interface RestoreVoidInput {
  /** The action recorded in the audit log. */
  action: string | null;
  /** The row as it was before the void, as recorded in the audit log. */
  before: unknown;
  /** Is the member still on the register? */
  memberExists: boolean;
  /** Does the member already have a payment booked for that period? */
  memberAlreadyPaid: boolean;
  /** Is the receipt number already used by another payment? */
  receiptTaken: boolean;
  /** The reason for the restore. */
  reason: string;
}

export type RestorePlan = { ok: true } | { ok: false; error: string };

/**
 * Decide whether a voided payment may be put back.
 *
 * Returns the reason it may not be, or ok when it may.
 */
export function planContributionRestore(input: RestoreVoidInput): RestorePlan {
  if (input.action !== 'CONTRIBUTION_VOIDED') {
    return {
      ok: false,
      error: 'That audit entry is not a voided payment, so there is nothing to put back.',
    };
  }

  const before = input.before as Record<string, unknown> | null;
  if (!before || typeof before !== 'object') {
    return {
      ok: false,
      error: 'The voided payment could not be read from the audit log.',
    };
  }
  if (
    typeof before.memberServiceNumber !== 'string' ||
    typeof before.amount !== 'number' ||
    typeof before.month !== 'number' ||
    typeof before.year !== 'number'
  ) {
    return {
      ok: false,
      error: 'The voided payment in the audit log is incomplete and cannot be put back.',
    };
  }

  if (!input.memberExists) {
    return {
      ok: false,
      error: 'The member on that voided payment is no longer on the register.',
    };
  }

  if (input.memberAlreadyPaid) {
    return {
      ok: false,
      error:
        'The member already has a payment booked for that month, so the voided row ' +
        'cannot be put back without two payments in one month.',
    };
  }

  if (input.receiptTaken) {
    return {
      ok: false,
      error: 'Another payment already carries that receipt number.',
    };
  }

  if ((input.reason ?? '').trim().length < 5) {
    return {
      ok: false,
      error: 'Give a reason. It is written to the audit log and cannot be changed later.',
    };
  }

  return { ok: true };
}
