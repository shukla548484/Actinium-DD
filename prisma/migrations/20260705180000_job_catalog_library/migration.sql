-- Job catalog library schema (tabs 01–09 + Lists) for dynamic job templates.

CREATE TYPE "JobCatalogDepartment" AS ENUM ('engine', 'deck', 'electrical', 'hull', 'safety', 'cargo', 'accommodation');
CREATE TYPE "JobCatalogWorkshop" AS ENUM ('machinery', 'pipe', 'steel', 'hull', 'paint', 'electrical', 'deck', 'safety', 'qa_qc');
CREATE TYPE "JobTemplateCategory" AS ENUM ('machinery_overhaul', 'inspection', 'survey', 'repair', 'testing', 'cleaning', 'documentation', 'general');
CREATE TYPE "JobMeasurementInputType" AS ENUM ('number', 'text', 'dropdown', 'date');
CREATE TYPE "JobChecklistResponseType" AS ENUM ('pass_fail_na', 'yes_no', 'text', 'number');
CREATE TYPE "JobScopeResponsibleParty" AS ENUM ('owner', 'yard', 'maker', 'class');
CREATE TYPE "JobAttachmentType" AS ENUM ('photo', 'report', 'certificate', 'drawing', 'video', 'manual');
CREATE TYPE "JobAttachmentStage" AS ENUM ('before', 'during', 'after', 'final');
CREATE TYPE "JobSpareItemType" AS ENUM ('spare', 'consumable', 'tool', 'material');
CREATE TYPE "JobQuantityBasis" AS ENUM ('per_job', 'per_unit', 'as_required');
CREATE TYPE "JobPricingBasis" AS ENUM ('lump_sum', 'per_unit', 'per_day', 'per_meter');
CREATE TYPE "JobUiLayoutType" AS ENUM ('card_tabs', 'wizard', 'single_form', 'split_panels');
CREATE TYPE "JobCatalogListType" AS ENUM ('project_types', 'vessel_types', 'departments', 'workshops', 'risk_levels', 'attachment_types', 'job_statuses', 'user_roles');
CREATE TYPE "JobWorkflowStatus" AS ENUM ('draft', 'submitted', 'reviewed', 'approved', 'rfq', 'awarded', 'in_progress', 'completed', 'closed', 'cancelled');

