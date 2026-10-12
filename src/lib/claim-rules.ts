/**
 * Welfare Claim Cap Enforcement (S2 + S3)
 * ----------------------------------------------------------------------------
 * SACRED RULE: Welfare caps protect the cooperative from being drained.
 * - Two-signature rule: any payout > K1,000 needs BOTH FW + Chair
 * - Cap override requires a 2/3 override note
 *
 * GM vote 2026-10-12: the FUNERAL and MEDICAL welfare pools were closed
 * along with their respective buckets. New claim submissions of those types
 * are now rejected at the rule layer. The WelfareClaim table itself stays
 * in the schema so the audit history of pre-2026-10 payouts remains
 * queryable, and the per-type helper functions are kept (in a disabled
 * shape) so the type union `ClaimType` still compiles.
 */

import { config, isInInitialPeriod, getFuncFalFuneralMaxPerYear } from './config';
import type { Prisma } from '@prisma/client';

/**
 * The 'FUNERAL' | 'MEDICAL' values remain in the union because the Prisma
 * `ClaimType` enum still exposes them — that keeps the schema in sync with
 * the live DB until a follow-up migration drops the enum values. New claims
 * of either type are rejected by `checkWelfareClaim` with a clear blocker.
 */
export type ClaimType = 'FUNERAL' | 'MEDICAL';
export type ClaimStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';

/**
 * Anything that acts like a number. Prisma's Decimal satisfies this via its
 * valueOf(); plain numbers work directly. Used in function signatures so the
 * rules can be called with either Prisma row data or pre-converted numbers.
 */
type NumericLike = number | Prisma.Decimal;

export interface ClaimCheckInput {
  type: ClaimType;
  amountRequested: number;
  amountAlreadyApprovedThisYear: number; // sum of APPROVED+PAID in current year
  eventCountThisYear: number;            // count of APPROVED+PAID in current year
  overrideNote?: string;
}

export interface ClaimCheckResult {
  ok: boolean;
  warnings: string[];
  blockers: string[];
  requiresOverride: boolean;
  requiresTwoSignatures: boolean;
  bucketCode: string;
  maxPerEvent: number;
}

/**
 * Single source of truth for "this claim type is no longer accepted".
 * Add new claim types below the two legacy blocks; the cap-enforcement
 * math for them lives in dedicated `if` branches.
 */
const DISABLED_CLAIM_TYPES: ReadonlySet<ClaimType> = new Set(['FUNERAL', 'MEDICAL']);

