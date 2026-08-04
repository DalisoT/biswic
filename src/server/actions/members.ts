'use server';

/**
 * Member administration server actions (Constitution Art. 2)
 * ----------------------------------------------------------------------------
 * - createMemberAction: in-app flow for the Chairperson or Secretary to
 *   onboard a new member. Honours the founding lock (Constitution Art. 2.2)
 *   until config.governance.foundingLockReleased is set to true.
 * - The new user receives a Supabase password-recovery email so they can
 *   set their own password (no need to share a temp password over an
 *   insecure channel).
 *
 * Role-restricted per Constitution Art. 2.3 + 6.4: only MEMBER role may be
 * assigned via this flow. Officer promotions go through the GM election
 * flow (Phase 2).
 */

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireUser } from '@/lib/auth/require-user';
import { canManageMembers } from '@/lib/permissions';
import { logAudit, AUDIT_ACTIONS } from '@/lib/audit';
import { isFoundingLockActive } from '@/lib/config';

// Zambian phone format: +260 followed by 9 digits (e.g. +260971234567)
const PHONE_RE = /^\+260\d{9}$/;

const createSchema = z.object({
  serviceNumber: z.string().min(1, 'Service number is required.').max(32),
  fullName: z.string().min(2, 'Full name is required.').max(120),
  phone: z.string().regex(PHONE_RE, 'Phone must be in the format +260XXXXXXXXX (9 digits after +260).'),
  email: z.string().email('Valid email is required.'),
  nrc: z.string().optional(),
  rank: z.string().optional(),
  unit: z.string().optional(),
  // Constitution Art. 2.3 + 6.4: new admissions are MEMBER only; officer
  // promotions go through the GM election flow. We accept the field for
  // future-proofing but force it to MEMBER for now.
  role: z.enum(['MEMBER']).default('MEMBER'),
  nextOfKinName: z.string().optional(),
  nextOfKinRelationship: z.string().optional(),
  nextOfKinPhone: z.string().optional(),
  proposerServiceNumber: z.string().optional(),
  seconderServiceNumber: z.string().optional(),
});

export type CreateMemberResult = { error?: string; success?: boolean; userId?: string };

function generateTempPassword(): string {
  // 16 chars, no ambiguous characters (0/O, 1/l/I). The new user resets
  // it via the recovery email; this is never typed by anyone.
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pwd = '';
  for (let i = 0; i < 16; i++) {
    pwd += chars[Math.floor(Math.random() * chars.length)];
  }
  return pwd;
}

export async function createMemberAction(formData: FormData): Promise<CreateMemberResult> {
  const user = await requireUser();
  if (!canManageMembers(user.role)) {
    return { error: 'Only the Chairperson or Secretary may add new members.' };
  }

  // Constitution Art. 2.2: founding lock until Cooperative is registered
  if (isFoundingLockActive()) {
    return {
      error:
        'Constitution Art. 2.2: no new members may be admitted before the Cooperative is formally registered. ' +
        'Set config.governance.foundingLockReleased = true after registration to unlock this flow.',
    };
  }

  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  }
  const data = parsed.data;

  // Constitution Art. 2.4 + 2.5: enforce uniqueness on service number,
  // email, and phone. Service number is the canonical human-facing ID.
  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { serviceNumber: data.serviceNumber },
        { email: data.email },
        { phone: data.phone },
      ],
    },
    select: { serviceNumber: true, email: true, phone: true },
  });
  if (existing) {
    if (existing.serviceNumber === data.serviceNumber) {
      return { error: `Service number ${data.serviceNumber} is already in use.` };
    }
    if (existing.email === data.email) {
      return { error: `Email ${data.email} is already in use.` };
    }
    return { error: `Phone ${data.phone} is already in use.` };
  }

  const tempPassword = generateTempPassword();
  const admin = createAdminClient();

  // Create in Supabase auth. The handle_new_auth_user() trigger mirrors the
  // row into public."User" -- so all 4 trigger-required fields
  // (service_number, full_name, role, phone) MUST be in user_metadata.
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: data.email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      service_number: data.serviceNumber,
      full_name: data.fullName,
      role: data.role,
      phone: data.phone,
    },
  });
  if (authError) {
    return { error: `Failed to create auth user: ${authError.message}` };
  }
  if (!authData.user) {
    return { error: 'Auth user creation returned no user.' };
  }
  const userId = authData.user.id;

  // Fill in the fields the trigger doesn't set: NRC, rank, unit, nextOfKin.
  // Constitution Art. 2.6 requires the membership register to capture all
  // of these; the trigger only writes the bare minimum.
  const nextOfKin = data.nextOfKinName
    ? {
        name: data.nextOfKinName,
        relationship: data.nextOfKinRelationship ?? '',
        phone: data.nextOfKinPhone ?? '',
      }
    : null;

  await prisma.user.update({
    where: { id: userId },
    data: {
      nrc: data.nrc || null,
      rank: data.rank || null,
      unit: data.unit || null,
      nextOfKin: nextOfKin ? JSON.stringify(nextOfKin) : null,
    },
  });

  // Send the password-recovery email so the new user can set their own
  // password. Falls back to a console warning if the email fails -- the
  // Secretary can re-trigger the email from the Supabase dashboard.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const { error: linkError } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: data.email,
    options: { redirectTo: `${appUrl}/reset-password` },
  });
  if (linkError) {
    console.error('[createMember] generateLink failed:', linkError);
  }

  await logAudit({
    userId: user.id,
    action: AUDIT_ACTIONS.MEMBER_ADDED,
    entity: 'User',
    entityId: userId,
    afterValue: {
      serviceNumber: data.serviceNumber,
      fullName: data.fullName,
      role: data.role,
      proposedBy: data.proposerServiceNumber,
      secondedBy: data.seconderServiceNumber,
    },
  });

  // In-app welcome notification (visible to the new user on first login)
  await prisma.notification.create({
    data: {
      userId,
      type: 'WELCOME',
      title: 'Welcome to BISWIC',
      body: `Your account has been created by ${user.fullName}. Check your email to set your password, then sign in.`,
      link: '/dashboard',
    },
  });

  revalidatePath('/members');
  return { success: true, userId };
}
