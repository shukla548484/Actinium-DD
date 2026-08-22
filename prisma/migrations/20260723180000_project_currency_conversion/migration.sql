-- AlterTable
ALTER TABLE "shipyard_quotation_requests" ADD COLUMN IF NOT EXISTS "local_currency" TEXT;
ALTER TABLE "shipyard_quotation_requests" ADD COLUMN IF NOT EXISTS "quote_currency" TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE "shipyard_quotation_requests" ADD COLUMN IF NOT EXISTS "exchange_rate_local_per_usd" DOUBLE PRECISION;
ALTER TABLE "shipyard_quotation_requests" ADD COLUMN IF NOT EXISTS "exchange_rate_source" TEXT;

-- AlterTable
ALTER TABLE "shipyard_quotation_lines" ADD COLUMN IF NOT EXISTS "unit_rate_usd" DOUBLE PRECISION;
ALTER TABLE "shipyard_quotation_lines" ADD COLUMN IF NOT EXISTS "amount_usd" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE IF NOT EXISTS "project_currency_conversions" (
    "id" TEXT NOT NULL,
    "dry_dock_project_id" TEXT,
    "project_id" TEXT,
    "local_currency" TEXT NOT NULL,
    "local_per_usd" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "market_avg_local_per_usd" DOUBLE PRECISION,
    "market_fetched_at" TIMESTAMP(3),
    "notes" TEXT,
    "updated_by_name" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_currency_conversions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "project_currency_conversions_dry_dock_project_id_key" ON "project_currency_conversions"("dry_dock_project_id");
CREATE UNIQUE INDEX IF NOT EXISTS "project_currency_conversions_project_id_key" ON "project_currency_conversions"("project_id");
CREATE INDEX IF NOT EXISTS "project_currency_conversions_local_currency_idx" ON "project_currency_conversions"("local_currency");
CREATE INDEX IF NOT EXISTS "project_currency_conversions_deleted_at_idx" ON "project_currency_conversions"("deleted_at");

DO $$ BEGIN
  ALTER TABLE "project_currency_conversions"
    ADD CONSTRAINT "project_currency_conversions_dry_dock_project_id_fkey"
    FOREIGN KEY ("dry_dock_project_id") REFERENCES "dry_dock_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "project_currency_conversions"
    ADD CONSTRAINT "project_currency_conversions_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
