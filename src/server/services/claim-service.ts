/**
 * Welfare Claim Service (F5, S2 + S3)
 * ----------------------------------------------------------------------------
 * - Submit claim (any member)
 * - Approve claim (FW or Chair)
 * - Two-signature rule for any payout > K1,000
 * - Cap enforcement (S2)
 * - No cross-bucket borrowing (S4)
 * - All actions audited
 */

import { prisma } from '@/lib/db';
import { checkWelfareClaim, bucketCodeForClaimType, hasRequiredSignatures } from '@/lib/claim-rules';
import { logAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { config } from '@/lib/config';
import type { Role } from '@/lib/permissions';
import { applyWelfareOffset } from '@/server/services/soft-loan-service';

export interface SubmitClaimInput {
  memberId: string;
  type: 'FUNERAL' | 'MEDICAL';
  beneficiary: string;
  eventDate: Date;
  amountRequested: number;
  description: string;
  supportingDocUrl?: string;
  writtenConsent?: boolean;
}

export async function submitClaim(input: SubmitClaimInput) {
  // Check caps before submission, but allow submission even if over cap (for audit trail)
  const year = input.eventDate.getFullYear();
  const approvedThisYear = await prisma.welfareClaim.aggregate({
    _sum: { amountApproved: true },
    _count: true,
    where: {
      type: input.type,
      status: { in: ['APPROVED', 'PAID'] },
      paidAt: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) },
    },
  });

  const eventCountThisYear = await prisma.welfareClaim.count({
    where: {
      type: input.type,
      status: { in: ['APPROVED', 'PAID'] },
      paidAt: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) },
    },
  });

  const check = checkWelfareClaim({
    type: input.type,
    amountRequested: input.amountRequested,
    amountAlreadyApprovedThisYear: approvedThisYear._sum.amountApproved ?? 0,
    eventCountThisYear,
  });

  const claim = await prisma.welfareClaim.create({
    data: {
      memberId: input.memberId,
      type: input.type,
      beneficiary: input.beneficiary,
      eventDate: input.eventDate,
      amountRequested: input.amountRequested,
      status: 'PENDING',
      description: input.description,
      supportingDocUrl: input.supportingDocUrl,
      writtenConsent: input.writtenConsent ?? false,
    },
  });

  await logAudit({
    userId: input.memberId,
    action: AUDIT_ACTIONS.CLAIM_SUBMITTED,
    entity: 'WelfareClaim',
    entityId: claim.id,
    afterValue: { type: input.type, amount: input.amountRequested, beneficiary: input.beneficiary },
  });

  // Notify FW + Chair of new claim
  const fwChair = await prisma.user.findMany({
    where: { role: { in: ['FW', 'CHAIRPERSON'] } },
    select: { id: true },
  });

  for (const u of fwChair) {
    await prisma.notification.create({
      data: {
        userId: u.id,
        type: 'CLAIM_SUBMITTED',
        title: `New ${input.type.toLowerCase()} claim`,
        body: `A new claim of K${input.amountRequested} requires your review.`,
        link: `/claims/${claim.id}`,
      },
    });
  }

  return { claim, check };
}

export interface ApproveClaimInput {
  claimId: string;
  approverId: string;
  approverRole: Extract<Role, 'WELFARE_OFFICER' | 'FW' | 'CHAIRPERSON'>;
  amountApproved: number;
  capOverrideNote?: string;
}

