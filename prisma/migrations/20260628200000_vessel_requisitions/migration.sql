-- CreateEnum
CREATE TYPE "VesselRequisitionType" AS ENUM ('spr');

-- CreateEnum
CREATE TYPE "VesselRequisitionPurpose" AS ENUM ('routine_maintenance', 'defect_closer');

-- CreateEnum
CREATE TYPE "VesselRequisitionStatus" AS ENUM ('draft', 'submitted', 'master_approved', 'rejected', 'cancelled', 'converted');

-- CreateEnum
CREATE TYPE "VesselRequisitionLineUrgency" AS ENUM ('low', 'normal', 'high', 'urgent');

-- CreateTable
CREATE TABLE "vessel_requisitions" (
    "id" TEXT NOT NULL,
    "vessel_id" TEXT NOT NULL,
    "vessel_defect_id" TEXT NOT NULL,
    "target_dry_dock_project_id" TEXT,
    "integrated_dry_dock_project_id" TEXT,
    "requisition_number" TEXT NOT NULL,
    "heading" TEXT NOT NULL,
    "description" TEXT,
    "requisition_type" "VesselRequisitionType" NOT NULL DEFAULT 'spr',
    "requisition_purpose" "VesselRequisitionPurpose" NOT NULL DEFAULT 'defect_closer',
    "port_of_supply" TEXT,
    "status" "VesselRequisitionStatus" NOT NULL DEFAULT 'draft',
    "requested_by_employee_id" TEXT,
    "requested_by_name" TEXT,
    "submitted_at" TIMESTAMP(3),
    "master_approved_at" TIMESTAMP(3),
    "master_approved_by_name" TEXT,
    "master_approved_by_employee_id" TEXT,
    "rejected_at" TIMESTAMP(3),
    "rejected_by_name" TEXT,
    "rejection_reason" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by_name" TEXT,
    "converted_at" TIMESTAMP(3),
    "converted_by_name" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vessel_requisitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vessel_requisition_lines" (
    "id" TEXT NOT NULL,
    "requisition_id" TEXT NOT NULL,
    "part_name" TEXT NOT NULL,
    "part_number" TEXT,
    "description" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "urgency" "VesselRequisitionLineUrgency" NOT NULL DEFAULT 'normal',
    "equipment_label" TEXT,
    "remarks" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "integrated_dd_spares_item_id" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vessel_requisition_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vessel_requisitions_vessel_defect_id_key" ON "vessel_requisitions"("vessel_defect_id");

-- CreateIndex
CREATE INDEX "vessel_requisitions_vessel_id_status_idx" ON "vessel_requisitions"("vessel_id", "status");

-- CreateIndex
CREATE INDEX "vessel_requisitions_deleted_at_idx" ON "vessel_requisitions"("deleted_at");

-- CreateIndex
CREATE INDEX "vessel_requisition_lines_requisition_id_idx" ON "vessel_requisition_lines"("requisition_id");

-- CreateIndex
CREATE INDEX "vessel_requisition_lines_deleted_at_idx" ON "vessel_requisition_lines"("deleted_at");

-- AddForeignKey
ALTER TABLE "vessel_requisitions" ADD CONSTRAINT "vessel_requisitions_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vessel_requisitions" ADD CONSTRAINT "vessel_requisitions_vessel_defect_id_fkey" FOREIGN KEY ("vessel_defect_id") REFERENCES "vessel_defects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vessel_requisitions" ADD CONSTRAINT "vessel_requisitions_target_dry_dock_project_id_fkey" FOREIGN KEY ("target_dry_dock_project_id") REFERENCES "dry_dock_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vessel_requisitions" ADD CONSTRAINT "vessel_requisitions_integrated_dry_dock_project_id_fkey" FOREIGN KEY ("integrated_dry_dock_project_id") REFERENCES "dry_dock_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vessel_requisition_lines" ADD CONSTRAINT "vessel_requisition_lines_requisition_id_fkey" FOREIGN KEY ("requisition_id") REFERENCES "vessel_requisitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vessel_requisition_lines" ADD CONSTRAINT "vessel_requisition_lines_integrated_dd_spares_item_id_fkey" FOREIGN KEY ("integrated_dd_spares_item_id") REFERENCES "dd_spares_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
