-- AlterTable: designation catalog fields
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "category_tier" TEXT;
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "approval_level" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "reports_to_code" TEXT;
ALTER TABLE "roles" ADD COLUMN IF NOT EXISTS "job_scope" TEXT;

-- Migrate legacy DEV_ADMIN employees/roles to SYS_ADMIN code on next seed.
-- Soft-retire obsolete system role codes (seed handles upsert by code).
