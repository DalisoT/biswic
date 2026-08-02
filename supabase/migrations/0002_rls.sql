-- =============================================================================
-- 0002 - Row Level Security policies
-- =============================================================================
-- Pattern:
--   * Enable RLS on every public-schema table.
--   * Service role (used by Prisma from the Next.js server) bypasses RLS.
--   * Authenticated users (Supabase Auth) can read their own profile and
--     non-restricted public data.
--   * Writes go through Prisma (server-side) using the service role, so we
--     intentionally keep write policies restrictive OR none for the public.
--   * Officer-level reads (committee dashboard) are governed by the user's
--     'role' column on public.User, which we read inside the policy via a
--     helper function.
-- =============================================================================

-- Helper: current user's role from public.User, joined on auth.uid().
-- Returns NULL if the user has no public.User row yet (e.g. just signed up).
create or replace function public.current_member_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role::text from public."User" where id = auth.uid();
$$;

-- Helper: is the current user an officer (anything other than MEMBER)?
create or replace function public.is_officer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_member_role() <> 'MEMBER', false);
$$;

-- Helper: is the current user FW?
create or replace function public.is_fw()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_member_role() = 'FW';
$$;

-- Helper: is the current user CHAIRPERSON?
create or replace function public.is_chair()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_member_role() = 'CHAIRPERSON';
$$;

-- -----------------------------------------------------------------------------
-- USER
-- -----------------------------------------------------------------------------
alter table public."User" enable row level security;

-- Members can read their own row.
create policy "user_select_own" on public."User"
  for select to authenticated
  using (id = auth.uid());

-- Officers can read all users.
create policy "user_select_officers" on public."User"
  for select to authenticated
  using (public.is_officer());

-- Members can update their own profile (but not role/isActive).
-- (Application layer enforces which fields are writable.)
create policy "user_update_own" on public."User"
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Inserts/deletes are denied by default (only the service role bypasses RLS).

-- -----------------------------------------------------------------------------
-- BUCKETS
-- -----------------------------------------------------------------------------
alter table public."Bucket" enable row level security;

