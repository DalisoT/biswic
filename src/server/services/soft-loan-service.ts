/**
 * Soft Loan Service (Constitution Art. 5.5)
 * ----------------------------------------------------------------------------
 * Sacred rules (S7):
 *   S7a - Member must be active 6+ months, not in arrears, no outstanding
 *         loan, no prior default
 *   S7b - Max K3,000 principal, 6-month term, 5% p.a. interest
 *   S7c - Default after 2 missed monthly payments
 *   S7d - Defaulted members ineligible for new loans; welfare payouts may
 *         be reduced by the outstanding balance with their written consent
 *         (Constitution Art. 5.5(f)(iii))
 *   S7e - No self-approval (Constitution Art. 5.5(h))
 *
 * Flow:
 *   PENDING  -- 2 of 3 sub-committee approve -->  APPROVED  -- disburser
 *              runs disburseLoan()             -->  DISBURSED
 *   DISBURSED -- first repayment recorded      -->  REPAYING
 *   REPAYING  -- all repayments paid           -->  COMPLETED
 *              \-- 2 missed payments            -->  DEFAULTED
 *   any state -- sub-committee rejects         -->  REJECTED
 *
 * All actions audit-logged (S6). All amounts stored as Decimal for exact
 * arithmetic (matching the contribution / welfare pattern).
 */