CREATE TABLE "job_approval_workflows" (
    "id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "created_by_role" TEXT NOT NULL,
    "review_by_role" TEXT NOT NULL,
    "approve_by_role" TEXT NOT NULL,
    "shipyard_update_role" TEXT,
    "class_approval_required" BOOLEAN NOT NULL DEFAULT false,
    "owner_approval_required" BOOLEAN NOT NULL DEFAULT false,
    "status_flow" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "job_approval_workflows_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "job_dynamic_templates" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "template_name" TEXT NOT NULL,
    "template_category" "JobTemplateCategory" NOT NULL,
    "version" TEXT NOT NULL,
    "form_sections" JSONB NOT NULL,
    "auto_fill_fields" JSONB NOT NULL,
    "manual_input_fields" JSONB NOT NULL,
    "required_photos" JSONB NOT NULL,
    "required_attachments" JSONB NOT NULL,
    "measurement_set_id" TEXT,
    "checklist_id" TEXT,
    "approval_workflow_id" TEXT NOT NULL,
    "ui_layout_type" "JobUiLayoutType" NOT NULL,
    "active_flag" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "job_dynamic_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "master_job_library" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "library_version" TEXT NOT NULL,
    "department" "JobCatalogDepartment" NOT NULL,
    "system_group" TEXT NOT NULL,
    "machinery" TEXT NOT NULL,
    "component" TEXT NOT NULL,
    "sub_component" TEXT,
    "standard_job_name" TEXT NOT NULL,
    "job_description" TEXT NOT NULL,
    "applicable_vessel_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "applicable_project_types" "DryDockProjectType"[] DEFAULT ARRAY[]::"DryDockProjectType"[],
    "survey_type" TEXT,
    "workshop" "JobCatalogWorkshop" NOT NULL,
    "responsible_user_role" TEXT NOT NULL,
    "review_role" TEXT NOT NULL,
    "approval_role" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "measurement_set_id" TEXT,
    "inspection_checklist_id" TEXT,
    "scope_of_work_id" TEXT,
    "rfq_category" TEXT NOT NULL,
    "budget_category" TEXT NOT NULL,
    "dry_dock_cost_code" TEXT NOT NULL,
    "mandatory_flag" BOOLEAN NOT NULL DEFAULT false,
    "class_hold_point" BOOLEAN NOT NULL DEFAULT false,
    "maker_attendance_required" BOOLEAN NOT NULL DEFAULT false,
    "permit_required" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "photo_required" BOOLEAN NOT NULL DEFAULT false,
    "attachment_required" BOOLEAN NOT NULL DEFAULT false,
    "standard_man_hours" DOUBLE PRECISION,
    "risk_level" "DdRiskLevel" NOT NULL,
    "active_flag" BOOLEAN NOT NULL DEFAULT true,
    "remarks" TEXT,
    "job_library_node_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "master_job_library_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "job_measurements" (
    "id" TEXT NOT NULL,
    "measurement_id" TEXT NOT NULL,
    "measurement_set_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "measurement_name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "min_limit" DOUBLE PRECISION,
    "max_limit" DOUBLE PRECISION,
    "target_value" TEXT,
    "input_type" "JobMeasurementInputType" NOT NULL,
    "mandatory_flag" BOOLEAN NOT NULL DEFAULT false,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "job_measurements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "job_checklist_items" (
    "id" TEXT NOT NULL,
    "checklist_item_id" TEXT NOT NULL,
    "checklist_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "sequence_no" INTEGER NOT NULL,
    "inspection_item" TEXT NOT NULL,
    "acceptance_criteria" TEXT NOT NULL,
    "response_type" "JobChecklistResponseType" NOT NULL,
    "photo_required_on_fail" BOOLEAN NOT NULL DEFAULT false,
    "mandatory_flag" BOOLEAN NOT NULL DEFAULT false,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "job_checklist_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "job_scope_steps" (
    "id" TEXT NOT NULL,
    "scope_step_id" TEXT NOT NULL,
    "scope_of_work_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "sequence_no" INTEGER NOT NULL,
    "work_step" TEXT NOT NULL,
    "responsible_party" "JobScopeResponsibleParty" NOT NULL,
    "permit_required" TEXT,
    "qa_hold_point" BOOLEAN NOT NULL DEFAULT false,
    "class_hold_point" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "job_scope_steps_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "job_attachment_requirements" (
    "id" TEXT NOT NULL,
    "attachment_requirement_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "attachment_type" "JobAttachmentType" NOT NULL,
    "attachment_name" TEXT NOT NULL,
    "stage" "JobAttachmentStage" NOT NULL,
    "mandatory_flag" BOOLEAN NOT NULL DEFAULT false,
    "allowed_file_types" TEXT NOT NULL,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "job_attachment_requirements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "job_spare_mappings" (
    "id" TEXT NOT NULL,
    "spare_map_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "item_type" "JobSpareItemType" NOT NULL,
    "item_name" TEXT NOT NULL,
    "quantity_basis" "JobQuantityBasis" NOT NULL,
    "recommended_qty" DOUBLE PRECISION,
    "owner_supply_flag" BOOLEAN NOT NULL DEFAULT false,
    "yard_supply_flag" BOOLEAN NOT NULL DEFAULT false,
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "job_spare_mappings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "job_rfq_budget_mappings" (
    "id" TEXT NOT NULL,
    "mapping_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "rfq_section" TEXT NOT NULL,
    "quote_comparison_section" TEXT NOT NULL,
    "budget_category" TEXT NOT NULL,
    "cost_code" TEXT NOT NULL,
    "workshop" TEXT NOT NULL,
    "pricing_basis" "JobPricingBasis" NOT NULL,
    "discount_applicable" BOOLEAN NOT NULL DEFAULT false,
    "net_item_flag" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "job_rfq_budget_mappings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "job_catalog_list_items" (
    "id" TEXT NOT NULL,
    "list_type" "JobCatalogListType" NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "job_catalog_list_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "job_approval_workflows_workflow_id_key" ON "job_approval_workflows"("workflow_id");
CREATE INDEX "job_approval_workflows_template_id_idx" ON "job_approval_workflows"("template_id");
CREATE UNIQUE INDEX "job_dynamic_templates_template_id_key" ON "job_dynamic_templates"("template_id");
CREATE INDEX "job_dynamic_templates_template_category_idx" ON "job_dynamic_templates"("template_category");
CREATE INDEX "job_dynamic_templates_measurement_set_id_idx" ON "job_dynamic_templates"("measurement_set_id");
CREATE INDEX "job_dynamic_templates_checklist_id_idx" ON "job_dynamic_templates"("checklist_id");
CREATE INDEX "job_dynamic_templates_approval_workflow_id_idx" ON "job_dynamic_templates"("approval_workflow_id");
CREATE INDEX "job_dynamic_templates_active_flag_idx" ON "job_dynamic_templates"("active_flag");
CREATE UNIQUE INDEX "master_job_library_job_id_key" ON "master_job_library"("job_id");
CREATE UNIQUE INDEX "master_job_library_job_library_node_id_key" ON "master_job_library"("job_library_node_id");
CREATE INDEX "master_job_library_department_idx" ON "master_job_library"("department");
CREATE INDEX "master_job_library_workshop_idx" ON "master_job_library"("workshop");
CREATE INDEX "master_job_library_template_id_idx" ON "master_job_library"("template_id");
CREATE INDEX "master_job_library_measurement_set_id_idx" ON "master_job_library"("measurement_set_id");
CREATE INDEX "master_job_library_inspection_checklist_id_idx" ON "master_job_library"("inspection_checklist_id");
CREATE INDEX "master_job_library_scope_of_work_id_idx" ON "master_job_library"("scope_of_work_id");
CREATE INDEX "master_job_library_active_flag_idx" ON "master_job_library"("active_flag");
CREATE UNIQUE INDEX "job_measurements_measurement_id_key" ON "job_measurements"("measurement_id");
CREATE INDEX "job_measurements_measurement_set_id_idx" ON "job_measurements"("measurement_set_id");
CREATE INDEX "job_measurements_template_id_idx" ON "job_measurements"("template_id");
CREATE UNIQUE INDEX "job_checklist_items_checklist_item_id_key" ON "job_checklist_items"("checklist_item_id");
CREATE INDEX "job_checklist_items_checklist_id_idx" ON "job_checklist_items"("checklist_id");
CREATE INDEX "job_checklist_items_template_id_sequence_no_idx" ON "job_checklist_items"("template_id", "sequence_no");
CREATE UNIQUE INDEX "job_scope_steps_scope_step_id_key" ON "job_scope_steps"("scope_step_id");
CREATE INDEX "job_scope_steps_scope_of_work_id_idx" ON "job_scope_steps"("scope_of_work_id");
CREATE INDEX "job_scope_steps_template_id_sequence_no_idx" ON "job_scope_steps"("template_id", "sequence_no");
CREATE UNIQUE INDEX "job_attachment_requirements_attachment_requirement_id_key" ON "job_attachment_requirements"("attachment_requirement_id");
CREATE INDEX "job_attachment_requirements_template_id_idx" ON "job_attachment_requirements"("template_id");
CREATE UNIQUE INDEX "job_spare_mappings_spare_map_id_key" ON "job_spare_mappings"("spare_map_id");
CREATE INDEX "job_spare_mappings_job_id_idx" ON "job_spare_mappings"("job_id");
CREATE INDEX "job_spare_mappings_template_id_idx" ON "job_spare_mappings"("template_id");
CREATE UNIQUE INDEX "job_rfq_budget_mappings_mapping_id_key" ON "job_rfq_budget_mappings"("mapping_id");
CREATE INDEX "job_rfq_budget_mappings_job_id_idx" ON "job_rfq_budget_mappings"("job_id");
CREATE UNIQUE INDEX "job_catalog_list_items_list_type_value_key" ON "job_catalog_list_items"("list_type", "value");
CREATE INDEX "job_catalog_list_items_list_type_sort_order_idx" ON "job_catalog_list_items"("list_type", "sort_order");
CREATE INDEX "job_catalog_list_items_is_active_idx" ON "job_catalog_list_items"("is_active");

ALTER TABLE "job_dynamic_templates" ADD CONSTRAINT "job_dynamic_templates_approval_workflow_id_fkey" FOREIGN KEY ("approval_workflow_id") REFERENCES "job_approval_workflows"("workflow_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "master_job_library" ADD CONSTRAINT "master_job_library_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "job_dynamic_templates"("template_id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "master_job_library" ADD CONSTRAINT "master_job_library_job_library_node_id_fkey" FOREIGN KEY ("job_library_node_id") REFERENCES "job_library_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "job_measurements" ADD CONSTRAINT "job_measurements_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "job_dynamic_templates"("template_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "job_checklist_items" ADD CONSTRAINT "job_checklist_items_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "job_dynamic_templates"("template_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "job_scope_steps" ADD CONSTRAINT "job_scope_steps_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "job_dynamic_templates"("template_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "job_attachment_requirements" ADD CONSTRAINT "job_attachment_requirements_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "job_dynamic_templates"("template_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "job_spare_mappings" ADD CONSTRAINT "job_spare_mappings_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "master_job_library"("job_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "job_spare_mappings" ADD CONSTRAINT "job_spare_mappings_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "job_dynamic_templates"("template_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "job_rfq_budget_mappings" ADD CONSTRAINT "job_rfq_budget_mappings_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "master_job_library"("job_id") ON DELETE CASCADE ON UPDATE CASCADE;
