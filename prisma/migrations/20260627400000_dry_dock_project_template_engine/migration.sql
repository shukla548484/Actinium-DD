-- CreateEnum
CREATE TYPE "DryDockProjectType" AS ENUM (
  'special_survey',
  'intermediate_survey',
  'damage_repair',
  'occasional_repair',
  'underwater_survey',
  'new_installation',
  'emergency_docking',
  'layup_reactivation',
  'conversion_modification',
  'warranty_repair'
);

CREATE TYPE "DryDockProjectPriority" AS ENUM ('low', 'medium', 'high', 'critical');

-- Expand DryDockProjectStatus lifecycle
ALTER TYPE "DryDockProjectStatus" ADD VALUE IF NOT EXISTS 'draft';
ALTER TYPE "DryDockProjectStatus" ADD VALUE IF NOT EXISTS 'budgeting';
ALTER TYPE "DryDockProjectStatus" ADD VALUE IF NOT EXISTS 'rfq_issued';
ALTER TYPE "DryDockProjectStatus" ADD VALUE IF NOT EXISTS 'quote_evaluation';
ALTER TYPE "DryDockProjectStatus" ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE "DryDockProjectStatus" ADD VALUE IF NOT EXISTS 'mobilization';
ALTER TYPE "DryDockProjectStatus" ADD VALUE IF NOT EXISTS 'docking';
ALTER TYPE "DryDockProjectStatus" ADD VALUE IF NOT EXISTS 'execution';
ALTER TYPE "DryDockProjectStatus" ADD VALUE IF NOT EXISTS 'sea_trial';
ALTER TYPE "DryDockProjectStatus" ADD VALUE IF NOT EXISTS 'final_inspection';
ALTER TYPE "DryDockProjectStatus" ADD VALUE IF NOT EXISTS 'archived';
ALTER TYPE "DryDockProjectStatus" ADD VALUE IF NOT EXISTS 'on_hold';
ALTER TYPE "DryDockProjectStatus" ADD VALUE IF NOT EXISTS 'cancelled';
ALTER TYPE "DryDockProjectStatus" ADD VALUE IF NOT EXISTS 'reopened';

-- DryDockProject template engine fields
ALTER TABLE "dry_dock_projects" ADD COLUMN "project_type" "DryDockProjectType" NOT NULL DEFAULT 'special_survey';
ALTER TABLE "dry_dock_projects" ADD COLUMN "priority" "DryDockProjectPriority" NOT NULL DEFAULT 'medium';
ALTER TABLE "dry_dock_projects" ADD COLUMN "expected_sailing" TIMESTAMP(3);
ALTER TABLE "dry_dock_projects" ADD COLUMN "shipyard_country" TEXT;
ALTER TABLE "dry_dock_projects" ADD COLUMN "dock_type" TEXT;
ALTER TABLE "dry_dock_projects" ADD COLUMN "currency" TEXT DEFAULT 'USD';
ALTER TABLE "dry_dock_projects" ADD COLUMN "approved_budget" DOUBLE PRECISION;
ALTER TABLE "dry_dock_projects" ADD COLUMN "contingency_budget" DOUBLE PRECISION;
ALTER TABLE "dry_dock_projects" ADD COLUMN "off_hire_cost" DOUBLE PRECISION;
ALTER TABLE "dry_dock_projects" ADD COLUMN "dry_dock_days" INTEGER;
ALTER TABLE "dry_dock_projects" ADD COLUMN "class_society" TEXT;
ALTER TABLE "dry_dock_projects" ADD COLUMN "survey_type" TEXT;
ALTER TABLE "dry_dock_projects" ADD COLUMN "main_scope" TEXT;
ALTER TABLE "dry_dock_projects" ADD COLUMN "docking_reason" TEXT;
ALTER TABLE "dry_dock_projects" ADD COLUMN "template_version" TEXT NOT NULL DEFAULT '1';
ALTER TABLE "dry_dock_projects" ADD COLUMN "workspace_provisioned_at" TIMESTAMP(3);

CREATE INDEX "dry_dock_projects_project_type_idx" ON "dry_dock_projects"("project_type");
