-- 0012_drop_auditlog_usercascade.sql
-- ----------------------------------------------------------------------------
-- Fixes two cascade-related issues that block user deletion:
--
-- 1. AuditLog.userId FK: Prisma generates ON DELETE CASCADE. When a User is
--    deleted, PostgreSQL first sets AuditLog.userId = NULL (UPDATE) before the
--    CASCADE DELETE. The append-only prevent_audit_log_mutation trigger fires on
--    that UPDATE and blocks it. Fix: change to SET NULL DEFERRABLE.
--
-- 2. Notification.userId FK: Prisma generates ON DELETE CASCADE. When a User is
--    deleted, Notification rows cascade-delete. This works fine but for consistency
--    and predictability, explicit DELETE of notifications before user deletion is
--    preferred so the application layer controls the order.
-- =============================================================================

BEGIN;

-- Fix AuditLog: SET NULL instead of CASCADE, deferred so it fires at commit
ALTER TABLE "AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_userId_fkey";
ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"(id)
  ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;

-- Fix Notification: use CASCADE but defer so explicit DELETE runs first
ALTER TABLE "Notification" DROP CONSTRAINT IF EXISTS "Notification_userId_fkey";
ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"(id)
  ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED;

COMMIT;
