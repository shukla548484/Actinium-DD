-- CreateEnum
CREATE TYPE "YardRegisterStatus" AS ENUM ('open', 'in_progress', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "YardClarificationStatus" AS ENUM ('open', 'awaiting_owner', 'awaiting_class', 'resolved');

-- CreateEnum
CREATE TYPE "YardPermitType" AS ENUM ('hot_work', 'enclosed_space', 'height_work', 'other');

-- CreateEnum
CREATE TYPE "YardInspectionResult" AS ENUM ('pending', 'pass', 'fail', 'conditional');

-- CreateEnum
CREATE TYPE "YardAttachmentType" AS ENUM ('photo', 'document', 'drawing', 'certificate');

-- CreateEnum
CREATE TYPE "YardAttachmentVisibility" AS ENUM ('internal', 'owner', 'class');

-- CreateTable
CREATE TABLE "yard_daily_progress" (
    "id" TEXT NOT NULL,
    "yard_work_project_id" TEXT NOT NULL,
    "workshop_job_id" TEXT,
    "report_date" TIMESTAMP(3) NOT NULL,
    "progress_pct" DOUBLE PRECISION,
    "manpower_count" INTEGER,
    "remarks" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "yard_daily_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "yard_delay_entries" (
    "id" TEXT NOT NULL,
    "yard_work_project_id" TEXT NOT NULL,
    "workshop_job_id" TEXT,
    "delay_reason" TEXT NOT NULL,
    "impact_days" INTEGER,
    "owner_action" TEXT,
    "status" "YardRegisterStatus" NOT NULL DEFAULT 'open',
    "since_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "yard_delay_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "yard_permit_entries" (
    "id" TEXT NOT NULL,
    "yard_work_project_id" TEXT NOT NULL,
    "workshop_job_id" TEXT,
    "permit_no" TEXT,
    "permit_type" "YardPermitType" NOT NULL DEFAULT 'other',
    "valid_from" TIMESTAMP(3),
    "valid_to" TIMESTAMP(3),
    "safety_officer" TEXT,
    "status" "YardRegisterStatus" NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "yard_permit_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "yard_inspection_entries" (
    "id" TEXT NOT NULL,
    "yard_work_project_id" TEXT NOT NULL,
    "workshop_job_id" TEXT,
    "hold_point" TEXT,
    "inspector" TEXT,
    "planned_date" TIMESTAMP(3),
    "completed_date" TIMESTAMP(3),
    "result" "YardInspectionResult" NOT NULL DEFAULT 'pending',
    "class_comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "yard_inspection_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "yard_clarifications" (
    "id" TEXT NOT NULL,
    "yard_work_project_id" TEXT NOT NULL,
    "workshop_job_id" TEXT,
    "ref_no" TEXT,
    "issue_type" TEXT NOT NULL,
    "raised_by" TEXT,
    "action_by" TEXT,
    "body" TEXT NOT NULL,
    "owner_reply" TEXT,
    "class_comment" TEXT,
    "internal_notes" TEXT,
    "status" "YardClarificationStatus" NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "yard_clarifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "yard_variation_entries" (
    "id" TEXT NOT NULL,
    "yard_work_project_id" TEXT NOT NULL,
    "workshop_job_id" TEXT,
    "vo_number" TEXT,
    "description" TEXT NOT NULL,
    "raised_by" TEXT,
    "owner_status" "YardRegisterStatus" NOT NULL DEFAULT 'open',
    "commercial_impact" DOUBLE PRECISION,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "yard_variation_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "yard_job_attachments" (
    "id" TEXT NOT NULL,
    "yard_work_project_id" TEXT NOT NULL,
    "workshop_job_id" TEXT,
    "attachment_type" "YardAttachmentType" NOT NULL DEFAULT 'document',
    "filename" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "uploaded_by" TEXT,
    "visibility" "YardAttachmentVisibility" NOT NULL DEFAULT 'internal',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "yard_job_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "yard_daily_progress_yard_work_project_id_report_date_idx" ON "yard_daily_progress"("yard_work_project_id", "report_date");

-- CreateIndex
CREATE INDEX "yard_delay_entries_yard_work_project_id_status_idx" ON "yard_delay_entries"("yard_work_project_id", "status");

-- CreateIndex
CREATE INDEX "yard_permit_entries_yard_work_project_id_status_idx" ON "yard_permit_entries"("yard_work_project_id", "status");

-- CreateIndex
CREATE INDEX "yard_inspection_entries_yard_work_project_id_result_idx" ON "yard_inspection_entries"("yard_work_project_id", "result");

-- CreateIndex
CREATE INDEX "yard_clarifications_yard_work_project_id_status_idx" ON "yard_clarifications"("yard_work_project_id", "status");

-- CreateIndex
CREATE INDEX "yard_variation_entries_yard_work_project_id_owner_status_idx" ON "yard_variation_entries"("yard_work_project_id", "owner_status");

-- CreateIndex
CREATE INDEX "yard_job_attachments_yard_work_project_id_attachment_type_idx" ON "yard_job_attachments"("yard_work_project_id", "attachment_type");

-- AddForeignKey
ALTER TABLE "yard_daily_progress" ADD CONSTRAINT "yard_daily_progress_yard_work_project_id_fkey" FOREIGN KEY ("yard_work_project_id") REFERENCES "yard_work_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yard_daily_progress" ADD CONSTRAINT "yard_daily_progress_workshop_job_id_fkey" FOREIGN KEY ("workshop_job_id") REFERENCES "workshop_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yard_delay_entries" ADD CONSTRAINT "yard_delay_entries_yard_work_project_id_fkey" FOREIGN KEY ("yard_work_project_id") REFERENCES "yard_work_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yard_delay_entries" ADD CONSTRAINT "yard_delay_entries_workshop_job_id_fkey" FOREIGN KEY ("workshop_job_id") REFERENCES "workshop_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yard_permit_entries" ADD CONSTRAINT "yard_permit_entries_yard_work_project_id_fkey" FOREIGN KEY ("yard_work_project_id") REFERENCES "yard_work_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yard_permit_entries" ADD CONSTRAINT "yard_permit_entries_workshop_job_id_fkey" FOREIGN KEY ("workshop_job_id") REFERENCES "workshop_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yard_inspection_entries" ADD CONSTRAINT "yard_inspection_entries_yard_work_project_id_fkey" FOREIGN KEY ("yard_work_project_id") REFERENCES "yard_work_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yard_inspection_entries" ADD CONSTRAINT "yard_inspection_entries_workshop_job_id_fkey" FOREIGN KEY ("workshop_job_id") REFERENCES "workshop_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yard_clarifications" ADD CONSTRAINT "yard_clarifications_yard_work_project_id_fkey" FOREIGN KEY ("yard_work_project_id") REFERENCES "yard_work_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yard_clarifications" ADD CONSTRAINT "yard_clarifications_workshop_job_id_fkey" FOREIGN KEY ("workshop_job_id") REFERENCES "workshop_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yard_variation_entries" ADD CONSTRAINT "yard_variation_entries_yard_work_project_id_fkey" FOREIGN KEY ("yard_work_project_id") REFERENCES "yard_work_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yard_variation_entries" ADD CONSTRAINT "yard_variation_entries_workshop_job_id_fkey" FOREIGN KEY ("workshop_job_id") REFERENCES "workshop_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yard_job_attachments" ADD CONSTRAINT "yard_job_attachments_yard_work_project_id_fkey" FOREIGN KEY ("yard_work_project_id") REFERENCES "yard_work_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yard_job_attachments" ADD CONSTRAINT "yard_job_attachments_workshop_job_id_fkey" FOREIGN KEY ("workshop_job_id") REFERENCES "workshop_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