import { prisma } from '@/lib/db';
import { logAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { config } from '@/lib/config';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compute the equal monthly instalment (principal + interest) for a loan.
 * Interest is calculated on the outstanding balance each month (simple
 * interest, monthly rate = annualRate / 12). For simplicity, we use a flat
 * totalRepayment = principal * (1 + annualRate * termYears) and split into
 * equal monthly payments. This matches how Zambian SACCOs typically quote
 * short-term member loans and is what the Constitution implies.
 */
export function computeLoanSchedule(principal: number, termMonths: number, annualRate: number = config.softLoans.interestRatePerAnnum) {
  const termYears = termMonths / 12;
  const totalRepayment = principal * (1 + annualRate * termYears);
  // Round each component to 2dp; last month absorbs the rounding remainder.
  const rawMonthly = totalRepayment / termMonths;
  const baseMonthly = Math.floor(rawMonthly * 100) / 100;
  const baseSum = baseMonthly * (termMonths - 1);
  const lastMonthly = Math.round((totalRepayment - baseSum) * 100) / 100;
  const totalInterest = totalRepayment - principal;
  const monthlyInterest = totalInterest / termMonths;
  const monthlyPrincipal = principal / termMonths;
  return {
    totalRepayment: Math.round(totalRepayment * 100) / 100,
    monthlyPayment: Math.round(rawMonthly * 100) / 100,
    totalInterest: Math.round(totalInterest * 100) / 100,
    schedule: Array.from({ length: termMonths }, (_, i) => ({
      monthIndex: i + 1,
      principal: Math.round(monthlyPrincipal * 100) / 100,
      interest: Math.round(monthlyInterest * 100) / 100,
      isLast: i === termMonths - 1,
      // The last month absorbs the rounding remainder on both fields
      payment: i === termMonths - 1 ? lastMonthly : baseMonthly,
    })),
  };
}

/**
 * Check whether a member is eligible for a new soft loan.
 * Sacred rule S7a: 6+ months member, not in arrears, no outstanding loan,
 * no prior default.
 */
export async function checkLoanEligibility(memberId: string, now: Date = new Date()): Promise<{
  eligible: boolean;
  reasons: string[];
}> {
  const reasons: string[] = [];

  const member = await prisma.user.findUnique({
    where: { id: memberId },
    select: { id: true, isActive: true, joinedAt: true, role: true, leftAt: true },
  });
  if (!member) {
    return { eligible: false, reasons: ['Member not found.'] };
  }
  if (!member.isActive) {
    reasons.push('Your membership is not active.');
  }
  if (member.leftAt) {
    reasons.push('You have left the Cooperative and are not eligible for new loans.');
  }

  // S7a(i) - 6+ months membership
  if (member.joinedAt) {
    const monthsSinceJoin =
      (now.getFullYear() - member.joinedAt.getFullYear()) * 12 +
      (now.getMonth() - member.joinedAt.getMonth());
    if (monthsSinceJoin < config.softLoans.minMembershipMonths) {
      reasons.push(
        `You must be a member for at least ${config.softLoans.minMembershipMonths} months (you joined ${monthsSinceJoin} months ago).`
      );
    }
  }

  // S7a(ii) - not in arrears: simplified check - any un-paid contribution
  // in the last 3 calendar months? (constitution says 3 consecutive months
  // for suspension; we use 3 months for the loan eligibility too.)
  const recentUnpaidCount = await (async () => {
    let count = 0;
    for (let i = 0; i < 3; i++) {
      const d = new Date(now);
      d.setMonth(d.getMonth() - i);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const exists = await prisma.contribution.findFirst({
        where: { memberId, year, month },
        select: { id: true },
      });
      if (!exists) count++;
    }
    return count;
  })();
  if (recentUnpaidCount > 0) {
    reasons.push('You have unpaid contributions in the last 3 months.');
  }

  // S7a(iii) - no outstanding loan
  const outstanding = await prisma.softLoan.findFirst({
    where: {
      applicantId: memberId,
      status: { in: ['PENDING', 'APPROVED', 'DISBURSED', 'REPAYING'] },
    },
    select: { id: true, balance: true },
  });
  if (outstanding) {
    reasons.push('You have an outstanding soft loan.');
  }

  // S7a(iv) - no prior default
  const priorDefault = await prisma.softLoan.findFirst({
    where: { applicantId: memberId, status: 'DEFAULTED' },
    select: { id: true },
  });
  if (priorDefault) {
    reasons.push('You have a prior defaulted loan. Clear it before applying for a new one.');
  }

  return { eligible: reasons.length === 0, reasons };
}

/**
 * Get the outstanding (active) loan for a member, if any. Used by the
 * welfare offset flow (S7d) to reduce payouts.
 */
export async function getOutstandingLoan(memberId: string) {
  return prisma.softLoan.findFirst({
    where: {
      applicantId: memberId,
      status: { in: ['DISBURSED', 'REPAYING', 'DEFAULTED'] },
    },
    orderBy: { disbursedAt: 'desc' },
    select: {
      id: true,
      principal: true,
      balance: true,
      status: true,
      defaultedAt: true,
    },
  });
}

// ---------------------------------------------------------------------------
// Application
// ---------------------------------------------------------------------------

export interface ApplyForLoanInput {
  applicantId: string;
  principal: number;
  termMonths: number;
  purpose: string;
  conflictDeclared?: boolean;
}

export async function applyForLoan(input: ApplyForLoanInput) {
  // S7a - eligibility
  const eligibility = await checkLoanEligibility(input.applicantId);
  if (!eligibility.eligible) {
    throw new Error(`Loan application rejected: ${eligibility.reasons.join(' ')}`);
  }

  // S7b - hard caps
  if (input.principal > config.softLoans.maxPrincipal) {
    throw new Error(
      `Principal K${input.principal.toFixed(2)} exceeds the cap of K${config.softLoans.maxPrincipal.toFixed(2)}.`
    );
  }
  if (input.termMonths < 1 || input.termMonths > config.softLoans.maxTermMonths) {
    throw new Error(
      `Term ${input.termMonths} months is outside the 1-${config.softLoans.maxTermMonths} month range.`
    );
  }
  if (!input.purpose || input.purpose.trim().length < 10) {
    throw new Error('Please provide a detailed purpose (minimum 10 characters).');
  }

  const schedule = computeLoanSchedule(input.principal, input.termMonths);

  const loan = await prisma.softLoan.create({
    data: {
      applicantId: input.applicantId,
      principal: input.principal,
      interestRate: config.softLoans.interestRatePerAnnum,
      termMonths: input.termMonths,
      monthlyPayment: schedule.monthlyPayment,
      totalRepayment: schedule.totalRepayment,
      balance: schedule.totalRepayment,
      purpose: input.purpose.trim(),
      conflictDeclared: input.conflictDeclared ?? false,
      status: 'PENDING',
    },
  });

  // Notify the active Lending Sub-Committee (chair + 2 members)
  const subCommittee = await prisma.lendingSubCommittee.findFirst({
    where: { isActive: true },
    select: { chairId: true, member1Id: true, member2Id: true },
  });
  const approverIds = subCommittee
    ? [subCommittee.chairId, subCommittee.member1Id, subCommittee.member2Id]
    : [];
  for (const userId of approverIds) {
    await prisma.notification.create({
      data: {
        userId,
        type: 'LOAN_APPLICATION',
        title: 'New Soft Loan application',
        body: `A new loan application for K${input.principal.toFixed(2)} awaits your approval.`,
        link: `/finance/soft-loan-applications/${loan.id}`,
      },
    });
  }

  await logAudit({
    userId: input.applicantId,
    action: AUDIT_ACTIONS.CREATE,
    entity: 'SoftLoan',
    entityId: loan.id,
    afterValue: {
      principal: input.principal,
      termMonths: input.termMonths,
      purpose: input.purpose,
    },
  });

  return { loan, schedule };
}
