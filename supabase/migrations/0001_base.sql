-- =============================================================================
-- 0001 - Base extension, enums, and grants
-- =============================================================================
-- Apply BEFORE running prisma migrate. This file:
--   1. Enables pgcrypto (gen_random_uuid())
--   2. Creates all PostgreSQL enum types matching prisma/schema.prisma
--   3. Sets default privileges for the Supabase roles
--
-- Prisma will then create all the tables using these enum types.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. pgcrypto (for gen_random_uuid())
-- -----------------------------------------------------------------------------
create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- 2. Enum types
-- -----------------------------------------------------------------------------
-- These MUST be created before Prisma runs because schema.prisma declares
-- columns with these types. The order here is alphabetical for stability.
-- -----------------------------------------------------------------------------

do $$ begin
  if not exists (select 1 from pg_type where typname = 'Role') then
    create type "Role" as enum (
      'MEMBER',
      'CHAIRPERSON',
      'VICE_CHAIRPERSON',
      'CCD',
      'FW',
      'SECRETARY',
      'TREASURER',
      'DEPUTY_TREASURER',
      'TRUSTEE',
      'LSC_MEMBER',
      'BUSINESS_MEMBER',
      'FINANCE_MEMBER',
      'WELFARE_OFFICER',
      'INTERNAL_AUDITOR',
      'IT_COMMS_LEAD'
    );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'ContributionType') then
    create type "ContributionType" as enum (
      'PAYROLL_DEDUCTION',
      'CASH',
      'MOBILE_MONEY',
      'BANK_TRANSFER'
    );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'ClaimType') then
    create type "ClaimType" as enum ('FUNERAL', 'MEDICAL');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'ClaimStatus') then
    create type "ClaimStatus" as enum ('PENDING', 'APPROVED', 'REJECTED', 'PAID');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'MeetingType') then
    create type "MeetingType" as enum ('MONTHLY', 'QUARTERLY', 'AGM', 'SPECIAL', 'EMERGENCY');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'MeetingStatus') then
    create type "MeetingStatus" as enum ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'ActionItemStatus') then
    create type "ActionItemStatus" as enum ('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'DocumentCategory') then
    create type "DocumentCategory" as enum (
      'CONSTITUTION',
      'MEETING_MINUTES',
      'AUDIT_REPORT',
      'LAND_DEED',
      'BUSINESS_CONTRACT',
      'ANNUAL_REPORT',
      'POLICY',
      'OTHER'
    );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'AccessLevel') then
    create type "AccessLevel" as enum ('PUBLIC', 'MEMBER', 'OFFICER', 'EXECUTIVE', 'RESTRICTED');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'LandStatus') then
    create type "LandStatus" as enum (
      'SCOUTED',
      'SHORTLIST',
      'DUE_DILIGENCE',
      'RECOMMENDED',
      'APPROVED',
      'PURCHASED',
      'SUBDIVIDED',
      'REJECTED'
    );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'PlotStatus') then
    create type "PlotStatus" as enum ('UNALLOCATED', 'ALLOCATED', 'TRANSFERRED', 'REPOSSESSED');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'BusinessStatus') then
    create type "BusinessStatus" as enum ('PLANNING', 'ACTIVE', 'PAUSED', 'CLOSED');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'BusinessTransactionType') then
    create type "BusinessTransactionType" as enum (
      'INCOME',
      'EXPENSE',
      'CAPITAL_INJECTION',
      'PROFIT_DISTRIBUTION'
    );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'EventType') then
    create type "EventType" as enum (
      'MEETING',
      'AGM',
      'FAMILY_DAY',
      'SPORTS_DAY',
      'COMMUNITY_EVENT',
      'CHARITY_DRIVE',
      'OTHER'
    );
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'RsvpStatus') then
    create type "RsvpStatus" as enum ('PENDING', 'YES', 'NO', 'MAYBE');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'CharityStatus') then
    create type "CharityStatus" as enum ('PLANNING', 'ACTIVE', 'COMPLETED', 'CANCELLED');
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 3. Grants (so Supabase roles can use these types)
-- -----------------------------------------------------------------------------
-- The Supabase roles (anon, authenticated, service_role) need USAGE on every
-- enum type in the public schema. Without this, queries through PostgREST
-- will fail with "type does not exist" or permission errors.
-- -----------------------------------------------------------------------------

do $$
declare
  r record;
begin
  for r in
    select n.nspname, t.typname
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typtype = 'e'  -- enum types
  loop
    execute format('grant usage on type public.%I to anon, authenticated, service_role', r.typname);
  end loop;
end $$;
