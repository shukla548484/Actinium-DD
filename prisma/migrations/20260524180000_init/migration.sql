-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('draft', 'tendering', 'comparing', 'closed');

-- CreateEnum
CREATE TYPE "YardInviteStatus" AS ENUM ('invited', 'in_progress', 'submitted', 'excel_imported');

-- CreateEnum
CREATE TYPE "QuoteSource" AS ENUM ('portal', 'excel');

-- CreateEnum
CREATE TYPE "PricingStatus" AS ENUM ('priced', 'included', 'na', 'owner_supply');

-- CreateEnum
CREATE TYPE "MatchMethod" AS ENUM ('portal', 'excel_auto', 'excel_manual', 'owner');

-- CreateEnum
CREATE TYPE "ScopeLocale" AS ENUM ('en', 'zh', 'ja');

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vessel_name" TEXT,
    "reference_code" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "shipyard_days" INTEGER,
    "dry_dock_days" INTEGER,
    "cpr_days" INTEGER,
    "status" "ProjectStatus" NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "scope_locales" "ScopeLocale"[] DEFAULT ARRAY['en', 'zh', 'ja']::"ScopeLocale"[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spec_lines" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "line_code" TEXT,
    "description_en" TEXT NOT NULL,
    "description_zh" TEXT,
    "description_ja" TEXT,
    "unit" TEXT,
    "default_qty" DOUBLE PRECISION,
    "calc_rule" TEXT NOT NULL,
    "calc_params" JSONB NOT NULL DEFAULT '{}',
    "service_def_id" TEXT,
    "is_optional" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "spec_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "yard_invites" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "yard_name" TEXT NOT NULL,
    "contact_email" TEXT,
    "token" TEXT NOT NULL,
    "source_type" "QuoteSource" NOT NULL DEFAULT 'portal',
    "status" "YardInviteStatus" NOT NULL DEFAULT 'invited',
    "preferred_locale" "ScopeLocale" NOT NULL DEFAULT 'en',
    "submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "yard_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_meta" (
    "invite_id" TEXT NOT NULL,
    "currency" TEXT,
    "shipyard_days" INTEGER,
    "dry_dock_days" INTEGER,
    "cpr_days" INTEGER,
    "exchange_rate" DOUBLE PRECISION,
    "validity_days" INTEGER,
    "general_notes" TEXT,
    "excel_file_name" TEXT,

    CONSTRAINT "quote_meta_pkey" PRIMARY KEY ("invite_id")
);

-- CreateTable
CREATE TABLE "quote_lines" (
    "id" TEXT NOT NULL,
    "invite_id" TEXT NOT NULL,
    "spec_line_id" TEXT,
    "is_extra" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT NOT NULL,
    "unit" TEXT,
    "unit_rate" DOUBLE PRECISION,
    "quantity" DOUBLE PRECISION,
    "quoted_total" DOUBLE PRECISION,
    "calculated_total" DOUBLE PRECISION,
    "pricing_status" "PricingStatus" NOT NULL DEFAULT 'priced',
    "remarks" TEXT,
    "match_confidence" DOUBLE PRECISION,
    "match_method" "MatchMethod" NOT NULL DEFAULT 'portal',
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "quote_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "spec_lines_project_id_sort_order_idx" ON "spec_lines"("project_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "yard_invites_token_key" ON "yard_invites"("token");

-- CreateIndex
CREATE INDEX "yard_invites_project_id_idx" ON "yard_invites"("project_id");

-- CreateIndex
CREATE INDEX "quote_lines_invite_id_idx" ON "quote_lines"("invite_id");

-- AddForeignKey
ALTER TABLE "spec_lines" ADD CONSTRAINT "spec_lines_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yard_invites" ADD CONSTRAINT "yard_invites_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_meta" ADD CONSTRAINT "quote_meta_invite_id_fkey" FOREIGN KEY ("invite_id") REFERENCES "yard_invites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_invite_id_fkey" FOREIGN KEY ("invite_id") REFERENCES "yard_invites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quote_lines" ADD CONSTRAINT "quote_lines_spec_line_id_fkey" FOREIGN KEY ("spec_line_id") REFERENCES "spec_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

