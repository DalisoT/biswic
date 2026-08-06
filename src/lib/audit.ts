/**
 * Audit Log Service (S6)
 * ----------------------------------------------------------------------------
 * Every state-changing action MUST go through this service.
 * The audit log is append-only at the application layer.
 * (Production should also add a Postgres trigger to enforce at DB layer.)
 */

import { prisma } from './db';

export interface AuditLogInput {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  beforeValue?: unknown;
  afterValue?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
  notes?: string | null;
}

export async function logAudit(input: AuditLogInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        // Prisma's Json? field accepts InputJsonValue directly - it serializes for us.
        beforeValue: (input.beforeValue as any) ?? null,
        afterValue: (input.afterValue as any) ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        notes: input.notes ?? null,
      },
    });
  } catch (err) {
    // Audit log failures must NOT crash the application, but should be visible.
    console.error('AUDIT LOG FAILURE:', err, input);
  }
}

/**
 * Common action constants
 */
export const AUDIT_ACTIONS = {
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  FAILED_LOGIN: 'FAILED_LOGIN',
  LOCKOUT: 'LOCKOUT',
  LOCKOUT_CLEARED: 'LOCKOUT_CLEARED',
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  CONTRIBUTION_RECORDED: 'CONTRIBUTION_RECORDED',
  CLAIM_SUBMITTED: 'CLAIM_SUBMITTED',
  CLAIM_APPROVED: 'CLAIM_APPROVED',
  CLAIM_REJECTED: 'CLAIM_REJECTED',
  CLAIM_PAID: 'CLAIM_PAID',
  MEETING_SCHEDULED: 'MEETING_SCHEDULED',
  MEETING_MINUTES_POSTED: 'MEETING_MINUTES_POSTED',
  DOCUMENT_UPLOADED: 'DOCUMENT_UPLOADED',
  MEMBER_ADDED: 'MEMBER_ADDED',
  MEMBER_EDITED: 'MEMBER_EDITED',
  MEMBER_REMOVED: 'MEMBER_REMOVED',
  BUCKET_TRANSFER: 'BUCKET_TRANSFER',
  CAP_OVERRIDE: 'CAP_OVERRIDE',
} as const;
