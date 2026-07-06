-- RFQ workflow fields on yard_invites + cost estimation tables

ALTER TABLE "yard_invites" ADD COLUMN "workflow_stage" TEXT;
ALTER TABLE "yard_invites" ADD COLUMN "due_date" TIMESTAMP(3);
ALTER TABLE "yard_invites" ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE "yard_invites" ADD COLUMN "assigned_estimator_id" TEXT;
ALTER TABLE "yard_invites" ADD COLUMN "yard_company_id" TEXT;

CREATE INDEX "yard_invites_workflow_stage_idx" ON "yard_invites"("workflow_stage");
CREATE INDEX "yard_invites_due_date_idx" ON "yard_invites"("due_date");
CREATE INDEX "yard_invites_assigned_estimator_id_idx" ON "yard_invites"("assigned_estimator_id");
CREATE INDEX "yard_invites_yard_company_id_idx" ON "yard_invites"("yard_company_id");

ALTER TABLE "yard_invites" ADD CONSTRAINT "yard_invites_assigned_estimator_id_fkey" FOREIGN KEY ("assigned_estimator_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "yard_invites" ADD CONSTRAINT "yard_invites_yard_company_id_fkey" FOREIGN KEY ("yard_company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "yard_invites" SET "workflow_stage" = 'received' WHERE "workflow_stage" IS NULL AND "status" = 'invited';
UPDATE "yard_invites" SET "workflow_stage" = 'review' WHERE "workflow_stage" IS NULL AND "status" = 'in_progress';
UPDATE "yard_invites" SET "workflow_stage" = 'submit_quotation' WHERE "workflow_stage" IS NULL AND "status" IN ('submitted', 'excel_imported');
UPDATE "yard_invites" SET "workflow_stage" = 'internal_approval' WHERE "workflow_stage" IS NULL AND "status" = 'shortlisted';
UPDATE "yard_invites" SET "workflow_stage" = 'award_received' WHERE "workflow_stage" IS NULL AND "status" = 'accepted';

CREATE TABLE "yard_cost_estimates" (
    "id" TEXT NOT NULL,
    "invite_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "margin_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_labour" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_material" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_equipment" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_subcontract" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grand_total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "yard_cost_estimates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "yard_cost_estimate_lines" (
    "id" TEXT NOT NULL,
    "estimate_id" TEXT NOT NULL,
    "spec_line_id" TEXT,
    "description" TEXT NOT NULL,
    "unit" TEXT,
    "quantity" DOUBLE PRECISION,
    "labour_hours" DOUBLE PRECISION,
    "labour_rate" DOUBLE PRECISION,
    "labour_total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "material_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "equipment_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subcontract_cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "line_total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "yard_cost_estimate_lines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "yard_cost_estimates_invite_id_key" ON "yard_cost_estimates"("invite_id");
CREATE INDEX "yard_cost_estimates_status_idx" ON "yard_cost_estimates"("status");
CREATE INDEX "yard_cost_estimate_lines_estimate_id_sort_order_idx" ON "yard_cost_estimate_lines"("estimate_id", "sort_order");
CREATE UNIQUE INDEX "yard_cost_estimate_lines_estimate_id_spec_line_id_key" ON "yard_cost_estimate_lines"("estimate_id", "spec_line_id");

ALTER TABLE "yard_cost_estimates" ADD CONSTRAINT "yard_cost_estimates_invite_id_fkey" FOREIGN KEY ("invite_id") REFERENCES "yard_invites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "yard_cost_estimate_lines" ADD CONSTRAINT "yard_cost_estimate_lines_estimate_id_fkey" FOREIGN KEY ("estimate_id") REFERENCES "yard_cost_estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "yard_cost_estimate_lines" ADD CONSTRAINT "yard_cost_estimate_lines_spec_line_id_fkey" FOREIGN KEY ("spec_line_id") REFERENCES "spec_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
