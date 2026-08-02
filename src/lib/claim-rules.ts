/**
 * Welfare Claim Cap Enforcement (S2 + S3)
 * ----------------------------------------------------------------------------
 * SACRED RULE: Welfare caps protect the cooperative from being drained.
 * - Funeral: K8,000 max per event (first 24 months)
 * - Funeral: max 1/yr in Years 1-2, 2/yr from Year 3
 * - Medical: K3,000 max per event, max 2/yr
 * - Two-signature rule: any payout > K1,000 needs BOTH FW + Chair
 * - No cross-bucket borrowing: deductions only from FUNERAL or MEDICAL
 * - Cap override requires a 2/3 override note
 */

import { config, isInInitialPeriod, getFuncFalFuneralMaxPerYear } from './config';
import type { Prisma } from '@prisma/client';

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

export function checkWelfareClaim(input: ClaimCheckInput): ClaimCheckResult {
  const { type, amountRequested, amountAlreadyApprovedThisYear, eventCountThisYear, overrideNote } = input;
  const blockers: string[] = [];
  const warnings: string[] = [];

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
 * Determine if a claim has both required signatures (for amounts > K1,000)
 */
export function hasBothSignatures(claim: {
  amountRequested: NumericLike;
  amountApproved: NumericLike | null;
  approvedByFwId: string | null;
  approvedByChairId: string | null;
}): boolean {
  const amount = Number(claim.amountApproved ?? claim.amountRequested);
  if (amount <= config.governance.twoSignatureThreshold) return true;
  return !!(claim.approvedByFwId && claim.approvedByChairId);
}

/**
 * Get the bucket code for a claim type
 */
export function bucketCodeForClaimType(type: ClaimType): string {
  return type === 'FUNERAL' ? 'FUNERAL' : 'MEDICAL';
}
