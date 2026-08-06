-- =============================================================================
-- 0009 - Track per-user password change timestamp
-- -----------------------------------------------------------------------------
-- Adds public."User"."lastPasswordChangedAt" (DateTime, nullable).
--
-- Used by the dashboard "set your password" nudge: when the column is null
-- the user is still on the initial / system-set password (the default
-- "ChangeMe123!" for seeded founding members, or the 16-char random
-- generated password for new /members/new admissions). The column is
-- stamped to now() by the markPasswordChangedAction server action, which
-- is called by the /reset-password flow after a successful Supabase
-- updateUser({ password }) and by the in-app password change form.
--
-- NULL for existing rows is intentional -- every existing member is
-- currently on a system-set password, so the dashboard will prompt all
-- 65 founding members to set their own. Once they do, the column gets
-- stamped and the nudge disappears.
--
-- Apply via Supabase SQL Editor:
--   https://supabase.com/dashboard/project/ecazhcauszvmcttmpalu/sql/new
-- =============================================================================

alter table public."User"
  add column if not exists "lastPasswordChangedAt" timestamptz;

-- Helpful index: the dashboard does a one-row lookup per page render
-- (already by primary key), so no extra index is needed for the read
-- path. We do add one on (lastPasswordChangedAt IS NULL) via a partial
-- index for future admin reports like "all members who haven't changed
-- their password yet".
create index if not exists "User_password_not_changed_idx"
  on public."User" ("id")
  where "lastPasswordChangedAt" is null;

-- No backfill: the column being NULL is the correct signal that the
-- user has not yet set their own password.
