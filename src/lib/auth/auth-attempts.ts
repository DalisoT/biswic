/**
 * App-layer login lockout (S6 hardening).
 * ----------------------------------------------------------------------------
 * Uses the existing User.failedLoginAttempts + User.lockedUntil columns
 * (declared in prisma/schema.prisma). Per the runbook, we deliberately
 * do NOT create a separate AuthAttempt table -- the User fields are
 * sufficient for the 5-attempts / 30-minute rule and avoid extra schema.
 *
 * Every transition writes an AuditLog row so the S6 "audit log everything"
 * rule is satisfied even when the lockout is at the application layer.
 */

import { prisma } from '@/lib/db';
import { config } from '@/lib/config';
import { logAudit, AUDIT_ACTIONS } from '@/lib/audit';

const MAX_ATTEMPTS = config.security.maxFailedLoginAttempts; // 5
const LOCKOUT_MINUTES = config.security.lockoutMinutes; // 30

export type LockoutState = {
  locked: boolean;
  until?: Date;
};

/**
 * Check whether the user behind a service number is currently locked out.
 * Used at the top of signInAction BEFORE attempting to verify the password.
 */
export async function checkLockout(serviceNumber: string): Promise<LockoutState> {
  const user = await prisma.user.findUnique({
    where: { serviceNumber },
    select: { id: true, lockedUntil: true },
  });
  if (!user?.lockedUntil) return { locked: false };
  if (user.lockedUntil > new Date()) {
    return { locked: true, until: user.lockedUntil };
  }
  return { locked: false };
}

/**
 * Increment failedLoginAttempts. If the threshold is reached, set
 * lockedUntil to now + LOCKOUT_MINUTES. Logs to AuditLog either way.
 *
 * Returns the post-update lockout state so the caller can decide whether
 * to throw.
 */
export async function recordFailedLogin(opts: {
  userId: string;
  serviceNumber: string;
  ipAddress: string;
  userAgent: string;
}): Promise<{ locked: boolean; attempts: number; until?: Date }> {
  const user = await prisma.user.findUnique({
    where: { id: opts.userId },
    select: { failedLoginAttempts: true },
  });
  const previous = user?.failedLoginAttempts ?? 0;
  const next = previous + 1;
  const shouldLock = next >= MAX_ATTEMPTS;
  const until = shouldLock
    ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
    : null;

  await prisma.user.update({
    where: { id: opts.userId },
    data: {
      failedLoginAttempts: next,
      lockedUntil: until,
    },
  });

  await logAudit({
    userId: opts.userId,
    action: AUDIT_ACTIONS.FAILED_LOGIN,
    entity: 'User',
    entityId: opts.userId,
    ipAddress: opts.ipAddress,
    userAgent: opts.userAgent,
    notes: shouldLock
      ? `Locked for ${LOCKOUT_MINUTES} minutes after ${next} failed attempts (service ${opts.serviceNumber})`
      : `Wrong password (attempt ${next}/${MAX_ATTEMPTS}, service ${opts.serviceNumber})`,
  });

  if (shouldLock) {
    await logAudit({
      userId: opts.userId,
      action: AUDIT_ACTIONS.LOCKOUT,
      entity: 'User',
      entityId: opts.userId,
      ipAddress: opts.ipAddress,
      userAgent: opts.userAgent,
      notes: `Account locked for ${LOCKOUT_MINUTES} minutes`,
    });
  }

  return { locked: shouldLock, attempts: next, until: until ?? undefined };
}

/**
 * Clear the counters on a successful sign-in.
 */
export async function clearFailedLogins(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });
}
