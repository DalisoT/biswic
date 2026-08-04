-- =============================================================================
-- 0005 - Welfare Claims Officer third signature (Constitution Art. 5.3)
-- =============================================================================
-- Apply AFTER 0004, BEFORE re-deploying the app.
--
-- Constitution Art. 5.3:
--   "All welfare payouts require:
--    (a) Approval by the Welfare Claims Officer (where one has been
--        appointed, Article 6.6) and countersigned by the Finance Warrant.
--    (b) Final sign-off by the Chairperson before disbursement."
--
-- Until now, WelfareClaim had only approvedByFwId/At and approvedByChairId/At.
-- This migration adds the third signature field. Both columns are nullable
-- and have no default, so existing claims are unaffected -- they remain
-- validly APPROVED with the 2-sig rule that was in effect when approved.
--
-- Behavior matrix at the application layer (see claim-rules.ts):
--   - 0 users with role = 'WELFARE_OFFICER' AND isActive = true:
--       => 2-sig rule (FW + Chair), as before
--   - 1+ users with role = 'WELFARE_OFFICER' AND isActive = true:
--       => 3-sig rule (Welfare Officer + FW + Chair)
-- =============================================================================

alter table public."WelfareClaim"
  add column if not exists "approvedByWelfareOfficerId" uuid null,
  add column if not exists "approvedByWelfareOfficerAt" timestamptz null;

-- Foreign key to public."User" (matches the pattern of approvedByFwId / approvedByChairId)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'WelfareClaim_approvedByWelfareOfficerId_fkey'
  ) then
    alter table public."WelfareClaim"
      add constraint "WelfareClaim_approvedByWelfareOfficerId_fkey"
      foreign key ("approvedByWelfareOfficerId")
      references public."User"(id)
      on delete set null;
  end if;
end $$;

-- Index for the relation (matches the implicit pattern of the other two FKs)
create index if not exists "WelfareClaim_approvedByWelfareOfficerId_idx"
  on public."WelfareClaim" ("approvedByWelfareOfficerId");
