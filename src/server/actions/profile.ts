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
import { createAdminClient } from '@/lib/supabase/admin';

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
): Promise<{ error?: string; success?: boolean; message?: string }> {
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

  // Email sync: if the member typed a real email (or changed it), mirror it
  // into Supabase auth.users as well. The local DB alone isn't enough because
  // /forgot-password's resetPasswordForEmail() looks the user up by their
  // AUTH email, not the local one. We also need this so password reset can
  // actually deliver a link to the right address.
  //
  // email_confirm: true -- the user is already authenticated, so we trust
  // the new address. Skipping the confirmation email avoids a second SMTP
  // round-trip (which still depends on the operator wiring up Resend).
  const newEmail = parsed.data.email?.trim() || null;
  const previousUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { email: true },
  });
  const emailChanged =
    (newEmail ?? null) !== (previousUser?.email ?? null);

  if (emailChanged && newEmail) {
    const admin = createAdminClient();
    const { error: authErr } = await admin.auth.admin.updateUserById(user.id, {
      email: newEmail,
      email_confirm: true,
    });
    if (authErr) {
      // Common case: the new email is already in use by another auth user
      // (e.g. another member typed it by mistake). Bubble up a useful message.
      const msg = authErr.message?.toLowerCase().includes('already')
        ? `That email is already associated with another account. Use a different one.`
        : `Could not update login email: ${authErr.message}`;
      return { error: msg };
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      fullName: parsed.data.fullName,
      phone: parsed.data.phone,
      email: newEmail,
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
    notes: emailChanged ? 'Self-service profile update (email changed)' : 'Self-service profile update',
  });

  revalidatePath('/settings');
  revalidatePath('/dashboard');
  return {
    success: true,
    message: emailChanged && newEmail
      ? 'Profile saved. Your login email is now ' + newEmail + ' and password-reset emails will go there.'
      : 'Profile saved.',
  };
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
