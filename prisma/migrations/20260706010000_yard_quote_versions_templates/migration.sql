-- General services catalog, cost templates, multi-version quotes per RFQ

CREATE TABLE "yard_general_service_items" (
    "id" TEXT NOT NULL,
    "yard_profile_id" TEXT NOT NULL,
    "line_code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "unit" TEXT,
    "default_qty" DOUBLE PRECISION,
    "default_labour_hours" DOUBLE PRECISION,
    "default_labour_rate" DOUBLE PRECISION,
    "default_material_cost" DOUBLE PRECISION,
    "default_equipment_cost" DOUBLE PRECISION,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "yard_general_service_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "yard_cost_templates" (
    "id" TEXT NOT NULL,
    "yard_profile_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "target_owner_label" TEXT,
    "description" TEXT,
    "margin_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "yard_cost_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "yard_cost_template_lines" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "general_service_item_id" TEXT,
    "line_code" TEXT,
    "description" TEXT NOT NULL,
    "unit" TEXT,
    "labour_hours" DOUBLE PRECISION,
    "labour_rate" DOUBLE PRECISION,
    "material_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "equipment_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subcontract_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "yard_cost_template_lines_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "yard_cost_estimates" DROP CONSTRAINT IF EXISTS "yard_cost_estimates_invite_id_key";
ALTER TABLE "yard_cost_estimates" ADD COLUMN IF NOT EXISTS "version_no" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "yard_cost_estimates" ADD COLUMN IF NOT EXISTS "version_label" TEXT;
ALTER TABLE "yard_cost_estimates" ADD COLUMN IF NOT EXISTS "template_id" TEXT;
ALTER TABLE "yard_cost_estimates" ADD COLUMN IF NOT EXISTS "is_selected_for_quote" BOOLEAN NOT NULL DEFAULT false;

UPDATE "yard_cost_estimates" SET "version_no" = 1, "version_label" = 'Quote v1' WHERE "version_label" IS NULL;
UPDATE "yard_cost_estimates" SET "is_selected_for_quote" = true WHERE "is_selected_for_quote" = false;

ALTER TABLE "yard_cost_estimate_lines" ADD COLUMN IF NOT EXISTS "general_service_item_id" TEXT;
ALTER TABLE "yard_cost_estimate_lines" ADD COLUMN IF NOT EXISTS "line_source" TEXT NOT NULL DEFAULT 'spec';

CREATE UNIQUE INDEX "yard_cost_estimates_invite_id_version_no_key" ON "yard_cost_estimates"("invite_id", "version_no");
CREATE INDEX "yard_cost_estimates_invite_id_idx" ON "yard_cost_estimates"("invite_id");
CREATE UNIQUE INDEX "yard_cost_estimate_lines_estimate_id_general_service_item_id_key" ON "yard_cost_estimate_lines"("estimate_id", "general_service_item_id");
CREATE UNIQUE INDEX "yard_general_service_items_yard_profile_id_line_code_key" ON "yard_general_service_items"("yard_profile_id", "line_code");
CREATE INDEX "yard_general_service_items_yard_profile_id_sort_order_idx" ON "yard_general_service_items"("yard_profile_id", "sort_order");
CREATE INDEX "yard_cost_templates_yard_profile_id_sort_order_idx" ON "yard_cost_templates"("yard_profile_id", "sort_order");
CREATE INDEX "yard_cost_template_lines_template_id_sort_order_idx" ON "yard_cost_template_lines"("template_id", "sort_order");

ALTER TABLE "yard_general_service_items" ADD CONSTRAINT "yard_general_service_items_yard_profile_id_fkey" FOREIGN KEY ("yard_profile_id") REFERENCES "yard_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "yard_cost_templates" ADD CONSTRAINT "yard_cost_templates_yard_profile_id_fkey" FOREIGN KEY ("yard_profile_id") REFERENCES "yard_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "yard_cost_template_lines" ADD CONSTRAINT "yard_cost_template_lines_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "yard_cost_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "yard_cost_template_lines" ADD CONSTRAINT "yard_cost_template_lines_general_service_item_id_fkey" FOREIGN KEY ("general_service_item_id") REFERENCES "yard_general_service_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "yard_cost_estimates" ADD CONSTRAINT "yard_cost_estimates_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "yard_cost_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "yard_cost_estimate_lines" ADD CONSTRAINT "yard_cost_estimate_lines_general_service_item_id_fkey" FOREIGN KEY ("general_service_item_id") REFERENCES "yard_general_service_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
