-- Soft collaboration package: group multiple same-machinery DdVesselJobs under one package id
ALTER TABLE "dd_vessel_jobs"
  ADD COLUMN IF NOT EXISTS "collaboration_package_id" TEXT;

CREATE INDEX IF NOT EXISTS "dd_vessel_jobs_collaboration_package_id_idx"
  ON "dd_vessel_jobs"("collaboration_package_id");
