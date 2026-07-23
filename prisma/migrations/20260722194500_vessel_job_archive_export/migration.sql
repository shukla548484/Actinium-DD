-- Ship job bank: archive + shipyard export assignment timestamps
ALTER TABLE "dd_vessel_jobs" ADD COLUMN IF NOT EXISTS "export_assigned_at" TIMESTAMP(3);
ALTER TABLE "dd_vessel_jobs" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "dd_vessel_jobs_archived_at_idx" ON "dd_vessel_jobs"("archived_at");
CREATE INDEX IF NOT EXISTS "dd_vessel_jobs_export_assigned_at_idx" ON "dd_vessel_jobs"("export_assigned_at");
