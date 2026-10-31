/**
 * Unit tests for the welfare claim rules (S2 + S3).
 *
 * GM vote 2026-10-12 closed the FUNERAL and MEDICAL welfare pools along with
 * their buckets. That splits the rules into two groups:
 *
 *   1. LIVE: `checkWelfareClaim` must reject FUNERAL and MEDICAL submissions
 *      with a clear, citable reason, and the two-signature rule (S3) remains
 *      in force for any future welfare pool.
 *
 *   2. RETAINED: the cap-enforcement arithmetic (per-event cap, annual limit,
 *      budget warning, override note) still exists and will be revived if the
 *      GM re-introduces a welfare pool. It is tested through
 *      `checkClaimAgainstCaps`, which takes explicit caps -- so the logic
 *      stays covered without adding a production path that could re-enable a
 *      discontinued pool.
 */

import { describe, it, expect } from 'vitest';
import {
  checkWelfareClaim,
  checkClaimAgainstCaps,
  hasBothSignatures,
  hasRequiredSignatures,
} from '../../src/lib/claim-rules';
import { config } from '../../src/lib/config';

/**
 * The caps as they stood before the GM vote. Used only to exercise the
 * retained arithmetic.
 */
const HISTORICAL_FUNERAL_CAPS = { amountPerEvent: 8000, maxPerYear: 1 };
const HISTORICAL_MEDICAL_CAPS = { amountPerEvent: 3000, maxPerYear: 2 };

const funeralCheck = (
  input: Omit<Parameters<typeof checkClaimAgainstCaps>[0], 'type'>,
) =>
  checkClaimAgainstCaps(
    { type: 'FUNERAL', ...input },
    HISTORICAL_FUNERAL_CAPS,
    { bucketCode: 'FUNERAL', noun: 'funeral' },
  );

const medicalCheck = (
  input: Omit<Parameters<typeof checkClaimAgainstCaps>[0], 'type'>,
) =>
  checkClaimAgainstCaps(
    { type: 'MEDICAL', ...input },
    HISTORICAL_MEDICAL_CAPS,
    { bucketCode: 'MEDICAL', noun: 'medical' },
  );

describe('checkWelfareClaim - discontinued pools', () => {
  it('rejects FUNERAL submissions with a citable reason', () => {
    const result = checkWelfareClaim({
      type: 'FUNERAL',
      amountRequested: 5000,
      amountAlreadyApprovedThisYear: 0,
      eventCountThisYear: 0,
    });
    expect(result.ok).toBe(false);
    expect(result.blockers).toHaveLength(1);
    expect(result.blockers[0]).toContain('discontinued');
    expect(result.blockers[0]).toContain('2026-10-12');
    expect(result.maxPerEvent).toBe(0);
  });

  it('rejects MEDICAL submissions with a citable reason', () => {
    const result = checkWelfareClaim({
      type: 'MEDICAL',
      amountRequested: 1500,
      amountAlreadyApprovedThisYear: 0,
      eventCountThisYear: 0,
    });
    expect(result.ok).toBe(false);
    expect(result.blockers[0]).toContain('discontinued');
  });

  it('does not demand an override note for a discontinued pool', () => {
    const result = checkWelfareClaim({
      type: 'FUNERAL',
      amountRequested: 9000,
      amountAlreadyApprovedThisYear: 0,
      eventCountThisYear: 0,
    });
    expect(result.requiresOverride).toBe(false);
  });
});

describe('checkClaimAgainstCaps - FUNERAL (retained arithmetic)', () => {
  it('approves a normal claim within cap', () => {
    const result = funeralCheck({
      amountRequested: 5000,
      amountAlreadyApprovedThisYear: 0,
      eventCountThisYear: 0,
    });
    expect(result.ok).toBe(true);
    expect(result.blockers).toHaveLength(0);
    expect(result.maxPerEvent).toBe(8000);
  });

  it('blocks a claim exceeding the per-event cap', () => {
    const result = funeralCheck({
      amountRequested: 9000,
      amountAlreadyApprovedThisYear: 0,
      eventCountThisYear: 0,
    });
    expect(result.ok).toBe(false);
    expect(result.blockers.length).toBeGreaterThan(0);
    expect(result.blockers[0]).toContain('8000');
  });

  it('blocks when annual event count is reached', () => {
    const result = funeralCheck({
      amountRequested: 5000,
      amountAlreadyApprovedThisYear: 0,
      eventCountThisYear: 1,
    });
    expect(result.ok).toBe(false);
    expect(result.blockers.some((b) => b.includes('limit'))).toBe(true);
  });

  it('requires two signatures for amounts > K1,000', () => {
    const result = funeralCheck({
      amountRequested: 5000,
      amountAlreadyApprovedThisYear: 0,
      eventCountThisYear: 0,
    });
    expect(result.requiresTwoSignatures).toBe(true);
  });

  it('does NOT require two signatures for amounts <= K1,000', () => {
    const result = funeralCheck({
      amountRequested: 1000,
      amountAlreadyApprovedThisYear: 0,
      eventCountThisYear: 0,
    });
    expect(result.requiresTwoSignatures).toBe(false);
  });

  it('requires override note when over cap', () => {
    const result = funeralCheck({
      amountRequested: 9000,
      amountAlreadyApprovedThisYear: 0,
      eventCountThisYear: 0,
    });
    expect(result.requiresOverride).toBe(true);
  });

  it('does NOT require override when override note is provided', () => {
    const result = funeralCheck({
      amountRequested: 9000,
      amountAlreadyApprovedThisYear: 0,
      eventCountThisYear: 0,
      overrideNote: 'Special circumstances approved by 2/3 majority',
    });
    expect(result.requiresOverride).toBe(false);
  });

  it('warns when the annual budget would be exceeded', () => {
    const result = funeralCheck({
      amountRequested: 5000,
      amountAlreadyApprovedThisYear: 5000,
      eventCountThisYear: 1,
    });
    expect(result.ok).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toContain('annual funeral budget');
  });
});

