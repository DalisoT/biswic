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
      nationalRegistrationNumber: data.nrc || null,
      rank: data.rank || null,
      unit: data.unit || null,
      nextOfKin: (nextOfKin as any) ?? null,
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

// ----------------------------------------------------------------------------
// updateMemberAction
// ----------------------------------------------------------------------------
// In-app edit flow for the Chairperson or Secretary. Constitution Art. 2.3 +
// 6.4: officer promotions should be ratified at a GM. The role field IS
// editable here, but every change is logged with before/after so the next
// GM can ratify (or reject) the change. The UI shows a "GM ratification
// required" banner on the form.
// ----------------------------------------------------------------------------

import { ALL_ROLES, type Role } from '@/lib/permissions';

const updateSchema = z.object({
  memberId: z.string().uuid(),
  fullName: z.string().min(2, 'Full name is required.').max(120),
  email: z.string().email('Valid email is required.'),
  phone: z.string().regex(PHONE_RE, 'Phone must be +260XXXXXXXXX (9 digits).'),
  nrc: z.string().optional().nullable(),
  rank: z.string().optional().nullable(),
  unit: z.string().optional().nullable(),
  role: z.enum(ALL_ROLES as unknown as [Role, ...Role[]]),
  isActive: z.coerce.boolean().optional().default(true),
  nextOfKinName: z.string().optional().nullable(),
  nextOfKinRelationship: z.string().optional().nullable(),
  nextOfKinPhone: z.string().optional().nullable(),
});

export type UpdateMemberResult = {
  error?: string;
  success?: boolean;
  memberId?: string;
  roleChanged?: boolean;
};

