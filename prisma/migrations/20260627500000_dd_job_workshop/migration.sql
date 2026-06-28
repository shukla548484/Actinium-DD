-- Add first-class workshop field on dd_jobs and backfill from legacy description prefix.
ALTER TABLE "dd_jobs" ADD COLUMN IF NOT EXISTS "workshop" TEXT;

UPDATE "dd_jobs"
SET "workshop" = TRIM(SUBSTRING("description" FROM 11))
WHERE "description" LIKE 'Workshop:%'
  AND ("workshop" IS NULL OR "workshop" = '');

CREATE INDEX IF NOT EXISTS "dd_jobs_dry_dock_project_id_workshop_idx"
  ON "dd_jobs" ("dry_dock_project_id", "workshop");
