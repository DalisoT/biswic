'use server';

/**
 * Profile server actions.
 * ----------------------------------------------------------------------------
 * Replaces the previous auth() pattern with requireUser. The self-service
 * change-password action is GONE -- password changes go through the
 * reset-email flow (see src/server/actions/auth.ts and the
 * /forgot-password page).
 *
 * markPasswordChangedAction: stamps User.lastPasswordChangedAt = now() so
 * the dashboard "set your password" nudge can be dismissed. Called by:
 *   1. /reset-password form after a successful Supabase updateUser()
 *   2. (Future) settings page inline password-change form
 * Does NOT itself change the password -- Supabase Auth owns that.
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
  nationalRegistrationNumber: z.string().optional().or(z.literal('')),
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
      nationalRegistrationNumber: parsed.data.nationalRegistrationNumber || null,
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

/**
 * Stamps the calling user's lastPasswordChangedAt = now(). The caller is
 * expected to have ALREADY updated the password in Supabase Auth (e.g.
 * via supabase.auth.updateUser({ password }) in the /reset-password
 * client component, or the future inline change-password form).
 *
 * This is a no-op if the timestamp is already set in this session -- it
 * always advances to now() so admin-initiated resets also count.
 */
export async function markPasswordChangedAction(): Promise<{ success: true }> {
  const user = await requireUser();

  await prisma.user.update({
    where: { id: user.id },
    data: { lastPasswordChangedAt: new Date() },
  });

  await logAudit({
    userId: user.id,
    action: AUDIT_ACTIONS.UPDATE,
    entity: 'User',
    entityId: user.id,
    notes: 'Password changed (timestamp updated)',
  });

  // Bust the dashboard cache so the "set your password" nudge disappears
  // immediately after the reset flow.
  revalidatePath('/dashboard');
  revalidatePath('/settings');

  return { success: true };
}
