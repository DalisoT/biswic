-- =============================================================================
-- 0004 - Bucket Mix Fix (Constitution Article 4.1 compliance)
-- =============================================================================
-- Apply this AFTER 0003, BEFORE re-seeding the dev DB.
--
-- The Constitution (Art. 4.1) defines the canonical 6-bucket mix as:
--   50% Land & Capital Reserve | 20% Business Seed Fund | 15% Funeral Support
--    8% Soft Loans             |  4% Admin & Audit        |  3% Medical Emergency
--
-- The pre-migration schema had MEDICAL at 8% and EDUCATION at 3% (no Soft
-- Loans bucket). This migration surgically updates the bucket rows to match
-- the Constitution without rewriting the append-only ledger.
--
-- Historical ledger entries are NOT modified -- they remain a true record of
-- what was allocated under the old mix. Going forward, the percentage change
-- will be reflected in the bucket's `percentage` field and all new
-- allocations in contribution-service.ts.
--
-- The MEDICAL bucket's balance will continue to reflect historical 8%
-- allocations until the launch-date wipe (see launch-checklist.md).
-- =============================================================================

-- 1) Rename EDUCATION -> SOFT_LOANS, and bump its percentage from 3% to 8%
update public."Bucket"
   set code = 'SOFT_LOANS',
       name = 'Soft Loans',
       percentage = 0.0800
 where code = 'EDUCATION';

-- 2) Cut MEDICAL's percentage from 8% to 3% (Constitution Art. 4.1)
update public."Bucket"
   set percentage = 0.0300
 where code = 'MEDICAL';

-- 3) Sanity check: all 6 Constitution buckets present with correct percentages
--    (run this manually; commented out so the migration always succeeds)
--
-- select code, percentage from public."Bucket" order by percentage desc;
--   Expected:
--     LAND        0.5000
--     BUSINESS    0.2000
--     FUNERAL     0.1500
--     SOFT_LOANS  0.0800
--     ADMIN       0.0400
--     MEDICAL     0.0300
--     ----------
--     sum         1.0000  (must be exactly 1, no rounding loss)

-- 4) The append-only ledger ("BucketTransaction", "BucketAllocation") is
--    intentionally NOT touched. The historical record stands. Re-run the
--    seed after this migration to wipe and regenerate the dev ledger.
