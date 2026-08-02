/**
 * Unit tests for the SACRED welfare claim rules (S2 + S3).
 * - Funeral cap: K8,000 per event for first 24 months
 * - Funeral: max 1/year in Y1-2, 2/year from Y3
 * - Medical: K3,000 per event, max 2/year
 * - Two-signature rule: payouts > K1,000 need both FW and Chair
 * - Cap override requires a note
 */

import { describe, it, expect } from 'vitest';
import { checkWelfareClaim, hasBothSignatures } from '../../src/lib/claim-rules';
import { config } from '../../src/lib/config';

describe('checkWelfareClaim - FUNERAL', () => {
  it('approves a normal claim within cap', () => {
    const result = checkWelfareClaim({
      type: 'FUNERAL',
      amountRequested: 5000,
      amountAlreadyApprovedThisYear: 0,
      eventCountThisYear: 0,
    });
    expect(result.ok).toBe(true);
    expect(result.blockers).toHaveLength(0);
    expect(result.maxPerEvent).toBe(8000);
  });

  it('blocks a claim exceeding the per-event cap', () => {
    const result = checkWelfareClaim({
      type: 'FUNERAL',
      amountRequested: 9000,
      amountAlreadyApprovedThisYear: 0,
      eventCountThisYear: 0,
    });
    expect(result.ok).toBe(false);
    expect(result.blockers.length).toBeGreaterThan(0);
    expect(result.blockers[0]).toContain('8000');
  });

  it('blocks when annual event count is reached', () => {
    const result = checkWelfareClaim({
      type: 'FUNERAL',
      amountRequested: 5000,
      amountAlreadyApprovedThisYear: 0,
      eventCountThisYear: 1, // already at the limit (Y1-2)
    });
    expect(result.ok).toBe(false);
    expect(result.blockers.some((b) => b.includes('limit'))).toBe(true);
  });

  it('requires two signatures for amounts > K1,000', () => {
    const result = checkWelfareClaim({
      type: 'FUNERAL',
      amountRequested: 5000,
      amountAlreadyApprovedThisYear: 0,
      eventCountThisYear: 0,
    });
    expect(result.requiresTwoSignatures).toBe(true);
  });

  it('does NOT require two signatures for amounts <= K1,000', () => {
    const result = checkWelfareClaim({
      type: 'FUNERAL',
      amountRequested: 1000,
      amountAlreadyApprovedThisYear: 0,
      eventCountThisYear: 0,
    });
    expect(result.requiresTwoSignatures).toBe(false);
  });

  it('requires override note when over cap', () => {
    const result = checkWelfareClaim({
      type: 'FUNERAL',
      amountRequested: 9000,
      amountAlreadyApprovedThisYear: 0,
      eventCountThisYear: 0,
    });
    expect(result.requiresOverride).toBe(true);
  });

  it('does NOT require override when override note is provided', () => {
    const result = checkWelfareClaim({
      type: 'FUNERAL',
      amountRequested: 9000,
      amountAlreadyApprovedThisYear: 0,
      eventCountThisYear: 0,
      overrideNote: 'Special circumstances approved by 2/3 majority',
    });
    expect(result.requiresOverride).toBe(false);
  });

  it('warns when annual budget would be exceeded', () => {
    const result = checkWelfareClaim({
      type: 'FUNERAL',
      amountRequested: 5000,
      amountAlreadyApprovedThisYear: 5000, // 1 event already used (Y1-2 limit)
      eventCountThisYear: 1,
    });
    // The per-event cap is fine, but the year limit is reached
    expect(result.ok).toBe(false);
  });
});

describe('checkWelfareClaim - MEDICAL', () => {
  it('approves a normal medical claim within cap', () => {
    const result = checkWelfareClaim({
      type: 'MEDICAL',
      amountRequested: 2500,
      amountAlreadyApprovedThisYear: 0,
      eventCountThisYear: 0,
    });
    expect(result.ok).toBe(true);
    expect(result.maxPerEvent).toBe(3000);
  });

  it('blocks claim over K3,000 cap', () => {
    const result = checkWelfareClaim({
      type: 'MEDICAL',
      amountRequested: 3500,
      amountAlreadyApprovedThisYear: 0,
      eventCountThisYear: 0,
    });
    expect(result.ok).toBe(false);
    expect(result.blockers[0]).toContain('3000');
  });

  it('blocks when 2 events already used', () => {
    const result = checkWelfareClaim({
      type: 'MEDICAL',
      amountRequested: 1000,
      amountAlreadyApprovedThisYear: 0,
      eventCountThisYear: 2,
    });
    expect(result.ok).toBe(false);
  });

  it('returns MEDICAL bucket code', () => {
    const result = checkWelfareClaim({
      type: 'MEDICAL',
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

describe('config invariants', () => {
  it('two-signature threshold is K1,000', () => {
    expect(config.governance.twoSignatureThreshold).toBe(1000);
  });

  it('funeral cap is K8,000', () => {
    expect(config.welfareCaps.funeral.amountPerEvent).toBe(8000);
  });

  it('medical cap is K3,000', () => {
    expect(config.welfareCaps.medical.amountPerEvent).toBe(3000);
  });
});
