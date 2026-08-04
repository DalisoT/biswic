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
import { computeLoanSchedule } from '@/lib/soft-loan-math';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export { computeLoanSchedule };

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

// ---------------------------------------------------------------------------
// Sub-Committee approval (Constitution Art. 5.5(d))
// ---------------------------------------------------------------------------

export type LendingApproverRole = 'CHAIR' | 'MEMBER1' | 'MEMBER2';

export interface ApproveLoanInput {
  loanId: string;
  approverId: string;
  approverRole: LendingApproverRole;
}

export async function approveLoan(input: ApproveLoanInput) {
  const loan = await prisma.softLoan.findUnique({
    where: { id: input.loanId },
    include: { applicant: { select: { id: true, fullName: true, serviceNumber: true } } },
  });
  if (!loan) throw new Error('Loan not found.');
  if (loan.status !== 'PENDING') {
    throw new Error(`Loan is already ${loan.status}; cannot approve.`);
  }

  // S7e - no self-approval
  if (input.approverId === loan.applicantId) {
    throw new Error('You cannot approve a loan for yourself (Constitution Art. 5.5(h)).');
  }

  // Verify the approver is the role they claim to be
  const subCommittee = await prisma.lendingSubCommittee.findFirst({
    where: { isActive: true },
    select: { chairId: true, member1Id: true, member2Id: true },
  });
  if (!subCommittee) {
    throw new Error('No active Lending Sub-Committee is configured. Set one up before approving loans.');
  }
  const expectedApproverId =
    input.approverRole === 'CHAIR' ? subCommittee.chairId :
    input.approverRole === 'MEMBER1' ? subCommittee.member1Id :
    subCommittee.member2Id;
  if (input.approverId !== expectedApproverId) {
    throw new Error('You are not the recorded member of the Lending Sub-Committee for this role.');
  }

  // Mark this approver's sig on the loan
  const now = new Date();
  const updateData: any = {};
  if (input.approverRole === 'CHAIR') updateData.chairApprovedAt = now;
  if (input.approverRole === 'MEMBER1') updateData.member1ApprovedAt = now;
  if (input.approverRole === 'MEMBER2') updateData.member2ApprovedAt = now;

  // Special rule: if the applicant is one of the 3 sub-committee members,
  // the OTHER 2 must both approve (effectively 2-of-2 remaining).
  const isApplicantOnCommittee =
    loan.applicantId === subCommittee.chairId ||
    loan.applicantId === subCommittee.member1Id ||
    loan.applicantId === subCommittee.member2Id;

  if (isApplicantOnCommittee) {
    // After this approval, the remaining required sigs are the 2 that
    // are NOT the applicant. So we need both of them.
    const otherApprovals: LendingApproverRole[] = [];
    if (loan.applicantId !== subCommittee.chairId) otherApprovals.push('CHAIR');
    if (loan.applicantId !== subCommittee.member1Id) otherApprovals.push('MEMBER1');
    if (loan.applicantId !== subCommittee.member2Id) otherApprovals.push('MEMBER2');

    // The current approver is one of the others. We need ALL others.
    // Simpler rule: require every non-applicant approver to sign.
    // Since we just wrote one sig, the loan stays PENDING until the
    // remaining (non-applicant) role signs too.
  }

  const updated = await prisma.softLoan.update({
    where: { id: loan.id },
    data: updateData,
  });

  // Did we hit the threshold?
  const approvalsNeeded = isApplicantOnCommittee ? 2 : config.softLoans.requiredApprovals;
  const approvalsReceived =
    (updated.chairApprovedAt ? 1 : 0) +
    (updated.member1ApprovedAt ? 1 : 0) +
    (updated.member2ApprovedAt ? 1 : 0);

  if (approvalsReceived >= approvalsNeeded) {
    await prisma.softLoan.update({
      where: { id: loan.id },
      data: { approvedAt: now, status: 'APPROVED' },
    });

    // Notify applicant
    await prisma.notification.create({
      data: {
        userId: loan.applicantId,
        type: 'LOAN_APPROVED',
        title: 'Your soft loan was approved',
        body: `Your loan of K${Number(loan.principal).toFixed(2)} is approved. Awaiting disbursement.`,
        link: `/soft-loans/${loan.id}`,
      },
    });
  } else {
    // Still need more sigs - notify the remaining sub-committee members
    const remainingRoles: LendingApproverRole[] = [];
    if (isApplicantOnCommittee) {
      // The remaining 2 (non-applicant) members must still sign
      if (loan.applicantId !== subCommittee.chairId && !updated.chairApprovedAt) remainingRoles.push('CHAIR');
      if (loan.applicantId !== subCommittee.member1Id && !updated.member1ApprovedAt) remainingRoles.push('MEMBER1');
      if (loan.applicantId !== subCommittee.member2Id && !updated.member2ApprovedAt) remainingRoles.push('MEMBER2');
    } else {
      // Normal 2-of-3: any 2 needed
      if (!updated.chairApprovedAt) remainingRoles.push('CHAIR');
      if (!updated.member1ApprovedAt) remainingRoles.push('MEMBER1');
      if (!updated.member2ApprovedAt) remainingRoles.push('MEMBER2');
    }
    for (const role of remainingRoles) {
      const userId =
        role === 'CHAIR' ? subCommittee.chairId :
        role === 'MEMBER1' ? subCommittee.member1Id :
        subCommittee.member2Id;
      await prisma.notification.create({
        data: {
          userId,
          type: 'LOAN_PENDING_2ND_SIG',
          title: 'Soft Loan awaiting your co-approval',
          body: `K${Number(loan.principal).toFixed(2)} loan needs ${approvalsNeeded - approvalsReceived} more approval(s).`,
          link: `/finance/soft-loan-applications/${loan.id}`,
        },
      });
    }
  }

  await logAudit({
    userId: input.approverId,
    action: AUDIT_ACTIONS.UPDATE,
    entity: 'SoftLoan',
    entityId: loan.id,
    afterValue: { event: 'APPROVED', role: input.approverRole, isApplicantOnCommittee },
  });

  return { loan: updated, approvalsReceived, approvalsNeeded, fullyApproved: approvalsReceived >= approvalsNeeded };
}