describe('checkClaimAgainstCaps - MEDICAL (retained arithmetic)', () => {
  it('approves a normal medical claim within cap', () => {
    const result = medicalCheck({
      amountRequested: 1500,
      amountAlreadyApprovedThisYear: 0,
      eventCountThisYear: 0,
    });
    expect(result.ok).toBe(true);
    expect(result.maxPerEvent).toBe(3000);
  });

  it('blocks claim over K3,000 cap', () => {
    const result = medicalCheck({
      amountRequested: 3500,
      amountAlreadyApprovedThisYear: 0,
      eventCountThisYear: 0,
    });
    expect(result.ok).toBe(false);
    expect(result.blockers[0]).toContain('3000');
  });

  it('blocks when the annual event count is reached', () => {
    const result = medicalCheck({
      amountRequested: 1000,
      amountAlreadyApprovedThisYear: 0,
      eventCountThisYear: 2,
    });
    expect(result.ok).toBe(false);
  });

  it('returns the MEDICAL bucket code', () => {
    const result = medicalCheck({
      amountRequested: 500,
      amountAlreadyApprovedThisYear: 0,
      eventCountThisYear: 0,
    });
    expect(result.bucketCode).toBe('MEDICAL');
  });
});

describe('hasBothSignatures (S3)', () => {
  it('returns true for amounts <= K1,000 even without signatures', () => {
    expect(
      hasBothSignatures({
        amountRequested: 500,
        amountApproved: 500,
        approvedByFwId: null,
        approvedByChairId: null,
      })
    ).toBe(true);
  });

  it('returns false for amounts > K1,000 with only FW signature', () => {
    expect(
      hasBothSignatures({
        amountRequested: 5000,
        amountApproved: 5000,
        approvedByFwId: 'fw-id',
        approvedByChairId: null,
      })
    ).toBe(false);
  });

  it('returns false for amounts > K1,000 with only Chair signature', () => {
    expect(
      hasBothSignatures({
        amountRequested: 5000,
        amountApproved: 5000,
        approvedByFwId: null,
        approvedByChairId: 'chair-id',
      })
    ).toBe(false);
  });

  it('returns true for amounts > K1,000 with both signatures', () => {
    expect(
      hasBothSignatures({
        amountRequested: 5000,
        amountApproved: 5000,
        approvedByFwId: 'fw-id',
        approvedByChairId: 'chair-id',
      })
    ).toBe(true);
  });
});

describe('hasRequiredSignatures with a Welfare Officer appointed', () => {
  it('requires the Welfare Officer as well when one is appointed', () => {
    expect(
      hasRequiredSignatures(
        {
          amountRequested: 5000,
          amountApproved: 5000,
          approvedByWelfareOfficerId: null,
          approvedByFwId: 'fw-id',
          approvedByChairId: 'chair-id',
        },
        true,
      )
    ).toBe(false);
  });

  it('passes when all three signatures are present', () => {
    expect(
      hasRequiredSignatures(
        {
          amountRequested: 5000,
          amountApproved: 5000,
          approvedByWelfareOfficerId: 'wo-id',
          approvedByFwId: 'fw-id',
          approvedByChairId: 'chair-id',
        },
        true,
      )
    ).toBe(true);
  });
});

describe('config invariants', () => {
  it('two-signature threshold is K1,000', () => {
    expect(config.governance.twoSignatureThreshold).toBe(1000);
  });

  it('funeral pool is disabled with a zero cap', () => {
    expect(config.welfareCaps.funeral.disabled).toBe(true);
    expect(config.welfareCaps.funeral.amountPerEvent).toBe(0);
  });

  it('medical pool is disabled with a zero cap', () => {
    expect(config.welfareCaps.medical.disabled).toBe(true);
    expect(config.welfareCaps.medical.amountPerEvent).toBe(0);
  });
});
