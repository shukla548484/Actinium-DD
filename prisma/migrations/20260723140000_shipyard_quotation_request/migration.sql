-- CreateEnum
CREATE TYPE "ShipyardQuotationRequestStatus" AS ENUM ('draft', 'sent', 'in_progress', 'submitted', 'withdrawn');
CREATE TYPE "ShipyardQuotationInviteStatus" AS ENUM ('invited', 'opened', 'in_progress', 'submitted', 'declined');
CREATE TYPE "ShipyardDockCycle" AS ENUM ('first_special', 'second_special', 'third_special', 'intermediate', 'other');
CREATE TYPE "ShipyardQuoteJobCategory" AS ENUM ('deck', 'machinery', 'hull_walls_overboard', 'painting', 'other');
CREATE TYPE "ShipyardTariffGroup" AS ENUM (
  'steel_renewal',
  'pipeline_renewal',
  'pipeline_replacement',
  'pipeline_fabrication',
  'walls_overhauling',
  'paint_hull',
  'paint_cargo_holds',
  'paint_ballast_tanks',
  'paint_chain_anchor',
  'paint_other',
  'seam_renewal_welding',
  'other'
);

-- CreateTable
CREATE TABLE "shipyard_quotation_requests" (
    "id" TEXT NOT NULL,
    "reference_code" TEXT NOT NULL,
    "vessel_id" TEXT NOT NULL,
    "dry_dock_project_id" TEXT,
    "status" "ShipyardQuotationRequestStatus" NOT NULL DEFAULT 'draft',
    "dock_cycle" "ShipyardDockCycle" NOT NULL DEFAULT 'other',
    "planned_start" TIMESTAMP(3),
    "planned_end" TIMESTAMP(3),
    "dry_dock_days" INTEGER,
    "shipyard_days" INTEGER,
    "cpr_days" INTEGER,
    "due_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3),
    "notes" TEXT,
    "requested_by_name" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipyard_quotation_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shipyard_quotation_request_jobs" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "dd_vessel_job_id" TEXT,
    "quote_category" "ShipyardQuoteJobCategory" NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "job_code" TEXT,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "workshop" TEXT,
    "description" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipyard_quotation_request_jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shipyard_quotation_invites" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "yard_company_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" "ShipyardQuotationInviteStatus" NOT NULL DEFAULT 'invited',
    "contact_email" TEXT,
    "contact_name" TEXT,
    "opened_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipyard_quotation_invites_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shipyard_quotation_lines" (
    "id" TEXT NOT NULL,
    "request_job_id" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'ls',
    "unit_rate" DOUBLE PRECISION,
    "amount" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipyard_quotation_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shipyard_quotation_terms" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipyard_quotation_terms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shipyard_tariff_schedules" (
    "id" TEXT NOT NULL,
    "yard_company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipyard_tariff_schedules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shipyard_tariff_rates" (
    "id" TEXT NOT NULL,
    "schedule_id" TEXT NOT NULL,
    "group_key" "ShipyardTariffGroup" NOT NULL,
    "label" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'm2',
    "unit_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipyard_tariff_rates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shipyard_quotation_tariff_snapshots" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "schedule_id" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "rates_json" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipyard_quotation_tariff_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "shipyard_quotation_requests_reference_code_key" ON "shipyard_quotation_requests"("reference_code");
CREATE INDEX "shipyard_quotation_requests_vessel_id_idx" ON "shipyard_quotation_requests"("vessel_id");
CREATE INDEX "shipyard_quotation_requests_dry_dock_project_id_idx" ON "shipyard_quotation_requests"("dry_dock_project_id");
CREATE INDEX "shipyard_quotation_requests_status_idx" ON "shipyard_quotation_requests"("status");
CREATE INDEX "shipyard_quotation_requests_deleted_at_idx" ON "shipyard_quotation_requests"("deleted_at");

CREATE INDEX "shipyard_quotation_request_jobs_request_id_quote_category_so_idx" ON "shipyard_quotation_request_jobs"("request_id", "quote_category", "sort_order");
CREATE INDEX "shipyard_quotation_request_jobs_dd_vessel_job_id_idx" ON "shipyard_quotation_request_jobs"("dd_vessel_job_id");

CREATE UNIQUE INDEX "shipyard_quotation_invites_token_key" ON "shipyard_quotation_invites"("token");
CREATE UNIQUE INDEX "shipyard_quotation_invites_request_id_yard_company_id_key" ON "shipyard_quotation_invites"("request_id", "yard_company_id");
CREATE INDEX "shipyard_quotation_invites_yard_company_id_status_idx" ON "shipyard_quotation_invites"("yard_company_id", "status");
CREATE INDEX "shipyard_quotation_invites_token_idx" ON "shipyard_quotation_invites"("token");
CREATE INDEX "shipyard_quotation_invites_deleted_at_idx" ON "shipyard_quotation_invites"("deleted_at");

CREATE UNIQUE INDEX "shipyard_quotation_lines_request_job_id_key" ON "shipyard_quotation_lines"("request_job_id");
CREATE UNIQUE INDEX "shipyard_quotation_terms_request_id_key" ON "shipyard_quotation_terms"("request_id");

CREATE INDEX "shipyard_tariff_schedules_yard_company_id_idx" ON "shipyard_tariff_schedules"("yard_company_id");
CREATE INDEX "shipyard_tariff_schedules_deleted_at_idx" ON "shipyard_tariff_schedules"("deleted_at");
CREATE INDEX "shipyard_tariff_rates_schedule_id_group_key_sort_order_idx" ON "shipyard_tariff_rates"("schedule_id", "group_key", "sort_order");
CREATE UNIQUE INDEX "shipyard_quotation_tariff_snapshots_request_id_key" ON "shipyard_quotation_tariff_snapshots"("request_id");

ALTER TABLE "shipyard_quotation_requests" ADD CONSTRAINT "shipyard_quotation_requests_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shipyard_quotation_requests" ADD CONSTRAINT "shipyard_quotation_requests_dry_dock_project_id_fkey" FOREIGN KEY ("dry_dock_project_id") REFERENCES "dry_dock_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "shipyard_quotation_request_jobs" ADD CONSTRAINT "shipyard_quotation_request_jobs_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "shipyard_quotation_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shipyard_quotation_request_jobs" ADD CONSTRAINT "shipyard_quotation_request_jobs_dd_vessel_job_id_fkey" FOREIGN KEY ("dd_vessel_job_id") REFERENCES "dd_vessel_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "shipyard_quotation_invites" ADD CONSTRAINT "shipyard_quotation_invites_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "shipyard_quotation_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shipyard_quotation_invites" ADD CONSTRAINT "shipyard_quotation_invites_yard_company_id_fkey" FOREIGN KEY ("yard_company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shipyard_quotation_lines" ADD CONSTRAINT "shipyard_quotation_lines_request_job_id_fkey" FOREIGN KEY ("request_job_id") REFERENCES "shipyard_quotation_request_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shipyard_quotation_terms" ADD CONSTRAINT "shipyard_quotation_terms_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "shipyard_quotation_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shipyard_tariff_schedules" ADD CONSTRAINT "shipyard_tariff_schedules_yard_company_id_fkey" FOREIGN KEY ("yard_company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shipyard_tariff_rates" ADD CONSTRAINT "shipyard_tariff_rates_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "shipyard_tariff_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shipyard_quotation_tariff_snapshots" ADD CONSTRAINT "shipyard_quotation_tariff_snapshots_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "shipyard_quotation_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shipyard_quotation_tariff_snapshots" ADD CONSTRAINT "shipyard_quotation_tariff_snapshots_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "shipyard_tariff_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
