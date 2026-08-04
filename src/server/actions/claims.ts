'use server';

import { requireUser } from '@/lib/auth/require-user';
import { revalidatePath } from 'next/cache';
import { approveClaim, markClaimPaid, rejectClaim, submitClaim } from '@/server/services/claim-service';
import { canApproveWelfare } from '@/lib/permissions';
import { z } from 'zod';

const submitSchema = z.object({
  type: z.enum(['FUNERAL', 'MEDICAL']),
  beneficiary: z.enum(['self', 'parent', 'spouse', 'child', 'father', 'mother']),
  eventDate: z.string().min(1),
  amountRequested: z.coerce.number().positive(),
  description: z.string().min(1),
  supportingDocUrl: z.string().optional(),
});

export async function submitClaimAction(formData: FormData) {
  const user = await requireUser();

  const parsed = submitSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: 'Invalid input. ' + parsed.error.issues.map((i) => i.message).join(', ') };
  }

  try {
    await submitClaim({
      memberId: user.id,
      type: parsed.data.type,
      beneficiary: parsed.data.beneficiary,
      eventDate: new Date(parsed.data.eventDate),
      amountRequested: parsed.data.amountRequested,
      description: parsed.data.description,
      supportingDocUrl: parsed.data.supportingDocUrl,
    });
  } catch (err: any) {
    return { error: err.message ?? 'Failed to submit claim.' };
  }

  revalidatePath('/claims');
  revalidatePath('/dashboard');
  return { success: true };
}

const approveSchema = z.object({
  claimId: z.string().min(1),
  amountApproved: z.coerce.number().positive(),
  capOverrideNote: z.string().optional(),
});

export async function approveClaimAction(formData: FormData) {
  const user = await requireUser();

  if (!canApproveWelfare(user.role)) {
    return { error: 'You do not have permission to approve welfare claims.' };
  }

  const parsed = approveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: 'Invalid input. ' + parsed.error.issues.map((i) => i.message).join(', ') };
  }

  try {
    await approveClaim({
      claimId: parsed.data.claimId,
      approverId: user.id,
      approverRole: user.role as 'WELFARE_OFFICER' | 'FW' | 'CHAIRPERSON',
      amountApproved: parsed.data.amountApproved,
      capOverrideNote: parsed.data.capOverrideNote,
    });
  } catch (err: any) {
    return { error: err.message ?? 'Failed to approve claim.' };
  }

  revalidatePath('/claims');
  revalidatePath('/dashboard');
  return { success: true };
}

export async function rejectClaimAction(formData: FormData) {
  const user = await requireUser();

  if (!canApproveWelfare(user.role)) {
    return { error: 'You do not have permission to reject welfare claims.' };
  }

  const claimId = formData.get('claimId')?.toString();
  const reason = formData.get('reason')?.toString() ?? '';

  if (!claimId || reason.length < 5) {
    return { error: 'Reason is required (minimum 5 characters).' };
  }

  try {
    await rejectClaim(claimId, user.id, reason);
  } catch (err: any) {
    return { error: err.message ?? 'Failed to reject claim.' };
  }

  revalidatePath('/claims');
  return { success: true };
}

export async function markClaimPaidAction(formData: FormData) {
  const user = await requireUser();

  if (!canApproveWelfare(user.role)) {
    return { error: 'You do not have permission to mark claims paid.' };
  }

  const claimId = formData.get('claimId')?.toString();
  if (!claimId) return { error: 'Missing claim ID.' };

  try {
    await markClaimPaid(claimId, user.id);
  } catch (err: any) {
    return { error: err.message ?? 'Failed to mark claim paid.' };
  }

  revalidatePath('/claims');
  return { success: true };
}
