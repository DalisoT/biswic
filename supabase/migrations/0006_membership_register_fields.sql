-- =============================================================================
-- 0006 - Membership Register fields (Constitution Art. 2.6)
-- =============================================================================
-- Apply AFTER 0005, BEFORE re-deploying the app.
--
-- Constitution Art. 2.6:
--   "The Secretary shall maintain a register containing each member's full
--    name, service number, rank, unit, national registration number,
--    next-of-kin, contact details, date of joining, and signature."
--
-- The User model previously had: serviceNumber, fullName, rank, unit, phone,
-- email, nextOfKin (Json), joinedAt. Missing: NRC + signature capture +
-- the founding-member flag (Art. 2.2 -- 74 specific people).
--
-- This migration adds the missing columns. The signature image itself lives
-- in the new 'membership-register' Supabase Storage bucket (private, signed
-- URLs only). The 'membershipRegisterSignatureUrl' field stores the path.
--
-- All columns are nullable so existing rows are unaffected. The Secretary
-- (role=SECRETARY) populates them via the in-app "Edit Member" UI.
-- =============================================================================

alter table public."User"
  add column if not exists "isFoundingMember" boolean not null default false,
  add column if not exists "foundingSignedAt" timestamptz null,
  add column if not exists "nationalRegistrationNumber" text null,
  add column if not exists "membershipRegisterSignedAt" timestamptz null,
  add column if not exists "membershipRegisterSignatureUrl" text null;

-- Unique constraint on NRC (one NRC per member, no duplicates)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'User_nationalRegistrationNumber_key'
  ) then
    alter table public."User"
      add constraint "User_nationalRegistrationNumber_key"
      unique ("nationalRegistrationNumber");
  end if;
end $$;

-- Index on isFoundingMember for fast "list the 74 founders" queries
create index if not exists "User_isFoundingMember_idx"
  on public."User" ("isFoundingMember");

-- Storage bucket for the membership register signatures.
-- Private, signed URLs only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'membership-register',
  'membership-register',
  false,
  5242880,  -- 5 MB per signature
  array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;