export function checkWelfareClaim(input: ClaimCheckInput): ClaimCheckResult {
  const { type, amountRequested, amountAlreadyApprovedThisYear, eventCountThisYear, overrideNote } = input;
  const blockers: string[] = [];
  const warnings: string[] = [];

  // Disabled-claim gate: GM vote 2026-10-12 closed the FUNERAL and MEDICAL
  // welfare pools. Reject new submissions of those types with a clear,
  // citable error so members understand why the form is now hidden.
  if (DISABLED_CLAIM_TYPES.has(type)) {
    return {
      ok: false,
      warnings,
      blockers: [
        `${type} claims were discontinued at the General Meeting of 2026-10-12. ` +
        `The cooperative no longer operates a dedicated welfare pool for this event type. ` +
        `If you have an emergency, raise it at the next monthly meeting for ad-hoc support.`,
      ],
      requiresOverride: false,
      requiresTwoSignatures: false,
      bucketCode: type,
      maxPerEvent: 0,
    };
  }

  if (type === 'FUNERAL') {
    const maxPerEvent = config.welfareCaps.funeral.amountPerEvent;
    const maxPerYear = getFuncFalFuneralMaxPerYear();

    // Per-event cap
    if (amountRequested > maxPerEvent) {
      blockers.push(
        `Requested amount K${amountRequested.toFixed(2)} exceeds the funeral cap of K${maxPerEvent.toFixed(2)} per event.`
      );
    }

    // Per-year limit
    if (eventCountThisYear >= maxPerYear) {
      blockers.push(
        `Annual funeral payout limit reached (${maxPerYear} per year${
          isInInitialPeriod() ? ' during the initial 24-month period' : ' from Year 3 onwards'
        }).`
      );
    }

    // Bucket dry check
    const remaining = maxPerEvent * maxPerYear - amountAlreadyApprovedThisYear;
    if (amountRequested > remaining && amountRequested <= maxPerEvent) {
      warnings.push(
        `This payout would exceed the annual funeral budget. Remaining this year: K${remaining.toFixed(2)}.`
      );
    }

    const requiresTwoSignatures = amountRequested > config.governance.twoSignatureThreshold;
    const requiresOverride = blockers.length > 0 && (!overrideNote || overrideNote.trim().length === 0);

    return {
      ok: blockers.length === 0,
      warnings,
      blockers,
      requiresOverride,
      requiresTwoSignatures,
      bucketCode: 'FUNERAL',
      maxPerEvent,
    };
  }

  if (type === 'MEDICAL') {
    const maxPerEvent = config.welfareCaps.medical.amountPerEvent;
    const maxPerYear = config.welfareCaps.medical.maxPerYear;

    if (amountRequested > maxPerEvent) {
      blockers.push(
        `Requested amount K${amountRequested.toFixed(2)} exceeds the medical cap of K${maxPerEvent.toFixed(2)} per event.`
      );
    }

    if (eventCountThisYear >= maxPerYear) {
      blockers.push(
        `Annual medical payout limit reached (${maxPerYear} per year).`
      );
    }

    const remaining = maxPerEvent * maxPerYear - amountAlreadyApprovedThisYear;
    if (amountRequested > remaining && amountRequested <= maxPerEvent) {
      warnings.push(
        `This payout would exceed the annual medical budget. Remaining this year: K${remaining.toFixed(2)}.`
      );
    }

    const requiresTwoSignatures = amountRequested > config.governance.twoSignatureThreshold;
    const requiresOverride = blockers.length > 0 && (!overrideNote || overrideNote.trim().length === 0);

    return {
      ok: blockers.length === 0,
      warnings,
      blockers,
      requiresOverride,
      requiresTwoSignatures,
      bucketCode: 'MEDICAL',
      maxPerEvent,
    };
  }

  // Unknown claim type
  return {
    ok: false,
    warnings: [],
    blockers: [`Unknown claim type: ${type}`],
    requiresOverride: false,
    requiresTwoSignatures: false,
    bucketCode: 'UNKNOWN',
    maxPerEvent: 0,
  };
}

/**
 * Determine if a claim has all the required signatures for its amount.
 *
 * Constitution Art. 5.3:
 *   - Welfare Officer + Finance Warrant + Chairperson  (when an Officer is
 *     appointed per Art. 6.6)
 *   - Finance Warrant + Chairperson  (otherwise; the legacy 2-sig rule)
 *
 * Below the two-signature threshold (K1,000), no signatures are required.
 *
 * `welfareOfficerAppointed` is computed at call time by the caller (the
 * service layer queries for an active WELFARE_OFFICER user). Keeping the
 * rule pure (no DB call) makes it easy to test and reason about.
 */
export function hasRequiredSignatures(
  claim: {
    amountRequested: NumericLike;
    amountApproved: NumericLike | null;
    approvedByWelfareOfficerId: string | null;
    approvedByFwId: string | null;
    approvedByChairId: string | null;
  },
  welfareOfficerAppointed: boolean,
): boolean {
  const amount = Number(claim.amountApproved ?? claim.amountRequested);
  if (amount <= config.governance.twoSignatureThreshold) return true;

  if (welfareOfficerAppointed) {
    return !!(
      claim.approvedByWelfareOfficerId &&
      claim.approvedByFwId &&
      claim.approvedByChairId
    );
  }
  return !!(claim.approvedByFwId && claim.approvedByChairId);
}

/**
 * Back-compat alias for callers that don't yet know about the Welfare
 * Officer role. Treats the claim as 2-sig (FW + Chair) only.
 */
export function hasBothSignatures(claim: {
  amountRequested: NumericLike;
  amountApproved: NumericLike | null;
  approvedByFwId: string | null;
  approvedByChairId: string | null;
}): boolean {
  return hasRequiredSignatures(
    { ...claim, approvedByWelfareOfficerId: null },
    false,
  );
}

/**
 * Get the bucket code for a claim type
 */
export function bucketCodeForClaimType(type: ClaimType): string {
  return type === 'FUNERAL' ? 'FUNERAL' : 'MEDICAL';
}