export async function approveClaim(input: ApproveClaimInput) {
  const claim = await prisma.welfareClaim.findUnique({
    where: { id: input.claimId },
  });
  if (!claim) throw new Error('Claim not found');
  if (claim.status !== 'PENDING') throw new Error(`Claim is already ${claim.status}`);

  // Re-check caps
  const year = claim.eventDate.getFullYear();
  const approvedThisYear = await prisma.welfareClaim.aggregate({
    _sum: { amountApproved: true },
    _count: true,
    where: {
      type: claim.type,
      status: { in: ['APPROVED', 'PAID'] },
      id: { not: claim.id },
      paidAt: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) },
    },
  });

  const eventCountThisYear = await prisma.welfareClaim.count({
    where: {
      type: claim.type,
      status: { in: ['APPROVED', 'PAID'] },
      id: { not: claim.id },
      paidAt: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) },
    },
  });

  const check = checkWelfareClaim({
    type: claim.type as 'FUNERAL' | 'MEDICAL',
    amountRequested: input.amountApproved,
    amountAlreadyApprovedThisYear: approvedThisYear._sum.amountApproved ?? 0,
    eventCountThisYear,
    overrideNote: input.capOverrideNote,
  });

  if (!check.ok && !input.capOverrideNote) {
    throw new Error(
      `Cannot approve: ${check.blockers.join(' ')} Override note required.`
    );
  }

  // Constitution Art. 5.3: if a Welfare Officer is currently appointed, the
  // 3-sig rule applies. Otherwise the legacy 2-sig rule (FW + Chair) holds.
  const welfareOfficerAppointed =
    (await prisma.user.count({
      where: { role: 'WELFARE_OFFICER', isActive: true },
    })) > 0;

  // Prevent the same approver from signing twice in a different role
  if (input.approverRole === 'WELFARE_OFFICER' && claim.approvedByWelfareOfficerId) {
    throw new Error('A Welfare Officer has already approved this claim.');
  }
  if (input.approverRole === 'FW' && claim.approvedByFwId) {
    throw new Error('The Finance Warrant has already approved this claim.');
  }
  if (input.approverRole === 'CHAIRPERSON' && claim.approvedByChairId) {
    throw new Error('The Chairperson has already approved this claim.');
  }

  // Record this approver's signature in the role-specific field
  const updateData: any = {
    amountApproved: input.amountApproved,
    capOverrideNote: input.capOverrideNote,
    status: 'APPROVED',
  };

  if (input.approverRole === 'WELFARE_OFFICER') {
    updateData.approvedByWelfareOfficerId = input.approverId;
    updateData.approvedByWelfareOfficerAt = new Date();
  } else if (input.approverRole === 'FW') {
    updateData.approvedByFwId = input.approverId;
    updateData.approvedByFwAt = new Date();
  } else if (input.approverRole === 'CHAIRPERSON') {
    updateData.approvedByChairId = input.approverId;
    updateData.approvedByChairAt = new Date();
  }

  // Deduct from bucket (S4: only from FUNERAL or MEDICAL)
  const bucket = await prisma.bucket.findUnique({
    where: { code: bucketCodeForClaimType(claim.type as 'FUNERAL' | 'MEDICAL') },
  });
  if (!bucket) throw new Error('Bucket not found');

  // Constitution Art. 5.5(f)(iii): if the claimant gave written consent and
  // has a defaulted soft loan, the welfare payout is reduced by the
  // outstanding loan balance. The "saved" amount goes back to the loan.
  let offset = { welfareAmount: input.amountApproved, offsetAmount: 0, loanId: null as string | null };
  if (claim.writtenConsent) {
    offset = await applyWelfareOffset(claim.memberId, input.amountApproved);
  }

  if (bucket.balance < offset.welfareAmount) {
    throw new Error(`Bucket ${bucket.code} has insufficient balance (K${bucket.balance.toFixed(2)}).`);
  }

  updateData.bucketId = bucket.id;

  const updated = await prisma.$transaction(async (tx) => {
    const c = await tx.welfareClaim.update({
      where: { id: claim.id },
      data: updateData,
    });

    // Debit the welfare bucket by the (possibly reduced) amount
    await tx.bucket.update({
      where: { id: bucket.id },
      data: { balance: { decrement: offset.welfareAmount } },
    });

    await tx.bucketTransaction.create({
      data: {
        bucketId: bucket.id,
        amount: -offset.welfareAmount,
        type: 'WELFARE_PAYOUT',
        referenceType: 'WelfareClaim',
        referenceId: c.id,
      },
    });

    // If there was an offset, credit the SOFT_LOANS bucket and decrement
    // the loan balance. The loan balance decrement is the canonical record;
    // the bucket credit is the corresponding ledger entry.
    if (offset.offsetAmount > 0 && offset.loanId) {
      const softLoansBucket = await tx.bucket.findUnique({ where: { code: 'SOFT_LOANS' } });
      if (softLoansBucket) {
        await tx.bucket.update({
          where: { id: softLoansBucket.id },
          data: { balance: { increment: offset.offsetAmount } },
        });
        await tx.bucketTransaction.create({
          data: {
            bucketId: softLoansBucket.id,
            amount: offset.offsetAmount,
            type: 'SOFT_LOAN_REPAYMENT',
            referenceType: 'WelfareClaim',
            referenceId: c.id,
            note: `Welfare offset per Constitution Art. 5.5(f)(iii) for loan ${offset.loanId}`,
          },
        });
      }
      await tx.softLoan.update({
        where: { id: offset.loanId },
        data: { balance: { decrement: offset.offsetAmount } },
      });
    }

    return c;
  });

  // Re-evaluate the signature requirement after this approval.
  const needsApprovalLimit = Number(input.amountApproved) > config.governance.twoSignatureThreshold;
  const allRequiredSigsIn = hasRequiredSignatures(updated, welfareOfficerAppointed);
  const stillNeedsMoreSigs = needsApprovalLimit && !allRequiredSigsIn;

  if (stillNeedsMoreSigs) {
    // Notify the remaining required approvers
    const remainingRoles: Array<'WELFARE_OFFICER' | 'FW' | 'CHAIRPERSON'> = [];
    if (welfareOfficerAppointed && !updated.approvedByWelfareOfficerId) remainingRoles.push('WELFARE_OFFICER');
    if (!updated.approvedByFwId) remainingRoles.push('FW');
    if (!updated.approvedByChairId) remainingRoles.push('CHAIRPERSON');

    for (const role of remainingRoles) {
      const others = await prisma.user.findMany({
        where: { role, isActive: true },
        select: { id: true },
      });
      for (const u of others) {
        await prisma.notification.create({
          data: {
            userId: u.id,
            type: 'CLAIM_PENDING_2ND_SIG',
            title: `Claim awaiting your co-signature`,
            body: `K${input.amountApproved} claim requires ${role} approval.`,
            link: `/claims/${claim.id}`,
          },
        });
      }
    }
  }

  await logAudit({
    userId: input.approverId,
    action: AUDIT_ACTIONS.CLAIM_APPROVED,
    entity: 'WelfareClaim',
    entityId: claim.id,
    afterValue: {
      amount: input.amountApproved,
      approverRole: input.approverRole,
      overrideNote: input.capOverrideNote,
    },
  });

  if (input.capOverrideNote) {
    await logAudit({
      userId: input.approverId,
      action: AUDIT_ACTIONS.CAP_OVERRIDE,
      entity: 'WelfareClaim',
      entityId: claim.id,
      notes: input.capOverrideNote,
    });
  }

  // Notify claimant
  await prisma.notification.create({
    data: {
      userId: claim.memberId,
      type: 'CLAIM_APPROVED',
      title: `Your claim was approved`,
      body: `K${input.amountApproved} approved${stillNeedsMoreSigs ? ' (awaiting more signatures)' : ''}.`,
      link: `/claims/${claim.id}`,
    },
  });

  return { claim: updated, needsApprovalLimit, allRequiredSigsIn };
}

