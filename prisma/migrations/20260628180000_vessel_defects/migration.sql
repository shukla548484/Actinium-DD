-- CreateEnum
CREATE TYPE "VesselDefectEquipmentSystem" AS ENUM ('main_engine', 'auxiliary_engine', 'boiler', 'electrical', 'navigation', 'deck', 'cargo', 'safety', 'piping', 'pumps', 'hull', 'other');

-- CreateEnum
CREATE TYPE "VesselDefectStatus" AS ENUM ('draft', 'submitted', 'master_approved', 'rejected', 'cancelled');

-- CreateTable
CREATE TABLE "vessel_defects" (
    "id" TEXT NOT NULL,
    "vessel_id" TEXT NOT NULL,
    "equipment_system" "VesselDefectEquipmentSystem" NOT NULL,
    "equipment_label" TEXT,
    "location" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" "DdJobPriority" NOT NULL DEFAULT 'medium',
    "status" "VesselDefectStatus" NOT NULL DEFAULT 'draft',
    "reported_by_employee_id" TEXT,
    "reported_by_name" TEXT,
    "submitted_at" TIMESTAMP(3),
    "master_approved_at" TIMESTAMP(3),
    "master_approved_by_name" TEXT,
    "master_approved_by_employee_id" TEXT,
    "rejected_at" TIMESTAMP(3),
    "rejected_by_name" TEXT,
    "rejection_reason" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by_name" TEXT,
    "linked_vessel_job_id" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vessel_defects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vessel_defects_vessel_id_status_idx" ON "vessel_defects"("vessel_id", "status");

-- CreateIndex
CREATE INDEX "vessel_defects_deleted_at_idx" ON "vessel_defects"("deleted_at");

-- AddForeignKey
ALTER TABLE "vessel_defects" ADD CONSTRAINT "vessel_defects_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vessel_defects" ADD CONSTRAINT "vessel_defects_linked_vessel_job_id_fkey" FOREIGN KEY ("linked_vessel_job_id") REFERENCES "dd_vessel_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