export async function rejectLoan(loanId: string, rejecterId: string, reason: string) {
  const loan = await prisma.softLoan.findUnique({ where: { id: loanId } });
  if (!loan) throw new Error('Loan not found.');
  if (loan.status !== 'PENDING') throw new Error(`Loan is already ${loan.status}; cannot reject.`);

  const updated = await prisma.softLoan.update({
    where: { id: loanId },
    data: {
      status: 'REJECTED',
      rejectedAt: new Date(),
      rejectionReason: reason,
    },
  });

  await prisma.notification.create({
    data: {
      userId: loan.applicantId,
      type: 'LOAN_REJECTED',
      title: 'Your soft loan was rejected',
      body: reason.slice(0, 200),
      link: `/soft-loans/${loan.id}`,
    },
  });

  await logAudit({
    userId: rejecterId,
    action: AUDIT_ACTIONS.UPDATE,
    entity: 'SoftLoan',
    entityId: loanId,
    notes: reason,
  });

  return updated;
}

// ---------------------------------------------------------------------------
// Disbursement
// ---------------------------------------------------------------------------

export async function disburseLoan(loanId: string, disburserId: string) {
  const loan = await prisma.softLoan.findUnique({ where: { id: loanId } });
  if (!loan) throw new Error('Loan not found.');
  if (loan.status !== 'APPROVED') {
    throw new Error(`Loan is ${loan.status}; only APPROVED loans can be disbursed.`);
  }

  // Check the SOFT_LOANS bucket has enough balance
  const bucket = await prisma.bucket.findUnique({ where: { code: 'SOFT_LOANS' } });
  if (!bucket) throw new Error('SOFT_LOANS bucket not found.');
  if (Number(bucket.balance) < Number(loan.principal)) {
    throw new Error(
      `SOFT_LOANS bucket has insufficient balance (K${Number(bucket.balance).toFixed(2)}); ` +
      `need K${Number(loan.principal).toFixed(2)}.`
    );
  }

  // Compute the repayment schedule (use the one computed at approval)
  const schedule = computeLoanSchedule(Number(loan.principal), loan.termMonths, Number(loan.interestRate));

  // Disburse on the 5th of next month (matches the contribution pattern).
  // For simplicity, the first dueDate is "1 month from now".
  const now = new Date();
  const firstDue = new Date(now);
  firstDue.setMonth(firstDue.getMonth() + 1);
  firstDue.setDate(5);

  await prisma.$transaction(async (tx) => {
    // Update loan to DISBURSED
    await tx.softLoan.update({
      where: { id: loan.id },
      data: { status: 'DISBURSED', disbursedAt: now, balance: loan.totalRepayment },
    });

    // Create the repayment schedule
    for (const s of schedule.schedule) {
      const dueDate = new Date(firstDue);
      dueDate.setMonth(dueDate.getMonth() + (s.monthIndex - 1));
      await tx.softLoanRepayment.create({
        data: {
          loanId: loan.id,
          dueDate,
          expectedPrincipal: s.principal,
          expectedInterest: s.interest,
        },
      });
    }

    // Debit the SOFT_LOANS bucket
    await tx.bucket.update({
      where: { id: bucket.id },
      data: { balance: { decrement: loan.principal } },
    });
    await tx.bucketTransaction.create({
      data: {
        bucketId: bucket.id,
        amount: -loan.principal,
        type: 'SOFT_LOAN_DISBURSEMENT',
        referenceType: 'SoftLoan',
        referenceId: loan.id,
      },
    });
  });

  // Notify applicant
  await prisma.notification.create({
    data: {
      userId: loan.applicantId,
      type: 'LOAN_DISBURSED',
      title: 'Your soft loan has been disbursed',
      body: `K${Number(loan.principal).toFixed(2)} disbursed. First repayment of K${schedule.schedule[0].payment.toFixed(2)} due ${firstDue.toISOString().slice(0, 10)}.`,
      link: `/soft-loans/${loan.id}`,
    },
  });

  await logAudit({
    userId: disburserId,
    action: AUDIT_ACTIONS.UPDATE,
    entity: 'SoftLoan',
    entityId: loan.id,
    afterValue: { event: 'DISBURSED', principal: Number(loan.principal) },
  });

  return { loanId: loan.id, schedule };
}

