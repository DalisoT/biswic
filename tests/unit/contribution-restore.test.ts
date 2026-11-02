import { describe, it, expect } from 'vitest';
import { planContributionRestore } from '../../src/lib/contribution-restore';

const BEFORE = {
  memberServiceNumber: '104865',
  memberName: 'CHAMA J',
  amount: 100,
  month: 8,
  year: 2026,
  paymentMethod: 'CASH',
  receiptNumber: 'RCT-2026-08-104865',
  receivedAt: '2026-08-28T00:00:00.000Z',
  allocations: [{ bucketId: 'b1', amount: 4 }],
};

const base = {
  action: 'CONTRIBUTION_VOIDED',
  before: BEFORE,
  memberExists: true,
  memberAlreadyPaid: false,
  receiptTaken: false,
  reason: 'The payment was real and the void was a mistake.',
};

describe('planContributionRestore', () => {
  it('allows a voided payment to be put back', () => {
    expect(planContributionRestore(base).ok).toBe(true);
  });

  it('refuses an audit entry that is not a void', () => {
    const plan = planContributionRestore({ ...base, action: 'CONTRIBUTION_MOVED' });
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.error).toContain('not a voided payment');
  });

  it('refuses an audit entry with no readable row', () => {
    const plan = planContributionRestore({ ...base, before: null });
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.error).toContain('could not be read');
  });

  it('refuses a row that is missing the member or the amount', () => {
    const plan = planContributionRestore({
      ...base,
      before: { memberServiceNumber: '104865', month: 8, year: 2026 },
    });
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.error).toContain('incomplete');
  });

  it('refuses when the member has left the register', () => {
    const plan = planContributionRestore({ ...base, memberExists: false });
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.error).toContain('no longer on the register');
  });

  it('refuses when the member already has a payment for that month', () => {
    const plan = planContributionRestore({ ...base, memberAlreadyPaid: true });
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.error).toContain('two payments in one month');
  });

  it('refuses when the receipt number is already carrying another payment', () => {
    const plan = planContributionRestore({ ...base, receiptTaken: true });
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.error).toContain('receipt number');
  });

  it('refuses without a reason', () => {
    const plan = planContributionRestore({ ...base, reason: 'no' });
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.error).toContain('reason');
  });
});
