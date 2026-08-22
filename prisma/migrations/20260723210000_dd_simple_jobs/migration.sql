-- Separate simple Dry Dock Jobs (template v1) — paint jobs with prep/coat lines.
CREATE TYPE "DdSimpleJobStatus" AS ENUM ('draft', 'submitted', 'approved', 'rejected', 'cancelled');
CREATE TYPE "DdSimpleJobFamily" AS ENUM ('paint');

CREATE TABLE "dd_simple_jobs" (
    "id" TEXT NOT NULL,
    "vessel_id" TEXT NOT NULL,
    "family" "DdSimpleJobFamily" NOT NULL DEFAULT 'paint',
    "job_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "priority" "DdJobPriority" NOT NULL DEFAULT 'medium',
    "status" "DdSimpleJobStatus" NOT NULL DEFAULT 'draft',
    "created_by_employee_id" TEXT,
    "created_by_name" TEXT,
    "submitted_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "approved_by_name" TEXT,
    "approved_by_employee_id" TEXT,
    "rejected_at" TIMESTAMP(3),
    "rejected_by_name" TEXT,
    "rejection_reason" TEXT,
    "cancelled_at" TIMESTAMP(3),
    "cancelled_by_name" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dd_simple_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dd_simple_job_prep_lines" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "area_code" TEXT NOT NULL,
    "area_label" TEXT,
    "prep_method_code" TEXT NOT NULL,
    "prep_method_label" TEXT,
    "area_sqm" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dd_simple_job_prep_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "dd_simple_job_coat_lines" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "area_code" TEXT NOT NULL,
    "area_label" TEXT,
    "primer_coats" INTEGER NOT NULL DEFAULT 0,
    "binder_coats" INTEGER NOT NULL DEFAULT 0,
    "finish_coats" INTEGER NOT NULL DEFAULT 0,
    "dft_required" BOOLEAN NOT NULL DEFAULT false,
    "dft_um" DOUBLE PRECISION,
    "notes" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dd_simple_job_coat_lines_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "dd_simple_jobs_vessel_id_status_idx" ON "dd_simple_jobs"("vessel_id", "status");
CREATE INDEX "dd_simple_jobs_family_job_type_idx" ON "dd_simple_jobs"("family", "job_type");
CREATE INDEX "dd_simple_jobs_deleted_at_idx" ON "dd_simple_jobs"("deleted_at");
CREATE INDEX "dd_simple_job_prep_lines_job_id_idx" ON "dd_simple_job_prep_lines"("job_id");
CREATE INDEX "dd_simple_job_coat_lines_job_id_idx" ON "dd_simple_job_coat_lines"("job_id");

ALTER TABLE "dd_simple_jobs" ADD CONSTRAINT "dd_simple_jobs_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dd_simple_job_prep_lines" ADD CONSTRAINT "dd_simple_job_prep_lines_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "dd_simple_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dd_simple_job_coat_lines" ADD CONSTRAINT "dd_simple_job_coat_lines_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "dd_simple_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
