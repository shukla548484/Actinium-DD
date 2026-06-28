-- Project input submissions + project basic fields

CREATE TYPE "DdInputSubmissionStatus" AS ENUM ('draft', 'submitted', 'reviewed', 'approved', 'rejected', 'inactive');
CREATE TYPE "DdInputResponsibleRole" AS ENUM ('vessel', 'superintendent', 'shipyard', 'purchase', 'class', 'accounts');

ALTER TABLE "dry_dock_projects" ADD COLUMN "port_location" TEXT;
ALTER TABLE "dry_dock_projects" ADD COLUMN "project_owner" TEXT;

CREATE TABLE "dd_input_submissions" (
    "id" TEXT NOT NULL,
    "dry_dock_project_id" TEXT NOT NULL,
    "section_key" TEXT NOT NULL,
    "page_key" TEXT NOT NULL,
    "module_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "DdInputSubmissionStatus" NOT NULL DEFAULT 'draft',
    "values_json" JSONB NOT NULL DEFAULT '{}',
    "entered_by_role" "DdInputResponsibleRole" NOT NULL,
    "entered_by_name" TEXT,
    "entered_at" TIMESTAMP(3),
    "reviewed_by_name" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_notes" TEXT,
    "approved_by_name" TEXT,
    "approved_at" TIMESTAMP(3),
    "linked_job_id" TEXT,
    "mandatory" BOOLEAN NOT NULL DEFAULT false,
    "attachment_required" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "inactive_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dd_input_submissions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "dd_input_submissions_dry_dock_project_id_section_key_idx" ON "dd_input_submissions"("dry_dock_project_id", "section_key");
CREATE INDEX "dd_input_submissions_dry_dock_project_id_page_key_idx" ON "dd_input_submissions"("dry_dock_project_id", "page_key");
CREATE INDEX "dd_input_submissions_status_idx" ON "dd_input_submissions"("status");
CREATE INDEX "dd_input_submissions_deleted_at_idx" ON "dd_input_submissions"("deleted_at");

ALTER TABLE "dd_input_submissions" ADD CONSTRAINT "dd_input_submissions_dry_dock_project_id_fkey"
    FOREIGN KEY ("dry_dock_project_id") REFERENCES "dry_dock_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