export async function rejectClaim(claimId: string, rejecterId: string, reason: string) {
  const claim = await prisma.welfareClaim.findUnique({ where: { id: claimId } });
  if (!claim) throw new Error('Claim not found');
  if (claim.status !== 'PENDING') throw new Error(`Claim is already ${claim.status}`);

  const updated = await prisma.welfareClaim.update({
    where: { id: claimId },
    data: { status: 'REJECTED', rejectedReason: reason },
  });

  await logAudit({
    userId: rejecterId,
    action: AUDIT_ACTIONS.CLAIM_REJECTED,
    entity: 'WelfareClaim',
    entityId: claimId,
    notes: reason,
  });

  await prisma.notification.create({
    data: {
      userId: claim.memberId,
      type: 'CLAIM_REJECTED',
      title: `Your claim was rejected`,
      body: reason.slice(0, 200),
      link: `/claims/${claimId}`,
    },
  });

  return updated;
}

export async function markClaimPaid(claimId: string, payerId: string) {
  const claim = await prisma.welfareClaim.findUnique({ where: { id: claimId } });
  if (!claim) throw new Error('Claim not found');
  if (claim.status !== 'APPROVED') throw new Error('Only APPROVED claims can be marked PAID');

  const updated = await prisma.welfareClaim.update({
    where: { id: claimId },
    data: { status: 'PAID', paidAt: new Date() },
  });

  await logAudit({
    userId: payerId,
    action: AUDIT_ACTIONS.CLAIM_PAID,
    entity: 'WelfareClaim',
    entityId: claimId,
  });

  await prisma.notification.create({
    data: {
      userId: claim.memberId,
      type: 'CLAIM_PAID',
      title: 'Your claim has been paid out',
      body: `K${claim.amountApproved?.toFixed(2)} transferred.`,
      link: `/claims/${claimId}`,
    },
  });

  return updated;
}
