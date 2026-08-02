'use server';

/**
 * Profile server actions.
 * ----------------------------------------------------------------------------
 * Replaces the previous auth() pattern with requireUser. The self-service
 * change-password action is GONE -- password changes go through the
 * reset-email flow (see src/server/actions/auth.ts and the
 * /forgot-password page).
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth/require-user';
import { logAudit, AUDIT_ACTIONS } from '@/lib/audit';

const profileSchema = z.object({
  fullName: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  rank: z.string().optional(),
  unit: z.string().optional(),
  nextOfKinName: z.string().optional(),
  nextOfKinRelationship: z.string().optional(),
  nextOfKinPhone: z.string().optional(),
});

export async function updateProfileAction(
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const user = await requireUser();

  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: 'Invalid input.' };
  }

  const nextOfKin = parsed.data.nextOfKinName
    ? {
        name: parsed.data.nextOfKinName,
        relationship: parsed.data.nextOfKinRelationship ?? '',
        phone: parsed.data.nextOfKinPhone ?? '',
      }
    : null;

  await prisma.user.update({
    where: { id: user.id },
    data: {
      fullName: parsed.data.fullName,
      phone: parsed.data.phone,
      email: parsed.data.email || null,
      rank: parsed.data.rank || null,
      unit: parsed.data.unit || null,
      nextOfKin: nextOfKin ? JSON.stringify(nextOfKin) : null,
    },
  });

  await logAudit({
    userId: user.id,
    action: AUDIT_ACTIONS.UPDATE,
    entity: 'User',
    entityId: user.id,
  });

  revalidatePath('/settings');
  return { success: true };
}
