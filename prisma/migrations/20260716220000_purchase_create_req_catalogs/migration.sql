-- AlterTable
ALTER TABLE "purchase_requisitions" ADD COLUMN IF NOT EXISTS "store_location_id" TEXT;
ALTER TABLE "purchase_requisitions" ADD COLUMN IF NOT EXISTS "machinery_asset_id" TEXT;
ALTER TABLE "purchase_requisitions" ADD COLUMN IF NOT EXISTS "spare_manual_machinery_name" TEXT;

-- AlterTable
ALTER TABLE "purchase_requisition_items" ADD COLUMN IF NOT EXISTS "machinery_asset_id" TEXT;

-- CreateTable
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

-- CreateTable
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

-- CreateTable
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

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "purchase_store_locations_vessel_id_code_key" ON "purchase_store_locations"("vessel_id", "code");
CREATE INDEX IF NOT EXISTS "purchase_store_locations_vessel_id_is_active_idx" ON "purchase_store_locations"("vessel_id", "is_active");
CREATE INDEX IF NOT EXISTS "purchase_store_locations_deleted_at_idx" ON "purchase_store_locations"("deleted_at");

CREATE UNIQUE INDEX IF NOT EXISTS "purchase_impa_codes_impa_code_key" ON "purchase_impa_codes"("impa_code");
CREATE INDEX IF NOT EXISTS "purchase_impa_codes_item_name_idx" ON "purchase_impa_codes"("item_name");
CREATE INDEX IF NOT EXISTS "purchase_impa_codes_is_active_idx" ON "purchase_impa_codes"("is_active");
CREATE INDEX IF NOT EXISTS "purchase_impa_codes_deleted_at_idx" ON "purchase_impa_codes"("deleted_at");

CREATE INDEX IF NOT EXISTS "purchase_requisition_item_attachments_requisition_item_id_idx" ON "purchase_requisition_item_attachments"("requisition_item_id");
CREATE INDEX IF NOT EXISTS "purchase_requisition_item_attachments_deleted_at_idx" ON "purchase_requisition_item_attachments"("deleted_at");

CREATE INDEX IF NOT EXISTS "purchase_requisitions_store_location_id_idx" ON "purchase_requisitions"("store_location_id");
CREATE INDEX IF NOT EXISTS "purchase_requisitions_machinery_asset_id_idx" ON "purchase_requisitions"("machinery_asset_id");
CREATE INDEX IF NOT EXISTS "purchase_requisition_items_machinery_asset_id_idx" ON "purchase_requisition_items"("machinery_asset_id");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "purchase_store_locations" ADD CONSTRAINT "purchase_store_locations_vessel_id_fkey" FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_store_location_id_fkey" FOREIGN KEY ("store_location_id") REFERENCES "purchase_store_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "purchase_requisitions" ADD CONSTRAINT "purchase_requisitions_machinery_asset_id_fkey" FOREIGN KEY ("machinery_asset_id") REFERENCES "vessel_machinery_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "purchase_requisition_items" ADD CONSTRAINT "purchase_requisition_items_machinery_asset_id_fkey" FOREIGN KEY ("machinery_asset_id") REFERENCES "vessel_machinery_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
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
