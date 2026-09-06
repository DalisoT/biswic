-- 0011_promote_106759_to_admin.sql
-- ----------------------------------------------------------------------------
-- Promotes the platform owner / developer (service number 106759, visible
-- role: CCD) to isAdmin = true on the live Supabase project.
--
-- What this does:
--   Sets "User"."isAdmin" = true for serviceNumber = '106759'. Together with
--   the isAdmin column added in 0010_user_is_admin.sql and the
--   hasAdminAccess() helper in src/lib/permissions.ts, this bypasses every
--   role-based permission check that consults the admin override (the
--   payment gate, /admin/lockouts, member edit, lockout clear) without
--   changing the visible "CCD" role label.
--
-- Why a migration and not just the script:
--   The canonical path on a Node-equipped machine is:
--     npx tsx scripts/grant-admin.ts 106759
--   This migration is the no-toolchain alternative: paste the body into the
--   Supabase SQL Editor and run it. It is idempotent -- re-running on an
--   already-promoted row is a no-op.
--
-- Pre-flight before applying on a fresh Supabase project:
--   - 0010_user_is_admin.sql must already be applied (adds the isAdmin
--     column and the partial index). Without it, this UPDATE fails.
--   - The user with serviceNumber = '106759' must exist in public."User"
--     (created by the seed or by the 0003 trigger when that user signed in
--     via Supabase Auth).
--
-- Auditability note:
--   SQL UPDATEs are not captured by the application-layer AuditLog. This
--   migration file is the documented "ground truth" change. If you ever
--   need an audit trail of the grant, run the same UPDATE from a one-off
--   server action that calls logAudit() -- or use scripts/grant-admin.ts,
--   which prints the before/after state.
--
-- Rollback:
--   UPDATE "User" SET "isAdmin" = false WHERE "serviceNumber" = '106759';
--   (or: npx tsx scripts/grant-admin.ts 106759 --revoke)

UPDATE "User"
   SET "isAdmin" = true
 WHERE "serviceNumber" = '106759'
   AND "isAdmin" = false;