export async function updateMemberAction(formData: FormData): Promise<UpdateMemberResult> {
  const user = await requireUser();
  if (!user.isAdmin && !canManageMembers(user.role)) {
    return { error: 'Only the Chairperson or Secretary may edit members.' };
  }

  const parsed = updateSchema.safeParse({
    memberId: formData.get('memberId'),
    fullName: formData.get('fullName'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    nrc: formData.get('nrc') || null,
    rank: formData.get('rank') || null,
    unit: formData.get('unit') || null,
    role: formData.get('role'),
    isActive: formData.get('isActive') === 'on' || formData.get('isActive') === 'true',
    nextOfKinName: formData.get('nextOfKinName') || null,
    nextOfKinRelationship: formData.get('nextOfKinRelationship') || null,
    nextOfKinPhone: formData.get('nextOfKinPhone') || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  }
  const data = parsed.data;

  // Cannot edit yourself into a different role (avoid lockout / role drift)
  if (data.memberId === user.id && data.role !== user.role) {
    return { error: 'You cannot change your own role. Ask another officer.' };
  }
  // Cannot edit yourself into inactive
  if (data.memberId === user.id && !data.isActive) {
    return { error: 'You cannot deactivate your own account.' };
  }

  // Fetch the before state for the audit log
  const before = await prisma.user.findUnique({
    where: { id: data.memberId },
    select: {
      serviceNumber: true,
      fullName: true,
      email: true,
      phone: true,
      nationalRegistrationNumber: true,
      rank: true,
      unit: true,
      role: true,
      isActive: true,
    },
  });
  if (!before) {
    return { error: 'Member not found.' };
  }

  // Uniqueness check on email + phone (excluding self)
  const conflict = await prisma.user.findFirst({
    where: {
      id: { not: data.memberId },
      OR: [{ email: data.email }, { phone: data.phone }],
    },
    select: { email: true, phone: true },
  });
  if (conflict) {
    if (conflict.email === data.email) return { error: `Email ${data.email} is already in use by another member.` };
    return { error: `Phone ${data.phone} is already in use by another member.` };
  }

  const nextOfKin =
    data.nextOfKinName || data.nextOfKinRelationship || data.nextOfKinPhone
      ? {
          name: data.nextOfKinName ?? '',
          relationship: data.nextOfKinRelationship ?? '',
          phone: data.nextOfKinPhone ?? '',
        }
      : null;

  const after = await prisma.user.update({
    where: { id: data.memberId },
    data: {
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
      nationalRegistrationNumber: data.nrc || null,
      rank: data.rank || null,
      unit: data.unit || null,
      role: data.role,
      isActive: data.isActive,
      nextOfKin: (nextOfKin as any) ?? null,
    },
  });

  // Mirror the email to Supabase auth.users so it actually works for login +
  // password reset. This is the same pattern used in updateProfileAction
  // (src/server/actions/profile.ts) for self-service email changes. Without
  // this, the Treasurer can set a member's email on the local DB but
  // /forgot-password and Supabase sign-in still look the user up by their
  // stale auth.users email (sentinel or previous real address), so the
  // change has no effect on the user's ability to sign in.
  //
  // email_confirm: true -- the Treasurer is authenticated and the member
  // is being edited by an officer, so we trust the new address. Skips the
  // confirmation round-trip.
  if (before.email !== after.email && after.email) {
    const admin = createAdminClient();
    const { error: authErr } = await admin.auth.admin.updateUserById(after.id, {
      email: after.email,
      email_confirm: true,
    });
    if (authErr) {
      const msg = authErr.message?.toLowerCase().includes('already')
        ? `That email is already associated with another account.`
        : `Could not update login email: ${authErr.message}`;
      return { error: msg };
    }
  }

  const roleChanged = before.role !== after.role;

  await logAudit({
    userId: user.id,
    action: AUDIT_ACTIONS.MEMBER_EDITED ?? 'MEMBER_EDITED',
    entity: 'User',
    entityId: data.memberId,
    beforeValue: before as Record<string, unknown>,
    afterValue: {
      fullName: after.fullName,
      email: after.email,
      phone: after.phone,
      nationalRegistrationNumber: after.nationalRegistrationNumber,
      rank: after.rank,
      unit: after.unit,
      role: after.role,
      isActive: after.isActive,
    },
    notes: roleChanged
      ? `Role changed: ${before.role} -> ${after.role} (Constitution Art. 6.4 - requires GM ratification)`
      : undefined,
  });

  revalidatePath('/members');
  revalidatePath(`/members/${data.memberId}/edit`);
  revalidatePath('/dashboard');

  return { success: true, memberId: data.memberId, roleChanged };
}

/**
 * Officer action: clear a member's login lockout so they can sign in again
 * immediately. Backs onto the clearLockoutAsAdmin helper in
 * src/lib/auth/auth-attempts.ts which logs the override to AuditLog.
 *
 * Used by /admin/lockouts so the Treasurer / Secretary can fix the
 * "5 failed attempts" trap from their phone during the WhatsApp-onboarding
 * rollout -- they don't have access to a terminal.
 */
export async function clearMemberLockAction(
  formData: FormData,
): Promise<{ error?: string; success?: boolean; memberId?: string }> {
  const { requireUser } = await import('@/lib/auth/require-user');
  const { clearLockoutAsAdmin } = await import('@/lib/auth/auth-attempts');
  const { headers } = await import('next/headers');

  const user = await requireUser();
  // Broader than canManageMembers: include Treasurer / FW / CCD so the
  // Treasurer can clear lockouts from their phone during onboarding.
  // Admins (isAdmin=true) bypass this regardless of role.
  const ALLOWED = [
    'CHAIRPERSON',
    'VICE_CHAIRPERSON',
    'SECRETARY',
    'TREASURER',
    'DEPUTY_TREASURER',
    'FW',
    'CCD',
  ];
  if (!user.isAdmin && !ALLOWED.includes(user.role)) {
    return { error: 'Only officers may clear a lockout.' };
  }

  const memberId = String(formData.get('memberId') ?? '');
  if (!memberId) {
    return { error: 'Missing memberId.' };
  }

  const target = await prisma.user.findUnique({
    where: { id: memberId },
    select: { id: true, lockedUntil: true, failedLoginAttempts: true },
  });
  if (!target) {
    return { error: 'Member not found.' };
  }
  if (!target.lockedUntil && (target.failedLoginAttempts ?? 0) === 0) {
    return { error: 'That member is not currently locked.' };
  }

  const hdrs = headers();
  const result = await clearLockoutAsAdmin({
    actorId: user.id,
    actorRole: user.role,
    targetUserId: target.id,
    ipAddress: hdrs.get('x-forwarded-for') ?? 'unknown',
    userAgent: hdrs.get('user-agent') ?? 'unknown',
  });
  if (!result.ok) {
    return { error: result.reason };
  }

  revalidatePath('/admin/lockouts');
  revalidatePath('/members');
  revalidatePath('/dashboard');
  return { success: true, memberId: target.id };
}

// =============================================================================
// Member removal (redacted deletion)
// =============================================================================
// "Deleting" a member in a financial system has to balance two conflicting
// requirements:
//
//   1. PRIVACY (GDPR / Zambian DPA): the member's PII (name, phone, email,
//      service number, NRC, next-of-kin, signature URL) must be unrecoverable
//      once they leave the cooperative. Hard delete would satisfy this, but...
//
//   2. AUDIT LAW (Zambia Income Tax Act + the cooperative's own constitution):
//      the financial record of every contribution and welfare claim must be
//      retained for the statutory minimum (typically 6 years for tax). The
//      SACRRED ledger, bucket balances, and audit log all depend on the User
//      row existing. Hard delete would wipe those records and put the
//      cooperative out of compliance.
//
// The compromise is REDACTED DELETION:
//
//   - The User row is preserved (so FKs from Contribution / WelfareClaim /
//     SoftLoan / AuditLog / etc. continue to resolve).
//   - All PII is overwritten with redaction markers:
//       serviceNumber         -> "DELETED-{first 8 chars of uuid}"
//       fullName              -> "[Redacted member]"
//       email                 -> NULL
//       phone                 -> "+260000000000" (preserves the @unique
//                               constraint)
//       nationalRegistrationNumber -> NULL
//       rank, unit            -> NULL
//       nextOfKin             -> NULL
//       membershipRegisterSignatureUrl -> NULL
//       foundingSignedAt, membershipRegisterSignedAt -> NULL
//   - isActive -> false (no logins)
//   - leftAt   -> NOW()   (the canonical "this member has left" timestamp)
//   - The Supabase auth.users row is deleted so the redacted User can never
//     be used to sign in.
//
// The original PII is captured in the AuditLog beforeValue so the cooperative
// still has an audit-grade paper trail of who left and when, but the live User
// row is no longer re-identifiable.
//
// Authorization: isAdmin only. This is the most destructive action in the
// system, so it should not be granted to standard officer roles. Even the
// Chairperson cannot remove a member without an admin override.
// =============================================================================

const deleteSchema = z.object({
  memberId: z.string().uuid(),
  // Confirmation: the actor must type the target's CURRENT service number.
  // This prevents accidental clicks from triggering a redaction. Compared
  // to "type DELETE", service-number confirmation is harder to mistype and
  // impossible to guess at scale.
  confirmServiceNumber: z.string().min(1, 'Service number confirmation is required.'),
  // Optional free-text reason, recorded in the audit log.
  reason: z.string().max(500).optional().nullable(),
});

export type DeleteMemberResult = {
  error?: string;
  success?: boolean;
  memberId?: string;
};

export async function deleteMemberAction(formData: FormData): Promise<DeleteMemberResult> {
  const { headers } = await import('next/headers');
  const user = await requireUser();

  // isAdmin is the ONLY role permitted to do this. Officers (Chairperson,
  // Secretary, etc.) can deactivate (isActive=false) but cannot anonymize
  // PII. The developer / platform owner (isAdmin) is the only one with the
  // privilege to make PII unrecoverable.
  if (!user.isAdmin) {
    return { error: 'Only the platform owner (isAdmin) can permanently remove a member.' };
  }

  const parsed = deleteSchema.safeParse({
    memberId: formData.get('memberId'),
    confirmServiceNumber: formData.get('confirmServiceNumber'),
    reason: formData.get('reason') || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  }
  const data = parsed.data;

  // Cannot delete yourself.
  if (data.memberId === user.id) {
    return { error: 'You cannot delete your own account. Ask another admin to do it.' };
  }

  const target = await prisma.user.findUnique({
    where: { id: data.memberId },
    select: {
      id: true,
      serviceNumber: true,
      fullName: true,
      email: true,
      phone: true,
      nationalRegistrationNumber: true,
      rank: true,
      unit: true,
      role: true,
      isActive: true,
      isFoundingMember: true,
      foundingSignedAt: true,
      joinedAt: true,
      leftAt: true,
      nextOfKin: true,
      membershipRegisterSignatureUrl: true,
    },
  });
  if (!target) {
    return { error: 'Member not found.' };
  }
  if (target.leftAt) {
    return { error: `This member was already removed on ${target.leftAt.toISOString().slice(0, 10)}.` };
  }

  // Confirmation: the typed service number must match the current one.
  if (data.confirmServiceNumber.trim().toUpperCase() !== target.serviceNumber.trim().toUpperCase()) {
    return { error: 'Confirmation service number does not match. Type the member\'s service number exactly to confirm.' };
  }

  // Capture the BEFORE state for the audit log. This is the only place the
  // original PII is preserved after the redaction.
  const before = { ...target };

  // Build the redacted row. Preserve the UUID (id) so all FKs still resolve.
  // The new service number is `DELETED-{first 8 of uuid}` so it's still
  // unique but doesn't reveal the original military service number.
  const redactedServiceNumber = `DELETED-${target.id.slice(0, 8).toUpperCase()}`;
  // The redacted phone must be unique (the schema enforces @unique). We use
  // a deterministic placeholder built from the UUID so re-running is safe.
  const redactedPhone = `+260${target.id.replace(/-/g, '').slice(0, 9)}`;

  await prisma.user.update({
    where: { id: target.id },
    data: {
      serviceNumber: redactedServiceNumber,
      fullName: '[Redacted member]',
      email: null,
      phone: redactedPhone,
      nationalRegistrationNumber: null,
      rank: null,
      unit: null,
      nextOfKin: null as any,
      membershipRegisterSignatureUrl: null,
      foundingSignedAt: null,
      membershipRegisterSignedAt: null,
      isActive: false,
      leftAt: new Date(),
    },
  });

  // Delete the Supabase auth.users row. This is the credential side of the
  // removal: even if someone had the redacted User's service number, they
  // couldn't sign in because the auth row no longer exists.
  //
  // We do this AFTER the DB update so the audit log can record the action
  // even if the auth delete fails (e.g. transient network issue). The
  // redaction in the DB is what matters for compliance; the auth delete
  // is a defense-in-depth.
  const admin = createAdminClient();
  const { error: authErr } = await admin.auth.admin.deleteUser(target.id);
  // We don't fail the action if the auth delete fails -- the DB redaction
  // is the source of truth. The error is captured for the audit log.
  const authDeleteSucceeded = !authErr;

  const hdrs = headers();
  await logAudit({
    userId: user.id,
    action: AUDIT_ACTIONS.MEMBER_REMOVED ?? 'MEMBER_REMOVED',
    entity: 'User',
    entityId: target.id,
    beforeValue: before as Record<string, unknown>,
    afterValue: {
      serviceNumber: redactedServiceNumber,
      fullName: '[Redacted member]',
      isActive: false,
      leftAt: new Date().toISOString(),
      authUserDeleted: authDeleteSucceeded,
    },
    ipAddress: hdrs.get('x-forwarded-for') ?? 'unknown',
    userAgent: hdrs.get('user-agent') ?? 'unknown',
    notes: data.reason
      ? `PII redacted. Reason: ${data.reason}`
      : 'PII redacted. No reason provided.',
  });

  revalidatePath('/members');
  revalidatePath(`/members/${target.id}/edit`);
  revalidatePath('/dashboard');
  revalidatePath('/admin/lockouts');
  // Revalidate the financial pages since the redacted member may still appear
  // in historical contribution / loan / audit views (redacted name + service
  // number, but the rows are still there).
  revalidatePath('/finance/contributions');
  revalidatePath('/finance/soft-loan-applications');
  revalidatePath('/finance/soft-loan-register');
  revalidatePath('/audit');

  return { success: true, memberId: target.id };
}
