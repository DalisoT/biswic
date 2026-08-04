'use server';

/**
 * Soft Loans server actions (Constitution Art. 5.5)
 * ----------------------------------------------------------------------------
 * The full approval / disbursement / repayment / default flow is built in
 * subsequent commits. This file holds the actions that are ready now.
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/require-user';
import { applyForLoan, checkLoanEligibility, getOutstandingLoan } from '@/server/services/soft-loan-service';

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
