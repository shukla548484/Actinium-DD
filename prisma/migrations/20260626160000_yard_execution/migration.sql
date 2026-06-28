-- CreateEnum
CREATE TYPE "YardWorkProjectStatus" AS ENUM ('planning', 'execution', 'completed', 'on_hold');

-- CreateEnum
CREATE TYPE "WorkshopJobStatus" AS ENUM ('not_started', 'in_progress', 'completed', 'blocked', 'awaiting_owner', 'awaiting_class', 'awaiting_material');

-- CreateEnum
CREATE TYPE "JobPriority" AS ENUM ('critical', 'high', 'normal', 'low');

-- CreateTable
CREATE TABLE "yard_work_projects" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "yard_company_id" TEXT,
    "status" "YardWorkProjectStatus" NOT NULL DEFAULT 'planning',
    "planned_start" TIMESTAMP(3),
    "planned_finish" TIMESTAMP(3),
    "actual_start" TIMESTAMP(3),
    "actual_finish" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "yard_work_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workshop_jobs" (
    "id" TEXT NOT NULL,
    "yard_work_project_id" TEXT NOT NULL,
    "workshop_slug" TEXT NOT NULL,
    "job_code" TEXT,
    "job_title" TEXT NOT NULL,
    "vessel_area" TEXT,
    "priority" "JobPriority" NOT NULL DEFAULT 'normal',
    "status" "WorkshopJobStatus" NOT NULL DEFAULT 'not_started',
    "planned_start" TIMESTAMP(3),
    "planned_finish" TIMESTAMP(3),
    "actual_start" TIMESTAMP(3),
    "actual_finish" TIMESTAMP(3),
    "progress_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "manpower_required" INTEGER,
    "equipment_required" TEXT,
    "material_required" TEXT,
    "permit_required" TEXT,
    "class_hold_point" BOOLEAN NOT NULL DEFAULT false,
    "owner_approval_required" BOOLEAN NOT NULL DEFAULT false,
    "blocking_dependency" TEXT,
    "delay_reason" TEXT,
    "remarks" TEXT,
    "is_critical_path" BOOLEAN NOT NULL DEFAULT false,
    "is_variation" BOOLEAN NOT NULL DEFAULT false,
    "spec_line_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workshop_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workshop_job_dependencies" (
    "id" TEXT NOT NULL,
    "successor_job_id" TEXT NOT NULL,
    "predecessor_job_id" TEXT NOT NULL,
    "lag_days" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "workshop_job_dependencies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "yard_work_projects_project_id_key" ON "yard_work_projects"("project_id");

-- CreateIndex
CREATE INDEX "workshop_jobs_yard_work_project_id_workshop_slug_idx" ON "workshop_jobs"("yard_work_project_id", "workshop_slug");

-- CreateIndex
CREATE INDEX "workshop_jobs_status_idx" ON "workshop_jobs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "workshop_job_dependencies_successor_job_id_predecessor_job_id_key" ON "workshop_job_dependencies"("successor_job_id", "predecessor_job_id");

-- AddForeignKey
ALTER TABLE "yard_work_projects" ADD CONSTRAINT "yard_work_projects_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workshop_jobs" ADD CONSTRAINT "workshop_jobs_yard_work_project_id_fkey" FOREIGN KEY ("yard_work_project_id") REFERENCES "yard_work_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workshop_jobs" ADD CONSTRAINT "workshop_jobs_spec_line_id_fkey" FOREIGN KEY ("spec_line_id") REFERENCES "spec_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workshop_job_dependencies" ADD CONSTRAINT "workshop_job_dependencies_successor_job_id_fkey" FOREIGN KEY ("successor_job_id") REFERENCES "workshop_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workshop_job_dependencies" ADD CONSTRAINT "workshop_job_dependencies_predecessor_job_id_fkey" FOREIGN KEY ("predecessor_job_id") REFERENCES "workshop_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
