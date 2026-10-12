-- Migration: 2026-10-12 — Drop FUNERAL and MEDICAL buckets, rebalance to LAND/SOFT_LOANS/ADMIN
-- ----------------------------------------------------------------------------
-- Per General Meeting vote (2026-10), the Cooperative dropped FUNERAL (15%)
-- and MEDICAL (3%) buckets. The freed 18% is rebalanced as:
--   +10% to LAND         (0.50 -> 0.60)
--    +7% to SOFT_LOANS   (0.08 -> 0.15)
--    +1% to ADMIN        (0.04 -> 0.05)
-- BUSINESS (20%) is unchanged. Total: 60 + 20 + 15 + 5 = 100%.
--
-- Implementation:
--   1. Add `isActive`, `closedAt`, `closedReason` columns to Bucket.
--   2. Update the four active buckets' percentages.
--   3. Sweep the live FUNERAL and MEDICAL balances into LAND/SOFT_LOANS/ADMIN
--      in the same 10:7:1 ratio (i.e. 10/18, 7/18, 1/18 of the swept total).
--      Each step is a BucketTransaction row so the audit ledger matches.
--   4. Mark FUNERAL and MEDICAL isActive=false with closedAt/closedReason set.
--
-- Idempotent: re-running the migration after a successful first run is a
-- no-op (the active bucket updates and the sweep both check the current
-- state before they write). Safe to re-run.
-- ----------------------------------------------------------------------------

BEGIN;

-- 1) Schema: add logical-delete columns to Bucket
ALTER TABLE "Bucket"
  ADD COLUMN IF NOT EXISTS "isActive"     BOOLEAN     NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "closedAt"     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "closedReason" TEXT;
CREATE INDEX IF NOT EXISTS "Bucket_isActive_idx" ON "Bucket"("isActive");

-- 2) Update the four active buckets' percentages.
--    Pct stored as Decimal(5,4) so 0.6000 / 0.1500 / 0.0500.
UPDATE "Bucket" SET "percentage" = 0.6000 WHERE "code" = 'LAND'        AND "name" = 'Land & Capital Reserve';
UPDATE "Bucket" SET "percentage" = 0.2000 WHERE "code" = 'BUSINESS'    AND "name" = 'Business Seed Fund';
UPDATE "Bucket" SET "percentage" = 0.1500 WHERE "code" = 'SOFT_LOANS'  AND "name" = 'Soft Loans';
UPDATE "Bucket" SET "percentage" = 0.0500 WHERE "code" = 'ADMIN'       AND "name" = 'Admin & Audit';
UPDATE "Bucket" SET "percentage" = 0.0000 WHERE "code" IN ('FUNERAL', 'MEDICAL');

-- 3) Sweep balances: only if the FUNERAL and MEDICAL buckets are still open
--    AND still have a non-zero balance. The sweep total is split 10:7:1.
DO $$
DECLARE
  v_fund_id      UUID;
  v_med_id       UUID;
  v_land_id      UUID;
  v_sl_id        UUID;
  v_adm_id       UUID;
  v_fund_bal     NUMERIC(14,2);
  v_med_bal      NUMERIC(14,2);
  v_total        NUMERIC(14,2);
  v_to_land      NUMERIC(14,2);
  v_to_sl        NUMERIC(14,2);
  v_to_adm       NUMERIC(14,2);
  v_note         TEXT;
  v_sweep_marker TEXT := 'BUCKET_REBALANCE_2026_10';
  v_already_done BOOLEAN;
