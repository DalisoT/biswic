-- 0010_user_is_admin.sql
-- ----------------------------------------------------------------------------
-- Adds a global isAdmin boolean to public.User.
--
-- Bypasses every role-based permission check (canManageMembers,
-- canRecordContributions, /admin/lockouts, etc.) without changing the
-- visible role label. The platform owner / developer gets full reach
-- while still showing up in the UI as their elected role (e.g. CCD,
-- SECRETARY, etc.).
--
-- Default false. Set to true for the platform owner (service 106759) via
-- scripts/grant-admin.ts or directly:
--   UPDATE "User" SET "isAdmin" = true WHERE "serviceNumber" = '106759';

ALTER TABLE "User"
  ADD COLUMN "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Partial index -- a tiny table, but admins will be queried a lot, so a
-- covering index on the rare true values speeds up the lookup.
CREATE INDEX "User_isAdmin_idx" ON "User" ("isAdmin") WHERE "isAdmin" = true;
