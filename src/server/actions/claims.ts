'use server';

import { requireUser } from '@/lib/auth/require-user';
import { revalidatePath } from 'next/cache';
import { approveClaim, markClaimPaid, rejectClaim, submitClaim } from '@/server/services/claim-service';
import { canApproveWelfare } from '@/lib/permissions';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { createNotification } from '@/server/actions/notifications';
import { config } from '@/lib/config';

const submitSchema = z.object({
  type: z.enum(['FUNERAL', 'MEDICAL']),
  beneficiary: z.enum(['self', 'parent', 'spouse', 'child', 'father', 'mother']),
  eventDate: z.string().min(1),
  amountRequested: z.coerce.number().positive(),
  description: z.string().min(1),
  supportingDocUrl: z.string().optional(),
  writtenConsent: z.coerce.boolean().optional().default(false),
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
      writtenConsent: parsed.data.writtenConsent,
    });
  } catch (err: any) {
    return { error: err.message ?? 'Failed to submit claim.' };
  }

  // Live notification: confirm to the member that their claim was submitted
  await createNotification({
    userId: user.id,
    type: 'CLAIM',
    title: 'Welfare claim submitted',
    body: `Your ${parsed.data.type.toLowerCase()} claim for ${config.currency}${parsed.data.amountRequested} has been submitted and is awaiting review.`,
    link: '/claims',
  }).catch((err) => console.error('[notify] claim-submitted failed:', err));

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

  // Live notification: tell the claimant their claim was approved
  const claim = await prisma.welfareClaim.findUnique({
    where: { id: parsed.data.claimId },
    select: { memberId: true },
  });
  if (claim) {
    await createNotification({
      userId: claim.memberId,
      type: 'CLAIM',
      title: 'Welfare claim approved',
      body: `Your welfare claim for ${config.currency}${parsed.data.amountApproved} has been approved.`,
      link: '/claims',
    }).catch((err) => console.error('[notify] claim-approved failed:', err));
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

  // Live notification: tell the claimant their claim was denied
  const claim = await prisma.welfareClaim.findUnique({
    where: { id: claimId },
    select: { memberId: true },
  });
  if (claim) {
    await createNotification({
      userId: claim.memberId,
      type: 'CLAIM',
      title: 'Welfare claim denied',
      body: `Your welfare claim was denied. Reason: ${reason.slice(0, 100)}`,
      link: '/claims',
    }).catch((err) => console.error('[notify] claim-rejected failed:', err));
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

  // Live notification: tell the claimant the claim has been paid out
  const claim = await prisma.welfareClaim.findUnique({
    where: { id: claimId },
    select: { memberId: true, amountApproved: true, type: true },
  });
  if (claim && claim.amountApproved) {
    await createNotification({
      userId: claim.memberId,
      type: 'CLAIM',
      title: 'Welfare claim paid',
      body: `Your ${claim.type.toLowerCase()} claim (${config.currency}${claim.amountApproved}) has been paid. Collect from the Treasurer.`,
      link: '/claims',
    }).catch((err) => console.error('[notify] claim-paid failed:', err));
  }

  revalidatePath('/claims');
  return { success: true };
}