-- Anyone authenticated can read bucket definitions (they're not sensitive).
create policy "bucket_select_all" on public."Bucket"
  for select to authenticated
  using (true);

-- BucketTransaction ledger
alter table public."BucketTransaction" enable row level security;
create policy "bucket_tx_select_all" on public."BucketTransaction"
  for select to authenticated
  using (true);

-- -----------------------------------------------------------------------------
-- CONTRIBUTIONS
-- -----------------------------------------------------------------------------
alter table public."Contribution" enable row level security;
create policy "contribution_select_own" on public."Contribution"
  for select to authenticated
  using ("memberId" = auth.uid());
create policy "contribution_select_officers" on public."Contribution"
  for select to authenticated
  using (public.is_officer());

alter table public."BucketAllocation" enable row level security;
create policy "allocation_select_own" on public."BucketAllocation"
  for select to authenticated
  using (
    exists (
      select 1 from public."Contribution" c
      where c.id = "BucketAllocation"."contributionId"
        and c."memberId" = auth.uid()
    )
  );
create policy "allocation_select_officers" on public."BucketAllocation"
  for select to authenticated
  using (public.is_officer());

-- -----------------------------------------------------------------------------
-- WELFARE CLAIMS
-- -----------------------------------------------------------------------------
alter table public."WelfareClaim" enable row level security;
create policy "claim_select_own" on public."WelfareClaim"
  for select to authenticated
  using ("memberId" = auth.uid());
create policy "claim_select_officers" on public."WelfareClaim"
  for select to authenticated
  using (public.is_officer());

-- -----------------------------------------------------------------------------
-- MEETINGS
-- -----------------------------------------------------------------------------
alter table public."Meeting" enable row level security;
create policy "meeting_select_all_members" on public."Meeting"
  for select to authenticated
  using (true);

alter table public."MeetingAttendance" enable row level security;
create policy "attendance_select_own" on public."MeetingAttendance"
  for select to authenticated
  using ("memberId" = auth.uid());
create policy "attendance_select_officers" on public."MeetingAttendance"
  for select to authenticated
  using (public.is_officer());

alter table public."ActionItem" enable row level security;
create policy "action_item_select_all" on public."ActionItem"
  for select to authenticated
  using (true);

-- -----------------------------------------------------------------------------
-- DOCUMENTS
-- -----------------------------------------------------------------------------
alter table public."Document" enable row level security;
create policy "document_select_public" on public."Document"
  for select to authenticated
  using ("accessLevel" = 'PUBLIC');
create policy "document_select_member" on public."Document"
  for select to authenticated
  using ("accessLevel" = 'MEMBER');
create policy "document_select_officer" on public."Document"
  for select to authenticated
  using ("accessLevel" in ('OFFICER', 'EXECUTIVE') and public.is_officer());
create policy "document_select_restricted" on public."Document"
  for select to authenticated
  using ("accessLevel" = 'RESTRICTED' and public.is_chair());

alter table public."DocumentVersion" enable row level security;
create policy "document_version_select_same_as_doc" on public."DocumentVersion"
  for select to authenticated
  using (
    exists (
      select 1 from public."Document" d
      where d.id = "DocumentVersion"."documentId"
        and (
          d."accessLevel" = 'PUBLIC'
          or d."accessLevel" = 'MEMBER'
          or (d."accessLevel" in ('OFFICER', 'EXECUTIVE') and public.is_officer())
          or (d."accessLevel" = 'RESTRICTED' and public.is_chair())
        )
    )
  );

-- -----------------------------------------------------------------------------
-- LAND
-- -----------------------------------------------------------------------------
alter table public."LandOpportunity" enable row level security;
create policy "land_select_all" on public."LandOpportunity"
  for select to authenticated
  using (true);

alter table public."LandPurchase" enable row level security;
create policy "land_purchase_select_all" on public."LandPurchase"
  for select to authenticated
  using (true);

alter table public."Plot" enable row level security;
create policy "plot_select_own" on public."Plot"
  for select to authenticated
  using ("memberId" = auth.uid());
create policy "plot_select_officers" on public."Plot"
  for select to authenticated
  using (public.is_officer());

-- -----------------------------------------------------------------------------
-- BUSINESS
-- -----------------------------------------------------------------------------
alter table public."Business" enable row level security;
create policy "business_select_all" on public."Business"
  for select to authenticated
  using (true);

alter table public."BusinessTransaction" enable row level security;
create policy "business_tx_select_officers" on public."BusinessTransaction"
  for select to authenticated
  using (public.is_officer());

create policy "business_decision_select_officers" on public."BusinessDecision"
  for select to authenticated
  using (public.is_officer());
alter table public."BusinessDecision" enable row level security;

-- -----------------------------------------------------------------------------
-- EVENTS & CHARITY
-- -----------------------------------------------------------------------------
alter table public."Event" enable row level security;
create policy "event_select_all" on public."Event"
  for select to authenticated
  using (true);

alter table public."EventRSVP" enable row level security;
create policy "rsvp_select_own" on public."EventRSVP"
  for select to authenticated
  using ("memberId" = auth.uid());
create policy "rsvp_select_officers" on public."EventRSVP"
  for select to authenticated
  using (public.is_officer());

alter table public."CharityProject" enable row level security;
create policy "charity_select_all" on public."CharityProject"
  for select to authenticated
  using (true);

-- -----------------------------------------------------------------------------
-- AUDIT LOG
-- -----------------------------------------------------------------------------
alter table public."AuditLog" enable row level security;
-- Only chair + internal auditor can read audit logs (also enforced by app).
create policy "audit_select_chair" on public."AuditLog"
  for select to authenticated
  using (public.is_chair() or public.current_member_role() = 'INTERNAL_AUDITOR');

-- -----------------------------------------------------------------------------
-- NOTIFICATIONS
-- -----------------------------------------------------------------------------
alter table public."Notification" enable row level security;
create policy "notification_select_own" on public."Notification"
  for select to authenticated
  using ("userId" = auth.uid());
create policy "notification_update_own" on public."Notification"
  for update to authenticated
  using ("userId" = auth.uid())
  with check ("userId" = auth.uid());
