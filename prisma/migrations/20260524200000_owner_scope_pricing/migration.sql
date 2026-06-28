-- AlterTable: owner scope on spec_lines
ALTER TABLE "spec_lines" ADD COLUMN IF NOT EXISTS "scope_days" DOUBLE PRECISION;
ALTER TABLE "spec_lines" ADD COLUMN IF NOT EXISTS "scope_area_m2" DOUBLE PRECISION;
ALTER TABLE "spec_lines" ADD COLUMN IF NOT EXISTS "scope_notes" TEXT;
ALTER TABLE "spec_lines" ADD COLUMN IF NOT EXISTS "owner_locked" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "spec_lines" ADD COLUMN IF NOT EXISTS "allow_discount" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "spec_lines" ADD COLUMN IF NOT EXISTS "max_discount_pct" DOUBLE PRECISION;
ALTER TABLE "spec_lines" ADD COLUMN IF NOT EXISTS "reference_unit_rate" DOUBLE PRECISION;

-- AlterTable: yard pricing on quote_lines
ALTER TABLE "quote_lines" ADD COLUMN IF NOT EXISTS "discount_pct" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "quote_lines" ADD COLUMN IF NOT EXISTS "gross_total" DOUBLE PRECISION;
ALTER TABLE "quote_lines" ADD COLUMN IF NOT EXISTS "net_total" DOUBLE PRECISION;

-- AlterTable: commercial totals on quote_meta
ALTER TABLE "quote_meta" ADD COLUMN IF NOT EXISTS "global_discount_pct" DOUBLE PRECISION;
ALTER TABLE "quote_meta" ADD COLUMN IF NOT EXISTS "tax_pct" DOUBLE PRECISION;
ALTER TABLE "quote_meta" ADD COLUMN IF NOT EXISTS "quote_gross_total" DOUBLE PRECISION;
ALTER TABLE "quote_meta" ADD COLUMN IF NOT EXISTS "quote_net_total" DOUBLE PRECISION;
