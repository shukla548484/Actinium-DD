-- Baseline dates, shipyard sync, purchase orders, resource allocations
ALTER TABLE "dry_dock_projects"
  ADD COLUMN IF NOT EXISTS "baseline_locked_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "last_shipyard_sync_at" TIMESTAMP(3);

ALTER TABLE "dd_milestones"
  ADD COLUMN IF NOT EXISTS "baseline_date" TIMESTAMP(3);

UPDATE "dd_milestones"
SET "baseline_date" = "planned_date"
WHERE "baseline_date" IS NULL AND "planned_date" IS NOT NULL;

CREATE TYPE "DdPoStatus" AS ENUM ('draft', 'issued', 'acknowledged', 'in_transit', 'delivered', 'cancelled');
CREATE TYPE "DdResourceType" AS ENUM ('crane', 'scaffolding', 'worker_team', 'equipment', 'other');
CREATE TYPE "DdResourceStatus" AS ENUM ('planned', 'mobilized', 'active', 'demobilized');

CREATE TABLE IF NOT EXISTS "dd_purchase_orders" (
  "id" TEXT NOT NULL,
  "dry_dock_project_id" TEXT NOT NULL,
  "po_number" TEXT,
  "supplier" TEXT,
  "description" TEXT,
  "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "status" "DdPoStatus" NOT NULL DEFAULT 'draft',
  "ordered_date" TIMESTAMP(3),
  "expected_delivery" TIMESTAMP(3),
  "delivered_date" TIMESTAMP(3),
  "notes" TEXT,
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "dd_purchase_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "dd_resource_allocations" (
  "id" TEXT NOT NULL,
  "dry_dock_project_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "resource_type" "DdResourceType" NOT NULL DEFAULT 'other',
  "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "unit" TEXT,
  "status" "DdResourceStatus" NOT NULL DEFAULT 'planned',
  "start_date" TIMESTAMP(3),
  "end_date" TIMESTAMP(3),
  "notes" TEXT,
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "dd_resource_allocations_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "dd_purchase_orders"
    ADD CONSTRAINT "dd_purchase_orders_dry_dock_project_id_fkey"
    FOREIGN KEY ("dry_dock_project_id") REFERENCES "dry_dock_projects"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "dd_resource_allocations"
    ADD CONSTRAINT "dd_resource_allocations_dry_dock_project_id_fkey"
    FOREIGN KEY ("dry_dock_project_id") REFERENCES "dry_dock_projects"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "dd_purchase_orders_dry_dock_project_id_idx" ON "dd_purchase_orders" ("dry_dock_project_id");
CREATE INDEX IF NOT EXISTS "dd_resource_allocations_dry_dock_project_id_idx" ON "dd_resource_allocations" ("dry_dock_project_id");
