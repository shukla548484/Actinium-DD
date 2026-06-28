-- CreateEnum
CREATE TYPE "DdVesselJobStatus" AS ENUM ('draft', 'submitted', 'approved', 'integrated', 'rejected', 'carry_forward');

-- CreateEnum
CREATE TYPE "DdVesselJobSource" AS ENUM ('vessel', 'pms', 'class', 'superintendent', 'defect_report');

-- CreateTable
CREATE TABLE "dd_vessel_jobs" (
    "id" TEXT NOT NULL,
    "vessel_id" TEXT NOT NULL,
    "target_dry_dock_project_id" TEXT,
    "integrated_dry_dock_project_id" TEXT,
    "integrated_dd_job_id" TEXT,
    "job_code" TEXT,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "workshop" TEXT,
    "description" TEXT,
    "priority" "DdJobPriority" NOT NULL DEFAULT 'medium',
    "source" "DdVesselJobSource" NOT NULL DEFAULT 'vessel',
    "status" "DdVesselJobStatus" NOT NULL DEFAULT 'draft',
    "created_by_name" TEXT,
    "created_by_role" "DdInputResponsibleRole",
    "submitted_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "approved_by_name" TEXT,
    "integrated_at" TIMESTAMP(3),
    "integrated_by_name" TEXT,
    "rejected_at" TIMESTAMP(3),
    "rejected_by_name" TEXT,
    "rejection_reason" TEXT,
    "carry_forward_reason" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dd_vessel_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dd_vessel_jobs_integrated_dd_job_id_key" ON "dd_vessel_jobs"("integrated_dd_job_id");

-- CreateIndex
CREATE INDEX "dd_vessel_jobs_vessel_id_status_idx" ON "dd_vessel_jobs"("vessel_id", "status");

-- CreateIndex
CREATE INDEX "dd_vessel_jobs_target_dry_dock_project_id_idx" ON "dd_vessel_jobs"("target_dry_dock_project_id");

-- CreateIndex
CREATE INDEX "dd_vessel_jobs_integrated_dry_dock_project_id_idx" ON "dd_vessel_jobs"("integrated_dry_dock_project_id");

-- CreateIndex
CREATE INDEX "dd_vessel_jobs_deleted_at_idx" ON "dd_vessel_jobs"("deleted_at");

-- AddForeignKey
ALTER TABLE "dd_vessel_jobs" ADD CONSTRAINT "dd_vessel_jobs_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dd_vessel_jobs" ADD CONSTRAINT "dd_vessel_jobs_target_dry_dock_project_id_fkey" FOREIGN KEY ("target_dry_dock_project_id") REFERENCES "dry_dock_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dd_vessel_jobs" ADD CONSTRAINT "dd_vessel_jobs_integrated_dry_dock_project_id_fkey" FOREIGN KEY ("integrated_dry_dock_project_id") REFERENCES "dry_dock_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dd_vessel_jobs" ADD CONSTRAINT "dd_vessel_jobs_integrated_dd_job_id_fkey" FOREIGN KEY ("integrated_dd_job_id") REFERENCES "dd_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
