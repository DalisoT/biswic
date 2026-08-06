'use server';

/**
 * Auth server actions: sign-in, sign-out, password reset.
 * ----------------------------------------------------------------------------
 * Replaces the old NextAuth v5 credentials provider. The user types a
 * service number + password; the server resolves the service number to an
 * email via Prisma (read) and then signs in through Supabase Auth (which
 * is what actually verifies the password and issues the session cookies).
 *
 * Login UX contract (per runbook constraint §4): service number + password,
 * never email. The "change password" form is gone -- use the reset-email
 * flow instead.
 */

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { config } from '@/lib/config';
import {
  checkLockout,
  recordFailedLogin,
  clearFailedLogins,
} from '@/lib/auth/auth-attempts';
import { logAudit, AUDIT_ACTIONS } from '@/lib/audit';

const signInSchema = z.object({
  serviceNumber: z.string().min(1, 'Service number is required.'),
  password: z.string().min(1, 'Password is required.'),
});

const resetSchema = z.object({
  serviceNumber: z.string().min(1, 'Service number is required.'),
});

export type SignInResult = { error: string } | undefined;
export type ResetResult = { error?: string; success?: string };

/**
 * Sign in with service number + password.
 *
 * Flow:
 *   1. Validate input.
 *   2. Check the lockout state. If locked, log a FAILED_LOGIN and return.
 *   3. Look up the user by serviceNumber. If not found, log FAILED_LOGIN
 *      and return a generic error (don't leak which field was wrong).
 *   4. Call supabase.auth.signInWithPassword() with the user's email and
 *      the password they typed.
 *   5. On failure, increment failedLoginAttempts and possibly set the
 *      lockout.
 *   6. On success, clear the counters, log LOGIN, redirect to /dashboard.
 */
export async function signInAction(
  formData: FormData
): Promise<SignInResult> {
  const parsed = signInSchema.safeParse({
    serviceNumber: formData.get('serviceNumber'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  }

  const serviceNumber = parsed.data.serviceNumber.toUpperCase().trim();
  const password = parsed.data.password;

  const hdrs = headers();
  const ipAddress = hdrs.get('x-forwarded-for') ?? 'unknown';
  const userAgent = hdrs.get('user-agent') ?? 'unknown';

  // 1. Lockout check
  const lockout = await checkLockout(serviceNumber);
  if (lockout.locked) {
    await logAudit({
      action: AUDIT_ACTIONS.FAILED_LOGIN,
      entity: 'User',
      entityId: serviceNumber,
      ipAddress,
      userAgent,
      notes: 'Sign-in attempt while locked',
    });
    return {
      error: `Account is temporarily locked. Try again at ${lockout.until?.toLocaleString()}.`,
    };
  }

  // 2. Resolve service number -> user
  const user = await prisma.user.findUnique({
    where: { serviceNumber },
    select: { id: true, email: true, isActive: true, fullName: true, role: true },
  });
  if (!user || !user.isActive) {
    await logAudit({
      action: AUDIT_ACTIONS.FAILED_LOGIN,
      entity: 'User',
      entityId: serviceNumber,
      ipAddress,
      userAgent,
      notes: user ? 'Inactive account' : 'Unknown service number',
    });
    return { error: 'Invalid service number or password.' };
  }

  // 2b. Payment gate (Constitution Art. -- "good standing" / paid-up members).
  // Members (role=MEMBER) must have at least one contribution record to log
  // in. Officers (any other role) bypass the check because they need access
  // to record payments, approve claims, and resolve disputes. The check is
  // off-by-config via BISWIC_REQUIRE_PAYMENT_TO_LOGIN so the chair can flip
  // it during the WhatsApp-onboarding rollout without a redeploy.
  if (config.requirePaymentToLogin && user.role === 'MEMBER') {
    const paidCount = await prisma.contribution.count({
      where: { memberId: user.id },
    });
    if (paidCount === 0) {
      await logAudit({
        action: AUDIT_ACTIONS.FAILED_LOGIN,
        entity: 'User',
        entityId: serviceNumber,
        ipAddress,
        userAgent,
        notes: 'Sign-in attempt: no contributions on file (good-standing gate)',
      });
      return {
        error:
          'Your account is not currently in good standing. Members must have at least one paid contribution to access the platform. ' +
          'Please contact the Treasurer (FW) to record your payment, or reach out to the Chairperson if you believe this is an error.',
      };
    }
  }

  // 3. Supabase sign-in
  // If the member has no real email on file yet, fall back to the RFC-2606
  // sentinel that the placeholder-cleanup script (scripts/clear-placeholder-emails.ts)
  // set in auth.users. That sentinel is unique per service number, so the
  // Supabase lookup still works. The user should still add a real email via
  // /settings (or via the Treasurer at /members/[id]/edit) so they can use
  // /forgot-password -- the dashboard's "Add your email" banner will keep
  // nudging them until they do.
  const supabase = createServerClient();
  const sentinelEmail = `null+${serviceNumber.toLowerCase()}@biswic.invalid`;
  const authEmail = user.email ?? sentinelEmail;
  const { error } = await supabase.auth.signInWithPassword({
    email: authEmail,
    password,
  });
  if (error) {
    await recordFailedLogin({
      userId: user.id,
      serviceNumber,
      ipAddress,
      userAgent,
    });
    return { error: 'Invalid service number or password.' };
  }

  // 4. Success
  await clearFailedLogins(user.id);
  await logAudit({
    userId: user.id,
    action: AUDIT_ACTIONS.LOGIN,
    entity: 'User',
    entityId: user.id,
    ipAddress,
    userAgent,
  });

  // redirect() throws; the function never returns past here.
  redirect('/dashboard');
}

/**
 * Sign out the current user. Clears the Supabase session cookies and
 * redirects to /login.
 */
export async function signOutAction(): Promise<never> {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    await logAudit({
      userId: user.id,
      action: AUDIT_ACTIONS.LOGOUT,
      entity: 'User',
      entityId: user.id,
    });
  }
  await supabase.auth.signOut();
  redirect('/login');
}

/**
 * Request a password-reset email. Always returns the same message to
 * avoid leaking which service numbers exist on file.
 *
 * The reset email will contain a link to ${NEXT_PUBLIC_APP_URL}/reset-password
 * where the user lands on a Supabase-recovery session and can set a new
 * password. Configure the Site URL + redirect allowlist in the Supabase
 * dashboard to match.
 */
export async function requestPasswordResetAction(
  formData: FormData
): Promise<ResetResult> {
  const parsed = resetSchema.safeParse({
    serviceNumber: formData.get('serviceNumber'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input.' };
  }
  const serviceNumber = parsed.data.serviceNumber.toUpperCase().trim();
  const user = await prisma.user.findUnique({
    where: { serviceNumber },
    select: { email: true },
  });

  if (user?.email) {
    const admin = createAdminClient();
    const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/reset-password`;
    const { error } = await admin.auth.resetPasswordForEmail(user.email, {
      redirectTo,
    });
    if (error) {
      // Don't expose the error to the user; log it for debugging.
      console.error('resetPasswordForEmail error:', error);
    }
  }

  return {
    success:
      'If that service number is on file, a password-reset email has been sent.',
  };
}