BEGIN
  -- Bail out if the sweep was already recorded on a prior run.
  SELECT EXISTS (
    SELECT 1 FROM "BucketTransaction"
    WHERE "type" = v_sweep_marker
    LIMIT 1
  ) INTO v_already_done;
  IF v_already_done THEN
    RAISE NOTICE 'Sweep marker % already present — skipping sweep', v_sweep_marker;
  ELSE
    -- Look up the bucket ids.
    SELECT "id", "balance" INTO v_fund_id, v_fund_bal FROM "Bucket" WHERE "code" = 'FUNERAL';
    SELECT "id", "balance" INTO v_med_id,  v_med_bal  FROM "Bucket" WHERE "code" = 'MEDICAL';
    SELECT "id" INTO v_land_id FROM "Bucket" WHERE "code" = 'LAND';
    SELECT "id" INTO v_sl_id   FROM "Bucket" WHERE "code" = 'SOFT_LOANS';
    SELECT "id" INTO v_adm_id  FROM "Bucket" WHERE "code" = 'ADMIN';

    v_fund_bal := COALESCE(v_fund_bal, 0);
    v_med_bal  := COALESCE(v_med_bal,  0);
    v_total    := v_fund_bal + v_med_bal;

    IF v_total > 0 THEN
      v_to_land := ROUND(v_total * 10.0 / 18.0, 2);
      v_to_sl   := ROUND(v_total *  7.0 / 18.0, 2);
      v_to_adm  := v_total - v_to_land - v_to_sl;  -- rounding-residual lands in ADMIN

      v_note := format(
        'Rebalance per GM 2026-10: FUNERAL K%s + MEDICAL K%s = K%s swept to LAND/SOFT_LOANS/ADMIN at 10:7:1',
        v_fund_bal, v_med_bal, v_total
      );

      -- Debit FUNERAL
      IF v_fund_id IS NOT NULL AND v_fund_bal > 0 THEN
        INSERT INTO "BucketTransaction"
          ("bucketId", "amount", "type", "referenceType", "note", "createdAt")
        VALUES
          (v_fund_id, -v_fund_bal, v_sweep_marker, 'BucketRebalance', v_note, now());
        UPDATE "Bucket" SET "balance" = 0 WHERE "id" = v_fund_id;
      END IF;

      -- Debit MEDICAL
      IF v_med_id IS NOT NULL AND v_med_bal > 0 THEN
        INSERT INTO "BucketTransaction"
          ("bucketId", "amount", "type", "referenceType", "note", "createdAt")
        VALUES
          (v_med_id, -v_med_bal, v_sweep_marker, 'BucketRebalance', v_note, now());
        UPDATE "Bucket" SET "balance" = 0 WHERE "id" = v_med_id;
      END IF;

      -- Credit LAND
      IF v_to_land > 0 AND v_land_id IS NOT NULL THEN
        INSERT INTO "BucketTransaction"
          ("bucketId", "amount", "type", "referenceType", "note", "createdAt")
        VALUES
          (v_land_id, v_to_land, v_sweep_marker, 'BucketRebalance', v_note, now());
        UPDATE "Bucket" SET "balance" = "balance" + v_to_land WHERE "id" = v_land_id;
      END IF;

      -- Credit SOFT_LOANS
      IF v_to_sl > 0 AND v_sl_id IS NOT NULL THEN
        INSERT INTO "BucketTransaction"
          ("bucketId", "amount", "type", "referenceType", "note", "createdAt")
        VALUES
          (v_sl_id, v_to_sl, v_sweep_marker, 'BucketRebalance', v_note, now());
        UPDATE "Bucket" SET "balance" = "balance" + v_to_sl WHERE "id" = v_sl_id;
      END IF;

      -- Credit ADMIN (incl. rounding residual)
      IF v_to_adm > 0 AND v_adm_id IS NOT NULL THEN
        INSERT INTO "BucketTransaction"
          ("bucketId", "amount", "type", "referenceType", "note", "createdAt")
        VALUES
          (v_adm_id, v_to_adm, v_sweep_marker, 'BucketRebalance', v_note, now());
        UPDATE "Bucket" SET "balance" = "balance" + v_to_adm WHERE "id" = v_adm_id;
      END IF;

      RAISE NOTICE 'Swept FUNERAL K% + MEDICAL K% = K% (LAND K%, SOFT_LOANS K%, ADMIN K%)',
        v_fund_bal, v_med_bal, v_total, v_to_land, v_to_sl, v_to_adm;
    ELSE
      RAISE NOTICE 'FUNERAL + MEDICAL balances are zero — no sweep needed';
    END IF;
  END IF;

  -- 4) Mark FUNERAL and MEDICAL as logically deleted.
  --    Idempotent: if already inactive, the WHERE clause skips them.
  UPDATE "Bucket"
     SET "isActive"     = false,
         "closedAt"     = COALESCE("closedAt", now()),
         "closedReason" = COALESCE("closedReason", 'Closed 2026-10 per GM vote; balances swept to LAND/SOFT_LOANS/ADMIN at 10:7:1')
   WHERE "code" IN ('FUNERAL', 'MEDICAL')
     AND "isActive" = true;

  RAISE NOTICE 'Migration 20261012150000_drop_funeral_medical_rebalance complete';
END $$;

COMMIT;
