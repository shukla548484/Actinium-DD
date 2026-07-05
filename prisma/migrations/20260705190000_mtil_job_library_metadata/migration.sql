-- MTIL metadata on job library nodes (Marine Technical Intelligence Library)
ALTER TABLE "job_library_nodes" ADD COLUMN IF NOT EXISTS "mtil_phase" INTEGER;
ALTER TABLE "job_library_nodes" ADD COLUMN IF NOT EXISTS "mtil_job_code" TEXT;
ALTER TABLE "job_library_nodes" ADD COLUMN IF NOT EXISTS "dynamic_template_key" TEXT;
ALTER TABLE "job_library_nodes" ADD COLUMN IF NOT EXISTS "mtil_meta" JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS "job_library_nodes_mtil_job_code_key" ON "job_library_nodes"("mtil_job_code");
CREATE INDEX IF NOT EXISTS "job_library_nodes_mtil_phase_idx" ON "job_library_nodes"("mtil_phase");
CREATE INDEX IF NOT EXISTS "job_library_nodes_dynamic_template_key_idx" ON "job_library_nodes"("dynamic_template_key");
