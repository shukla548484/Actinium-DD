-- AlterTable: budget line currency + USD mirrors (shipyard FX pattern)
ALTER TABLE "dd_budget_lines" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE "dd_budget_lines" ADD COLUMN IF NOT EXISTS "exchange_rate_local_per_usd" DOUBLE PRECISION;
ALTER TABLE "dd_budget_lines" ADD COLUMN IF NOT EXISTS "budget_amount_usd" DOUBLE PRECISION;
ALTER TABLE "dd_budget_lines" ADD COLUMN IF NOT EXISTS "quoted_amount_usd" DOUBLE PRECISION;
ALTER TABLE "dd_budget_lines" ADD COLUMN IF NOT EXISTS "approved_amount_usd" DOUBLE PRECISION;
ALTER TABLE "dd_budget_lines" ADD COLUMN IF NOT EXISTS "actual_amount_usd" DOUBLE PRECISION;

-- Backfill: existing rows are USD — mirror amounts into USD columns and set rate = 1
UPDATE "dd_budget_lines"
SET
  "currency" = COALESCE(NULLIF(TRIM("currency"), ''), 'USD'),
  "exchange_rate_local_per_usd" = COALESCE("exchange_rate_local_per_usd", 1),
  "budget_amount_usd" = COALESCE("budget_amount_usd", "budget_amount"),
  "quoted_amount_usd" = COALESCE("quoted_amount_usd", "quoted_amount"),
  "approved_amount_usd" = COALESCE("approved_amount_usd", "approved_amount"),
  "actual_amount_usd" = COALESCE("actual_amount_usd", "actual_amount")
WHERE "deleted_at" IS NULL OR "deleted_at" IS NOT NULL;
