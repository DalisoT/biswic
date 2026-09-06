-- 0012_drop_auditlog_usercascade.sql
-- ----------------------------------------------------------------------------
-- Drops the ON DELETE CASCADE foreign key on AuditLog.userId.
--
-- Problem: Prisma generates an ON DELETE CASCADE constraint on the AuditLog.userId
-- FK. When a User is deleted (e.g. via the redacted-delete flow), Prisma issues
-- a CASCADE DELETE against AuditLog rows. The append-only prevent_audit_log_mutation
-- trigger fires on every UPDATE to AuditLog -- and PostgreSQL issues an implicit
-- UPDATE to set userId = NULL before the CASCADE DELETE, which the trigger blocks.
--
-- Fix: AuditLog rows should never be deleted (append-only), so the FK can be
-- changed to NO ACTION / RESTRICT instead of CASCADE. The AuditLog.userId field
-- becomes informational only. Application-layer deletes handle the member cleanup.
-- =============================================================================

BEGIN;

-- Recreate the FK without CASCADE (PostgreSQL requires dropping and re-adding)
ALTER TABLE "AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_userId_fkey";
ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"(id)
  ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;

COMMIT;