// ---------------------------------------------------------------------------
// Repayment
// ---------------------------------------------------------------------------

export interface RecordRepaymentInput {
  repaymentId: string;
  paidPrincipal: number;
  paidInterest: number;
  recordedById: string;
}

export async function recordRepayment(input: RecordRepaymentInput) {
  const repayment = await prisma.softLoanRepayment.findUnique({
    where: { id: input.repaymentId },
    include: { loan: true },
  });
  if (!repayment) throw new Error('Repayment not found.');
  if (repayment.paidAt) throw new Error('This repayment was already recorded.');
  if (repayment.loan.status !== 'DISBURSED' && repayment.loan.status !== 'REPAYING' && repayment.loan.status !== 'DEFAULTED') {
    throw new Error(`Cannot record repayment for a loan in status ${repayment.loan.status}.`);
  }

  const bucket = await prisma.bucket.findUnique({ where: { code: 'SOFT_LOANS' } });
  if (!bucket) throw new Error('SOFT_LOANS bucket not found.');

  const paidTotal = input.paidPrincipal + input.paidInterest;
  const newBalance = Math.max(0, Number(repayment.loan.balance) - paidTotal);

  await prisma.$transaction(async (tx) => {
    await tx.softLoanRepayment.update({
      where: { id: repayment.id },
      data: {
        paidAt: new Date(),
        paidPrincipal: input.paidPrincipal,
        paidInterest: input.paidInterest,
        recordedById: input.recordedById,
      },
    });

    await tx.softLoan.update({
      where: { id: repayment.loanId },
      data: { balance: newBalance },
    });

    await tx.bucket.update({
      where: { id: bucket.id },
      data: { balance: { increment: paidTotal } },
    });
    await tx.bucketTransaction.create({
      data: {
        bucketId: bucket.id,
        amount: paidTotal,
        type: 'SOFT_LOAN_REPAYMENT',
        referenceType: 'SoftLoanRepayment',
        referenceId: repayment.id,
      },
    });
  });

  // Check if all repayments are now paid
  const remaining = await prisma.softLoanRepayment.count({
    where: { loanId: repayment.loanId, paidAt: null },
  });

  if (remaining === 0) {
    await prisma.softLoan.update({
      where: { id: repayment.loanId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
  } else if (repayment.loan.status === 'DISBURSED') {
    await prisma.softLoan.update({
      where: { id: repayment.loanId },
      data: { status: 'REPAYING' },
    });
  }

  await logAudit({
    userId: input.recordedById,
    action: AUDIT_ACTIONS.UPDATE,
    entity: 'SoftLoan',
    entityId: repayment.loanId,
    afterValue: {
      event: 'REPAYMENT_RECORDED',
      repaymentId: repayment.id,
      principal: input.paidPrincipal,
      interest: input.paidInterest,
    },
  });

  return { newBalance, fullyRepaid: remaining === 0 };
}
