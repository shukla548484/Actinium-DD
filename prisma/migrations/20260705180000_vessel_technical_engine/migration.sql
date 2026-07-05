-- Vessel Technical Data Collection Engine — job library, machinery register, extended vessel jobs

CREATE TYPE "JobLibraryNodeType" AS ENUM ('department', 'category', 'system', 'machinery', 'component', 'standard_job');
CREATE TYPE "VesselConditionRating" AS ENUM ('excellent', 'good', 'monitor', 'poor', 'critical');
CREATE TYPE "VesselJobReviewAction" AS ENUM ('approved', 'rejected', 'returned', 'modified');

CREATE TABLE "job_library_nodes" (
    "id" TEXT NOT NULL,
    "parent_id" TEXT,
    "node_type" "JobLibraryNodeType" NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "department" TEXT,
    "workshop" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "reference_code" TEXT,
    "default_priority" "DdJobPriority",
    "estimated_manhours" DOUBLE PRECISION,
    "input_template" JSONB,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_library_nodes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "vessel_machinery_assets" (
    "id" TEXT NOT NULL,
    "vessel_id" TEXT NOT NULL,
    "library_node_id" TEXT,
    "department" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maker" TEXT,
    "model" TEXT,
    "serial_number" TEXT,
    "installed_at" TIMESTAMP(3),
    "current_running_hours" INTEGER,
    "last_overhaul_date" TIMESTAMP(3),
    "next_due_hours" INTEGER,
    "next_due_date" TIMESTAMP(3),
    "condition_rating" "VesselConditionRating",
    "health_score" INTEGER,
    "notes" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vessel_machinery_assets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "vessel_machinery_running_hours_entries" (
    "id" TEXT NOT NULL,
    "vessel_id" TEXT NOT NULL,
    "machinery_asset_id" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "current_hours" INTEGER NOT NULL,
    "last_recorded_hours" INTEGER,
    "hour_difference" INTEGER,
    "last_job_done_date" TIMESTAMP(3),
    "next_due_hours" INTEGER,
    "next_due_date" TIMESTAMP(3),
    "entered_by" TEXT NOT NULL,
    "verified_by" TEXT,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vessel_machinery_running_hours_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "vessel_machinery_parameter_entries" (
    "id" TEXT NOT NULL,
    "vessel_id" TEXT NOT NULL,
    "machinery_asset_id" TEXT NOT NULL,
    "parameter_key" TEXT NOT NULL,
    "parameter_label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "unit" TEXT,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entered_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vessel_machinery_parameter_entries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "vessel_machinery_condition_reports" (
    "id" TEXT NOT NULL,
    "vessel_id" TEXT NOT NULL,
    "machinery_asset_id" TEXT,
    "department" TEXT,
    "overall_rating" "VesselConditionRating" NOT NULL,
    "summary" TEXT,
    "deficiencies" TEXT,
    "recommendations" TEXT,
    "reported_by" TEXT NOT NULL,
    "reported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vessel_machinery_condition_reports_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "dd_vessel_jobs" ADD COLUMN "standard_job_library_id" TEXT;
ALTER TABLE "dd_vessel_jobs" ADD COLUMN "department" TEXT;
ALTER TABLE "dd_vessel_jobs" ADD COLUMN "system_key" TEXT;
ALTER TABLE "dd_vessel_jobs" ADD COLUMN "machinery_key" TEXT;
ALTER TABLE "dd_vessel_jobs" ADD COLUMN "component_key" TEXT;
ALTER TABLE "dd_vessel_jobs" ADD COLUMN "condition_rating" "VesselConditionRating";
ALTER TABLE "dd_vessel_jobs" ADD COLUMN "condition_description" TEXT;
ALTER TABLE "dd_vessel_jobs" ADD COLUMN "observed_defect" TEXT;
ALTER TABLE "dd_vessel_jobs" ADD COLUMN "measurements" JSONB;
ALTER TABLE "dd_vessel_jobs" ADD COLUMN "repair_recommendation" TEXT;
ALTER TABLE "dd_vessel_jobs" ADD COLUMN "replacement_parts" TEXT;
ALTER TABLE "dd_vessel_jobs" ADD COLUMN "consumables" TEXT;
ALTER TABLE "dd_vessel_jobs" ADD COLUMN "estimated_manhours" DOUBLE PRECISION;
ALTER TABLE "dd_vessel_jobs" ADD COLUMN "estimated_cost" DOUBLE PRECISION;
ALTER TABLE "dd_vessel_jobs" ADD COLUMN "class_attendance" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "dd_vessel_jobs" ADD COLUMN "maker_attendance" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "dd_vessel_jobs" ADD COLUMN "operational_risk" TEXT;
ALTER TABLE "dd_vessel_jobs" ADD COLUMN "safety_risk" TEXT;
ALTER TABLE "dd_vessel_jobs" ADD COLUMN "environmental_risk" TEXT;
ALTER TABLE "dd_vessel_jobs" ADD COLUMN "criticality" TEXT;
ALTER TABLE "dd_vessel_jobs" ADD COLUMN "last_overhaul_date" TIMESTAMP(3);
ALTER TABLE "dd_vessel_jobs" ADD COLUMN "running_hours_at_survey" INTEGER;
ALTER TABLE "dd_vessel_jobs" ADD COLUMN "ce_review_action" "VesselJobReviewAction";
ALTER TABLE "dd_vessel_jobs" ADD COLUMN "ce_reviewed_at" TIMESTAMP(3);
ALTER TABLE "dd_vessel_jobs" ADD COLUMN "ce_reviewed_by" TEXT;
ALTER TABLE "dd_vessel_jobs" ADD COLUMN "ce_review_notes" TEXT;
ALTER TABLE "dd_vessel_jobs" ADD COLUMN "master_review_action" "VesselJobReviewAction";
ALTER TABLE "dd_vessel_jobs" ADD COLUMN "master_reviewed_at" TIMESTAMP(3);
ALTER TABLE "dd_vessel_jobs" ADD COLUMN "master_reviewed_by" TEXT;
ALTER TABLE "dd_vessel_jobs" ADD COLUMN "linked_defect_id" TEXT;
ALTER TABLE "dd_vessel_jobs" ADD COLUMN "linked_pms_reference" TEXT;
ALTER TABLE "dd_vessel_jobs" ADD COLUMN "form_data" JSONB;
ALTER TABLE "dd_vessel_jobs" ADD COLUMN "attachment_meta" JSONB;
ALTER TABLE "dd_vessel_jobs" ADD COLUMN "photo_count" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "job_library_nodes_parent_id_code_key" ON "job_library_nodes"("parent_id", "code");
CREATE INDEX "job_library_nodes_node_type_idx" ON "job_library_nodes"("node_type");
CREATE INDEX "job_library_nodes_department_idx" ON "job_library_nodes"("department");
CREATE INDEX "job_library_nodes_deleted_at_idx" ON "job_library_nodes"("deleted_at");

CREATE INDEX "vessel_machinery_assets_vessel_id_department_idx" ON "vessel_machinery_assets"("vessel_id", "department");
CREATE INDEX "vessel_machinery_assets_deleted_at_idx" ON "vessel_machinery_assets"("deleted_at");

CREATE INDEX "vessel_machinery_running_hours_entries_vessel_id_recorded_at_idx" ON "vessel_machinery_running_hours_entries"("vessel_id", "recorded_at");
CREATE INDEX "vessel_machinery_running_hours_entries_machinery_asset_id_idx" ON "vessel_machinery_running_hours_entries"("machinery_asset_id");

CREATE INDEX "vessel_machinery_parameter_entries_vessel_id_recorded_at_idx" ON "vessel_machinery_parameter_entries"("vessel_id", "recorded_at");
CREATE INDEX "vessel_machinery_parameter_entries_machinery_asset_id_parameter_key_idx" ON "vessel_machinery_parameter_entries"("machinery_asset_id", "parameter_key");

CREATE INDEX "vessel_machinery_condition_reports_vessel_id_reported_at_idx" ON "vessel_machinery_condition_reports"("vessel_id", "reported_at");

CREATE INDEX "dd_vessel_jobs_standard_job_library_id_idx" ON "dd_vessel_jobs"("standard_job_library_id");

ALTER TABLE "job_library_nodes" ADD CONSTRAINT "job_library_nodes_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "job_library_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "vessel_machinery_assets" ADD CONSTRAINT "vessel_machinery_assets_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vessel_machinery_assets" ADD CONSTRAINT "vessel_machinery_assets_library_node_id_fkey" FOREIGN KEY ("library_node_id") REFERENCES "job_library_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "vessel_machinery_running_hours_entries" ADD CONSTRAINT "vessel_machinery_running_hours_entries_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vessel_machinery_running_hours_entries" ADD CONSTRAINT "vessel_machinery_running_hours_entries_machinery_asset_id_fkey" FOREIGN KEY ("machinery_asset_id") REFERENCES "vessel_machinery_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "vessel_machinery_parameter_entries" ADD CONSTRAINT "vessel_machinery_parameter_entries_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vessel_machinery_parameter_entries" ADD CONSTRAINT "vessel_machinery_parameter_entries_machinery_asset_id_fkey" FOREIGN KEY ("machinery_asset_id") REFERENCES "vessel_machinery_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "vessel_machinery_condition_reports" ADD CONSTRAINT "vessel_machinery_condition_reports_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vessel_machinery_condition_reports" ADD CONSTRAINT "vessel_machinery_condition_reports_machinery_asset_id_fkey" FOREIGN KEY ("machinery_asset_id") REFERENCES "vessel_machinery_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "dd_vessel_jobs" ADD CONSTRAINT "dd_vessel_jobs_standard_job_library_id_fkey" FOREIGN KEY ("standard_job_library_id") REFERENCES "job_library_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
