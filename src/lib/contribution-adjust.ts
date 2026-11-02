import { compareMonth, formatMonthLabel, sameMonth, type MonthKey } from './member-leaving';

/**
 * Adjusting a payment that is on the ledger.
 * ---------------------------------------------------------------------------
 * WHY THIS EXISTS
 *
 * Two things go wrong with a monthly ledger, and they pull in opposite
 * directions:
 *
 *   1. A member pays a lump that covers several months. The arrears engine
 *      credits ONE month per contribution row, whatever the amount, so a
 *      K300 payment that covers three months only credits one of them and
 *      the member is shown as owing the other two. Four members did this:
 *      CHAMA J (K300), and MWANSA J, MUTAMBO S and KUNDA G (K200 each).
 *
 *   2. A row is on the ledger that was never a payment at all. Three rows
 *      for MWANSA JACOB were inserted by a SQL script whose own header says
 *      they exist "so the login good standing gate will let him in". They
 *      are money that was never received.
 *
 * Splitting fixes the first kind. Voiding fixes the second. Both rules live
 * here, in pure form, so they can be tested without a database and so the
 * action, the screen and the audit log all agree on what is allowed.
 *
 * THE RULES
 *
 *   SPLIT
 *   1. A split covers at least two months, and the month the payment is
 *      already booked against must be one of them. The payment stays where
 *      it is and gains the other months.
 *   2. The months must be distinct.
 *   3. The amount must divide evenly across the months. K300 over three
 *      months is K100 each; K200 over two is K100 each. A split that does
 *      not divide evenly is refused rather than rounded, because a rounding
 *      difference in the ledger is a difference in the money.
 *   4. No month may be before the month the member became liable to pay
 *      for. This is the same rule the payroll import and the
 *      single-contribution form already apply.
 *   5. The member must not already have a payment booked against one of the
 *      months being added. The ledger allows one payment per member per
 *      month.
 *
 *   VOID
 *   6. A void needs a reason. It is written to the audit log and cannot be
 *      changed afterwards.
 *   7. Voiding the only payment a member has will lock them out of the
 *      platform, because the good-standing gate blocks members with no
 *      contribution on file. That is reported as a warning, not a refusal:
 *      the row is still not a payment, whatever else it is.
 */

export interface SplitInput {
  /** The amount on the payment. */
  amount: number;
  /** The period the payment is booked against today. */
  current: MonthKey;
  /** The periods the payment should cover. */
  months: MonthKey[];
  /** The first period the member is liable to pay for. */
  firstLiable: MonthKey;
  /** The periods the member already has a payment booked against. */
  alreadyPaid: MonthKey[];
}

export type SplitPlan =
  | { ok: true; shares: { month: MonthKey; amount: number }[] }
  | { ok: false; error: string };

/**
 * Decide how a payment should be spread across the months it covers.
 *
 * Returns the share for each month, in month order, or the reason the split
 * is refused.
 */
export function planContributionSplit(input: SplitInput): SplitPlan {
  const { amount, current, months, firstLiable, alreadyPaid } = input;

  if (months.length < 2) {
    return {
      ok: false,
      error:
        'Choose at least two months: the month this payment is booked against, ' +
        'and the month or months it also covers.',
    };
  }

  if (!months.some((m) => sameMonth(m, current))) {
    return {
      ok: false,
      error:
        `This payment is booked against ${formatMonthLabel(current)}, so that month ` +
        'must be one of the months it covers.',
    };
  }

  for (let i = 0; i < months.length; i++) {
    for (let j = i + 1; j < months.length; j++) {
      if (sameMonth(months[i]!, months[j]!)) {
        return { ok: false, error: `${formatMonthLabel(months[i]!)} is listed twice.` };
      }
    }
  }

  const share = Number((amount / months.length).toFixed(2));
  if (Math.abs(share * months.length - amount) > 0.005) {
    return {
      ok: false,
      error:
        `K${amount.toFixed(2)} does not divide evenly into ${months.length} months. ` +
        'Split the difference by hand rather than rounding it.',
    };
  }

  for (const m of months) {
    if (compareMonth(m, firstLiable) < 0) {
      return {
        ok: false,
        error:
          `The member joined in ${formatMonthLabel(firstLiable)}, so this payment ` +
          `cannot cover ${formatMonthLabel(m)} (before joining).`,
      };
    }
  }

  for (const m of months) {
    if (sameMonth(m, current)) continue;
    if (alreadyPaid.some((p) => sameMonth(p, m))) {
      return {
        ok: false,
        error: `The member already has a payment booked for ${formatMonthLabel(m)}.`,
      };
    }
  }

  const ordered = [...months].sort((a, b) => compareMonth(a, b));
  return {
    ok: true,
    shares: ordered.map((m) => ({ month: m, amount: share })),
  };
}

/**
 * Divide an amount into N parts that add up to exactly the original.
 *
 * Works in whole cents, so no part is ever a fraction of a cent and the
 * parts always sum back to the amount. The extra cents go to the first
 * parts, so the split is deterministic.
 */
export function divideAmount(amount: number, parts: number): number[] {
  if (!Number.isInteger(parts) || parts < 1) {
    throw new Error('A split needs at least one part.');
  }
  const cents = Math.round(amount * 100);
  const base = Math.floor(cents / parts);
  const remainder = cents - base * parts;
  return Array.from({ length: parts }, (_, i) => (base + (i < remainder ? 1 : 0)) / 100);
}

/**
 * Split a set of bucket allocations across N shares.
 *
 * Each bucket's allocation is divided by the same number of parts, so the
 * money stays in the buckets it was already in. A payment made before the
 * FUNERAL and MEDICAL buckets were closed keeps its share of those buckets:
 * a split is a correction of which month the money belongs to, never a
 * re-allocation of the money itself.
 */
export function splitAllocations(
  allocations: { bucketId: string; amount: number }[],
  parts: number,
): { bucketId: string; amounts: number[] }[] {
  return allocations.map((a) => ({
    bucketId: a.bucketId,
    amounts: divideAmount(a.amount, parts),
  }));
}

export interface VoidInput {
  /** How many other payments this member has on the ledger. */
  otherPaymentCount: number;
  /** The reason the entry is being voided. */
  reason: string;
}

export type VoidPlan =
  | { ok: true; warning?: string }
  | { ok: false; error: string };

/**
 * Decide whether an entry that was never a payment may be removed.
 *
 * A void is different from every other change to the ledger: it takes a row
 * away. It is allowed only with a reason, and it is recorded in the audit
 * log. The warning about losing platform access is returned rather than
 * raised, because the row being wrong is the more important fact.
 */
export function planContributionVoid(input: VoidInput): VoidPlan {
  const reason = (input.reason ?? '').trim();
  if (reason.length < 5) {
    return {
      ok: false,
      error: 'Give a reason. It is written to the audit log and cannot be changed later.',
    };
  }
  if (input.otherPaymentCount === 0) {
    return {
      ok: true,
      warning:
        'This is the only payment on this member\'s record. Removing it will lock them ' +
        'out of the platform, because members must have a contribution on file to sign in.',
    };
  }
  return { ok: true };
}
