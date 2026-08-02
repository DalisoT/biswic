-- =============================================================================
-- 0003 - Post-Prisma: auth sync trigger + audit log immutability
-- =============================================================================
-- Apply AFTER running prisma migrate (which creates the public schema tables).
--
-- This file:
--   1. Creates a trigger that mirrors auth.users INSERTs into public."User"
--      so that auth.uid() <-> public."User".id always holds. The trigger reads
--      service_number from auth.users.raw_user_meta_data.
--   2. Creates a trigger that blocks UPDATE/DELETE on public."AuditLog",
--      making it append-only at the database layer (the application layer
--      already enforces this; the trigger is a belt-and-braces guarantee
--      that satisfies the SBR "audit log everything" rule).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. auth.users -> public."User" mirror trigger
-- -----------------------------------------------------------------------------
-- When an auth user is created (via the admin createUser API, e.g. from the
-- seed script or from the in-app "add member" flow), we mirror them into
-- public."User" so that:
--   - auth.uid() returns the same value as public."User".id
--   - All RLS policies that key on auth.uid() work
--   - The service_number / role / fullName fields used by the app are kept
--     in sync.
--
-- Required: the caller of supabase.auth.admin.createUser() MUST set
--   raw_user_meta_data = { service_number: 'CHAIR-001', full_name: 'Col. ...' }
-- for the trigger to populate the public row correctly. The seed and the
-- in-app "add member" form both do this.
-- -----------------------------------------------------------------------------

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service_number text := new.raw_user_meta_data->>'service_number';
  v_full_name      text := coalesce(new.raw_user_meta_data->>'full_name', '');
  v_role           text := coalesce(new.raw_user_meta_data->>'role', 'MEMBER');
  v_phone          text := new.raw_user_meta_data->>'phone';
begin
  -- Defensive: if service_number is missing, raise. The app layer should
  -- never create auth users without it.
  if v_service_number is null or v_service_number = '' then
    raise exception 'auth user % has no service_number in raw_user_meta_data', new.id;
  end if;
  if v_phone is null or v_phone = '' then
    raise exception 'auth user % has no phone in raw_user_meta_data', new.id;
  end if;

  insert into public."User" (id, "serviceNumber", "fullName", email, role, phone, "isActive", "joinedAt", "createdAt", "updatedAt")
  values (
    new.id,
    upper(trim(v_service_number)),
    v_full_name,
    new.email,
    v_role::"Role",
    v_phone,
    true,
    now(),
    now(),
    now()
  )
  on conflict (id) do update set
    "serviceNumber" = excluded."serviceNumber",
    "fullName"      = excluded."fullName",
    email           = excluded.email,
    role            = excluded.role,
    phone           = excluded.phone,
    "updatedAt"     = now();

  return new;
end;
$$;

-- Drop if it already exists (idempotent)
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- -----------------------------------------------------------------------------
-- 2. Audit log immutability trigger
-- -----------------------------------------------------------------------------
-- Block UPDATE and DELETE on public."AuditLog". Append-only at the DB layer.
-- Satisfies sacred rule S6 "audit log everything" and the spec's
-- "append-only" requirement.
-- -----------------------------------------------------------------------------

create or replace function public.prevent_audit_log_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'AuditLog is append-only (operation: %)', tg_op
    using errcode = 'P0001';
end;
$$;

drop trigger if exists audit_log_no_update on public."AuditLog";
create trigger audit_log_no_update
  before update on public."AuditLog"
  for each row execute function public.prevent_audit_log_mutation();

drop trigger if exists audit_log_no_delete on public."AuditLog";
create trigger audit_log_no_delete
  before delete on public."AuditLog"
  for each row execute function public.prevent_audit_log_mutation();

-- TRUNCATE bypasses BEFORE DELETE triggers in Postgres, so block it explicitly.
-- The trigger function name is a marker; it intentionally raises the same error.
drop trigger if exists audit_log_no_truncate on public."AuditLog";
create trigger audit_log_no_truncate
  before truncate on public."AuditLog"
  for each statement execute function public.prevent_audit_log_mutation();
