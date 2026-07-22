-- Purchase module bootstrap + create-requisition catalogs.
-- Idempotent: safe on fresh DBs (creates tables) and on DBs that already have purchase_* via db push.

-- ── Enums ───────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "purchase_req_type" AS ENUM ('STR', 'SPR', 'GLY', 'PNT', 'REP', 'SER', 'CTM', 'PRO', 'BNK', 'LUB', 'FCL', 'OTR', 'CHE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "purchase_req_generation_status" AS ENUM ('SAVED_AS_DRAFT', 'CREATED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "purchase_req_status" AS ENUM (
    'NOT_READY', 'NEW_REQ', 'REQ_APPROVED', 'SENT_FOR_QUOTE', 'QUOTE_RECEIVED',
    'PARTIAL_QUOTE_RECEIVED', 'QUOTE_APPROVED', 'QUOTE_CONFIRMED_PO_SENT', 'SPLIT',
    'REQ_RECEIVED_DELIVERED', 'REQ_RETURNED', 'INVOICE_RECEIVED', 'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "purchase_quote_status" AS ENUM ('PENDING', 'SENT', 'RECEIVED', 'APPROVED', 'REJECTED', 'EXPIRED', 'DECLINED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "purchase_po_type" AS ENUM ('GOODS', 'FREIGHT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "purchase_po_workflow_status" AS ENUM (
    'PO_CREATED', 'PO_LVL1_APPROVAL', 'PO_LVL2_APPROVAL', 'PO_LVL3_APPROVAL',
    'PO_CONFIRMED', 'PO_SENT', 'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "purchase_po_completion_status" AS ENUM ('OPEN', 'PARTIALLY_CLOSED', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "purchase_invoice_status" AS ENUM (
    'READY_FOR_APPROVAL', 'LEVEL_ONE_APPROVED', 'LEVEL_TWO_APPROVED', 'LEVEL_THREE_APPROVED',
    'LEVEL_FOUR_APPROVED', 'READY_FOR_PAYMENT', 'RETURNED', 'PAID', 'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "purchase_invoice_approval_level" AS ENUM ('LEVEL_ONE', 'LEVEL_TWO', 'LEVEL_THREE', 'LEVEL_FOUR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Core tables ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "purchase_vendors" (
    "id" TEXT NOT NULL,
    "company_id" TEXT,
    "vendor_code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "primary_email" TEXT NOT NULL,
    "secondary_email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "country" TEXT NOT NULL,
    "city" TEXT,
    "contact_person" TEXT,
    "service_types" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "rating" INTEGER DEFAULT 0,
    "is_blacklisted" BOOLEAN NOT NULL DEFAULT false,
    "blacklist_reason" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "preferred_currency" TEXT NOT NULL DEFAULT 'USD',
    "verification_status" TEXT NOT NULL DEFAULT 'PENDING',
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "purchase_vendors_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "purchase_store_locations" (
    "id" TEXT NOT NULL,
    "vessel_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "purchase_store_locations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "purchase_impa_codes" (
    "id" TEXT NOT NULL,
    "impa_code" TEXT NOT NULL,
    "item_name" TEXT NOT NULL,
    "unit" TEXT,
    "category" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "purchase_impa_codes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "purchase_requisitions" (
    "id" TEXT NOT NULL,
    "requisition_number" TEXT NOT NULL,
    "manual_req_number" TEXT,
    "heading" TEXT NOT NULL,
    "description" TEXT,
    "port_of_supply" TEXT,
    "port_agent_details" TEXT,
    "requisition_type" "purchase_req_type" NOT NULL,
    "generation_status" "purchase_req_generation_status" NOT NULL DEFAULT 'SAVED_AS_DRAFT',
    "status" "purchase_req_status" NOT NULL DEFAULT 'NOT_READY',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "reason_for_requisition" TEXT,
    "requisition_purpose" TEXT DEFAULT 'ROUTINE_MAINTENANCE',
    "is_budgeted" BOOLEAN,
    "budget_code" TEXT,
    "gl_code" TEXT,
    "cost_center" TEXT,
    "sub_category_code" TEXT,
    "store_location_id" TEXT,
    "machinery_asset_id" TEXT,
    "spare_manual_machinery_name" TEXT,
    "vessel_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "return_comments" TEXT,
    "parent_requisition_id" TEXT,
    "split_index" INTEGER,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "purchase_requisitions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "purchase_requisition_items" (
    "id" TEXT NOT NULL,
    "requisition_id" TEXT NOT NULL,
    "item_name" TEXT NOT NULL,
    "description" TEXT,
    "part_number" TEXT,
    "drawing_number" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "remarks" TEXT,
    "machinery_asset_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "purchase_requisition_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "purchase_requisition_item_attachments" (
    "id" TEXT NOT NULL,
    "requisition_item_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT,
    "file_size" INTEGER,
    "file_url" TEXT NOT NULL,
    "uploaded_by_id" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "purchase_requisition_item_attachments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "purchase_quotes" (
    "id" TEXT NOT NULL,
    "requisition_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "quote_number" TEXT,
    "total_amount" DOUBLE PRECISION,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "valid_until" TIMESTAMP(3),
    "status" "purchase_quote_status" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "delivery_charges" DOUBLE PRECISION,
    "packing_charges" DOUBLE PRECISION,
    "additional_charges" DOUBLE PRECISION,
    "delivery_terms" TEXT,
    "payment_terms" TEXT,
    "sent_at" TIMESTAMP(3),
    "received_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "purchase_quotes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "purchase_quote_items" (
    "id" TEXT NOT NULL,
    "quote_id" TEXT NOT NULL,
    "requisition_item_id" TEXT,
    "item_name" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "unit_price" DOUBLE PRECISION,
    "total_price" DOUBLE PRECISION,
    "discount_percent" DOUBLE PRECISION,
    "delivery_time" TEXT,
    "remarks" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "purchase_quote_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "purchase_orders" (
    "id" TEXT NOT NULL,
    "po_number" TEXT NOT NULL,
    "requisition_id" TEXT NOT NULL,
    "quote_id" TEXT NOT NULL,
    "vessel_id" TEXT NOT NULL,
    "vessel_name" TEXT NOT NULL,
    "po_type" "purchase_po_type" NOT NULL DEFAULT 'GOODS',
    "status" "purchase_po_workflow_status" NOT NULL DEFAULT 'PO_CREATED',
    "completion_status" "purchase_po_completion_status" NOT NULL DEFAULT 'OPEN',
    "total_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "date_of_issue" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_budgeted" BOOLEAN,
    "budget_code" TEXT,
    "gl_code" TEXT,
    "cost_center" TEXT,
    "level_one_approved_at" TIMESTAMP(3),
    "level_one_approved_by_id" TEXT,
    "level_two_approved_at" TIMESTAMP(3),
    "level_two_approved_by_id" TEXT,
    "level_three_approved_at" TIMESTAMP(3),
    "level_three_approved_by_id" TEXT,
    "sent_at" TIMESTAMP(3),
    "notes" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "purchase_invoices" (
    "id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "requisition_id" TEXT NOT NULL,
    "purchase_order_id" TEXT,
    "quote_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "invoice_date" TIMESTAMP(3) NOT NULL,
    "invoice_amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "quote_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "difference_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "purchase_invoice_status" NOT NULL DEFAULT 'READY_FOR_APPROVAL',
    "current_approval_level" "purchase_invoice_approval_level",
    "is_budgeted" BOOLEAN,
    "invoice_file_url" TEXT,
    "paid_at" TIMESTAMP(3),
    "paid_amount" DOUBLE PRECISION,
    "payment_reference" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "purchase_invoices_pkey" PRIMARY KEY ("id")
);

-- ── Columns for DBs that already had older purchase_* tables ────────────────
ALTER TABLE "purchase_requisitions" ADD COLUMN IF NOT EXISTS "port_agent_details" TEXT;
ALTER TABLE "purchase_requisitions" ADD COLUMN IF NOT EXISTS "store_location_id" TEXT;
ALTER TABLE "purchase_requisitions" ADD COLUMN IF NOT EXISTS "machinery_asset_id" TEXT;
ALTER TABLE "purchase_requisitions" ADD COLUMN IF NOT EXISTS "spare_manual_machinery_name" TEXT;
ALTER TABLE "purchase_requisition_items" ADD COLUMN IF NOT EXISTS "machinery_asset_id" TEXT;

-- ── Unique + indexes ────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS "purchase_vendors_vendor_code_key" ON "purchase_vendors"("vendor_code");
CREATE INDEX IF NOT EXISTS "purchase_vendors_company_id_idx" ON "purchase_vendors"("company_id");
CREATE INDEX IF NOT EXISTS "purchase_vendors_is_active_idx" ON "purchase_vendors"("is_active");
CREATE INDEX IF NOT EXISTS "purchase_vendors_deleted_at_idx" ON "purchase_vendors"("deleted_at");

CREATE UNIQUE INDEX IF NOT EXISTS "purchase_store_locations_vessel_id_code_key" ON "purchase_store_locations"("vessel_id", "code");
CREATE INDEX IF NOT EXISTS "purchase_store_locations_vessel_id_is_active_idx" ON "purchase_store_locations"("vessel_id", "is_active");
CREATE INDEX IF NOT EXISTS "purchase_store_locations_deleted_at_idx" ON "purchase_store_locations"("deleted_at");

CREATE UNIQUE INDEX IF NOT EXISTS "purchase_impa_codes_impa_code_key" ON "purchase_impa_codes"("impa_code");
CREATE INDEX IF NOT EXISTS "purchase_impa_codes_item_name_idx" ON "purchase_impa_codes"("item_name");
CREATE INDEX IF NOT EXISTS "purchase_impa_codes_is_active_idx" ON "purchase_impa_codes"("is_active");
CREATE INDEX IF NOT EXISTS "purchase_impa_codes_deleted_at_idx" ON "purchase_impa_codes"("deleted_at");

CREATE UNIQUE INDEX IF NOT EXISTS "purchase_requisitions_requisition_number_key" ON "purchase_requisitions"("requisition_number");
CREATE INDEX IF NOT EXISTS "purchase_requisitions_vessel_id_created_at_idx" ON "purchase_requisitions"("vessel_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "purchase_requisitions_vessel_id_status_created_at_idx" ON "purchase_requisitions"("vessel_id", "status", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "purchase_requisitions_status_created_at_idx" ON "purchase_requisitions"("status", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "purchase_requisitions_created_by_id_idx" ON "purchase_requisitions"("created_by_id");
CREATE INDEX IF NOT EXISTS "purchase_requisitions_store_location_id_idx" ON "purchase_requisitions"("store_location_id");
CREATE INDEX IF NOT EXISTS "purchase_requisitions_machinery_asset_id_idx" ON "purchase_requisitions"("machinery_asset_id");
CREATE INDEX IF NOT EXISTS "purchase_requisitions_deleted_at_idx" ON "purchase_requisitions"("deleted_at");

CREATE INDEX IF NOT EXISTS "purchase_requisition_items_requisition_id_sort_order_idx" ON "purchase_requisition_items"("requisition_id", "sort_order");
CREATE INDEX IF NOT EXISTS "purchase_requisition_items_machinery_asset_id_idx" ON "purchase_requisition_items"("machinery_asset_id");
CREATE INDEX IF NOT EXISTS "purchase_requisition_items_deleted_at_idx" ON "purchase_requisition_items"("deleted_at");

CREATE INDEX IF NOT EXISTS "purchase_requisition_item_attachments_requisition_item_id_idx" ON "purchase_requisition_item_attachments"("requisition_item_id");
CREATE INDEX IF NOT EXISTS "purchase_requisition_item_attachments_deleted_at_idx" ON "purchase_requisition_item_attachments"("deleted_at");

CREATE UNIQUE INDEX IF NOT EXISTS "purchase_quotes_requisition_id_vendor_id_key" ON "purchase_quotes"("requisition_id", "vendor_id");
CREATE INDEX IF NOT EXISTS "purchase_quotes_vendor_id_status_idx" ON "purchase_quotes"("vendor_id", "status");
CREATE INDEX IF NOT EXISTS "purchase_quotes_requisition_id_status_created_at_idx" ON "purchase_quotes"("requisition_id", "status", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "purchase_quotes_deleted_at_idx" ON "purchase_quotes"("deleted_at");

CREATE INDEX IF NOT EXISTS "purchase_quote_items_quote_id_idx" ON "purchase_quote_items"("quote_id");
CREATE INDEX IF NOT EXISTS "purchase_quote_items_requisition_item_id_idx" ON "purchase_quote_items"("requisition_item_id");

CREATE UNIQUE INDEX IF NOT EXISTS "purchase_orders_po_number_key" ON "purchase_orders"("po_number");
CREATE INDEX IF NOT EXISTS "purchase_orders_requisition_id_date_of_issue_idx" ON "purchase_orders"("requisition_id", "date_of_issue" DESC);
CREATE INDEX IF NOT EXISTS "purchase_orders_vessel_id_date_of_issue_idx" ON "purchase_orders"("vessel_id", "date_of_issue" DESC);
CREATE INDEX IF NOT EXISTS "purchase_orders_status_date_of_issue_idx" ON "purchase_orders"("status", "date_of_issue" DESC);
CREATE INDEX IF NOT EXISTS "purchase_orders_quote_id_idx" ON "purchase_orders"("quote_id");
CREATE INDEX IF NOT EXISTS "purchase_orders_deleted_at_idx" ON "purchase_orders"("deleted_at");

CREATE UNIQUE INDEX IF NOT EXISTS "purchase_invoices_invoice_number_key" ON "purchase_invoices"("invoice_number");
CREATE INDEX IF NOT EXISTS "purchase_invoices_requisition_id_idx" ON "purchase_invoices"("requisition_id");
CREATE INDEX IF NOT EXISTS "purchase_invoices_purchase_order_id_idx" ON "purchase_invoices"("purchase_order_id");
CREATE INDEX IF NOT EXISTS "purchase_invoices_vendor_id_idx" ON "purchase_invoices"("vendor_id");
CREATE INDEX IF NOT EXISTS "purchase_invoices_status_idx" ON "purchase_invoices"("status");
CREATE INDEX IF NOT EXISTS "purchase_invoices_invoice_date_idx" ON "purchase_invoices"("invoice_date");
CREATE INDEX IF NOT EXISTS "purchase_invoices_deleted_at_idx" ON "purchase_invoices"("deleted_at");

-- ── Foreign keys ────────────────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE "purchase_vendors" ADD CONSTRAINT "purchase_vendors_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "purchase_store_locations" ADD CONSTRAINT "purchase_store_locations_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_parent_requisition_id_fkey" FOREIGN KEY ("parent_requisition_id") REFERENCES "purchase_requisitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_store_location_id_fkey" FOREIGN KEY ("store_location_id") REFERENCES "purchase_store_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF to_regclass('public.vessel_machinery_assets') IS NOT NULL THEN
    ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_machinery_asset_id_fkey" FOREIGN KEY ("machinery_asset_id") REFERENCES "vessel_machinery_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "purchase_requisition_items" ADD CONSTRAINT "purchase_requisition_items_requisition_id_fkey" FOREIGN KEY ("requisition_id") REFERENCES "purchase_requisitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  IF to_regclass('public.vessel_machinery_assets') IS NOT NULL THEN
    ALTER TABLE "purchase_requisition_items" ADD CONSTRAINT "purchase_requisition_items_machinery_asset_id_fkey" FOREIGN KEY ("machinery_asset_id") REFERENCES "vessel_machinery_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "purchase_requisition_item_attachments" ADD CONSTRAINT "purchase_requisition_item_attachments_requisition_item_id_fkey" FOREIGN KEY ("requisition_item_id") REFERENCES "purchase_requisition_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "purchase_requisition_item_attachments" ADD CONSTRAINT "purchase_requisition_item_attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "purchase_quotes" ADD CONSTRAINT "purchase_quotes_requisition_id_fkey" FOREIGN KEY ("requisition_id") REFERENCES "purchase_requisitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "purchase_quotes" ADD CONSTRAINT "purchase_quotes_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "purchase_vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "purchase_quote_items" ADD CONSTRAINT "purchase_quote_items_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "purchase_quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "purchase_quote_items" ADD CONSTRAINT "purchase_quote_items_requisition_item_id_fkey" FOREIGN KEY ("requisition_item_id") REFERENCES "purchase_requisition_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_requisition_id_fkey" FOREIGN KEY ("requisition_id") REFERENCES "purchase_requisitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "purchase_quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_level_one_approved_by_id_fkey" FOREIGN KEY ("level_one_approved_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_level_two_approved_by_id_fkey" FOREIGN KEY ("level_two_approved_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_level_three_approved_by_id_fkey" FOREIGN KEY ("level_three_approved_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_requisition_id_fkey" FOREIGN KEY ("requisition_id") REFERENCES "purchase_requisitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "purchase_quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "purchase_vendors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
