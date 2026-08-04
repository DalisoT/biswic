'use server';

/**
 * Soft Loans server actions (Constitution Art. 5.5)
 * ----------------------------------------------------------------------------
 * Member actions: apply, view my loans, view outstanding.
 * Officer actions: approve, reject, disburse, record repayment.
 * (UI for the officer flow is built in commit 4; this commit ships the
 * service-layer primitives so the UI has something to call.)
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/require-user';
import {
  applyForLoan,
  approveLoan,
  checkLoanEligibility,
  disburseLoan,
  getOutstandingLoan,
  recordRepayment,
  rejectLoan,
  type LendingApproverRole,
} from '@/server/services/soft-loan-service';
import { computeLoanSchedule } from '@/lib/soft-loan-math';

const applySchema = z.object({
  principal: z.coerce.number().positive(),
  termMonths: z.coerce.number().int().min(1).max(6),
  purpose: z.string().min(10, 'Please provide a detailed purpose (min 10 chars).'),
  conflictDeclared: z.coerce.boolean().optional().default(false),
});

export type ApplyForLoanResult = { error?: string; success?: boolean; loanId?: string };

export async function applyForLoanAction(formData: FormData): Promise<ApplyForLoanResult> {
  const user = await requireUser();

  const parsed = applySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  }

  try {
    const { loan } = await applyForLoan({
      applicantId: user.id,
      principal: parsed.data.principal,
      termMonths: parsed.data.termMonths,
      purpose: parsed.data.purpose,
      conflictDeclared: parsed.data.conflictDeclared,
    });
    revalidatePath('/soft-loans');
    return { success: true, loanId: loan.id };
  } catch (err: any) {
    return { error: err.message ?? 'Failed to submit loan application.' };
  }
}

export async function checkEligibilityAction(): Promise<{ eligible: boolean; reasons: string[] }> {
  const user = await requireUser();
  return checkLoanEligibility(user.id);
}

export async function getOutstandingLoanAction() {
  const user = await requireUser();
  return getOutstandingLoan(user.id);
}

export async function previewLoanScheduleAction(
  principal: number,
  termMonths: number,
) {
  return computeLoanSchedule(principal, termMonths);
}

// ---------------------------------------------------------------------------
// Officer actions (Lending Sub-Committee, Treasurer / FW)
// ---------------------------------------------------------------------------

const approveSchema = z.object({
  loanId: z.string().min(1),
  approverRole: z.enum(['CHAIR', 'MEMBER1', 'MEMBER2']),
});

export async function approveLoanAction(formData: FormData) {
  const user = await requireUser();
  const parsed = approveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  }
  try {
    await approveLoan({
      loanId: parsed.data.loanId,
      approverId: user.id,
      approverRole: parsed.data.approverRole as LendingApproverRole,
    });
    revalidatePath('/finance/soft-loan-applications');
    return { success: true };
  } catch (err: any) {
    return { error: err.message ?? 'Failed to approve loan.' };
  }
}

const rejectSchema = z.object({
  loanId: z.string().min(1),
  reason: z.string().min(5, 'Rejection reason required (min 5 chars).'),
});

export async function rejectLoanAction(formData: FormData) {
  const user = await requireUser();
  const parsed = rejectSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  }
  try {
    await rejectLoan(parsed.data.loanId, user.id, parsed.data.reason);
    revalidatePath('/finance/soft-loan-applications');
    return { success: true };
  } catch (err: any) {
    return { error: err.message ?? 'Failed to reject loan.' };
  }
}

export async function disburseLoanAction(formData: FormData) {
  const user = await requireUser();
  const loanId = formData.get('loanId')?.toString();
  if (!loanId) return { error: 'Missing loanId.' };
  try {
    await disburseLoan(loanId, user.id);
    revalidatePath('/finance/soft-loan-applications');
    revalidatePath('/soft-loans');
    return { success: true };
  } catch (err: any) {
    return { error: err.message ?? 'Failed to disburse loan.' };
  }
}

const repaymentSchema = z.object({
  repaymentId: z.string().min(1),
  paidPrincipal: z.coerce.number().min(0),
  paidInterest: z.coerce.number().min(0),
});

export async function recordRepaymentAction(formData: FormData) {
  const user = await requireUser();
  const parsed = repaymentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  }
  try {
    await recordRepayment({
      repaymentId: parsed.data.repaymentId,
      paidPrincipal: parsed.data.paidPrincipal,
      paidInterest: parsed.data.paidInterest,
      recordedById: user.id,
    });
    revalidatePath('/soft-loans');
    return { success: true };
  } catch (err: any) {
    return { error: err.message ?? 'Failed to record repayment.' };
  }
}

