import { compareMonth, formatMonthLabel, sameMonth, type MonthKey } from './member-leaving';

/**
 * Moving a recorded payment to a different month.
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS
 *
 * A contribution is booked against the month it belongs to, not the month the
 * money landed. Payroll is deducted late, mobile money is sent on the day the
 * money arrives, and a treasurer typing a receipt in by hand books it against
 * the wrong month. The ledger records the period a payment is FOR, so when it
 * is booked against the wrong period the member is shown as owing a month they
 * actually paid.
 *
 * That happened on 1 and 2 November 2026: four members paid money that belongs
 * to October 2026 and it was booked under November 2026. There was no way to
 * correct it, because the ledger only ever grew.
 *
 * The rules live here, in pure form, so they can be tested without a
 * database and so the server action, the screen and the audit trail all agree
 * on what a move may do.
 *
 * THE RULES
 *
 *   1. The target month must not be the month the payment is already booked
 *      for. There is nothing to move.
 *   2. The target month must not be before the month the member became
 *      liable to pay for. This is the same rule the payroll import and the
 *      single-contribution form already apply, and it is what stops a
 *      correction from booking money against a month the member was never a
 *      member for.
 *   3. The member must not already have a payment booked for the target
 *      month. The ledger allows one payment per member per month.
 *
 * A month AFTER the member left is allowed. The arrears engine already
 * reports money outside a member's liability window on its own line, so it is
 * neither lost nor silently swallowed.
 */

/** The period a payment is booked against. */
export type { MonthKey };

export interface MoveContributionInput {
  /** The period the payment is booked against today. */
  current: MonthKey;
  /** The period the payment should be booked against instead. */
  target: MonthKey;
  /** The first month the member is liable to pay for. */
  firstLiable: MonthKey;
  /** Does the member already have a payment booked for the target month? */
  targetAlreadyPaid: boolean;
}

export type MoveContributionCheck =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Decide whether a payment may be moved from one month to another.
 *
 * Returns the reason a move is refused, so the screen can tell the treasurer
 * exactly what is wrong instead of failing silently.
 */
export function checkContributionMove(
  input: MoveContributionInput,
): MoveContributionCheck {
  const { current, target, firstLiable, targetAlreadyPaid } = input;

  if (sameMonth(current, target)) {
    return {
      ok: false,
      error: `That payment is already booked for ${formatMonthLabel(target)}.`,
    };
  }

  if (compareMonth(target, firstLiable) < 0) {
    return {
      ok: false,
      error:
        `The member joined in ${formatMonthLabel(firstLiable)}, so the payment cannot be ` +
        `booked for ${formatMonthLabel(target)} (before joining).`,
    };
  }

  if (targetAlreadyPaid) {
    return {
      ok: false,
      error:
        `The member already has a payment booked for ${formatMonthLabel(target)}. ` +
        `A member can only have one payment per month.`,
    };
  }

  return { ok: true };
}
