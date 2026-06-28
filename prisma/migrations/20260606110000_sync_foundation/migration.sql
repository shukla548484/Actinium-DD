-- Sync foundation: origin tracking, changed_at columns, compare_snapshots, sync_tombstones
-- Aligns with docs/sync/ARCHITECTURE.md (Office ↔ VPS relay ↔ fleet Postgres)

-- SyncOriginNode enum (idempotent — project_categories may reference this type)
DO $$ BEGIN
    CREATE TYPE "SyncOriginNode" AS ENUM ('office', 'vps', 'ship', 'superintendent', 'yard');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- projects
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "vessel_id" TEXT;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "origin_node" "SyncOriginNode" NOT NULL DEFAULT 'office';
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "office_changed_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "relay_changed_at" TIMESTAMPTZ;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "projects_vessel_id_idx" ON "projects"("vessel_id");
CREATE INDEX IF NOT EXISTS "projects_office_changed_at_idx" ON "projects"("office_changed_at");
CREATE INDEX IF NOT EXISTS "projects_deleted_at_idx" ON "projects"("deleted_at");

-- spec_lines
ALTER TABLE "spec_lines" ADD COLUMN IF NOT EXISTS "origin_node" "SyncOriginNode" NOT NULL DEFAULT 'office';
ALTER TABLE "spec_lines" ADD COLUMN IF NOT EXISTS "office_changed_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "spec_lines" ADD COLUMN IF NOT EXISTS "relay_changed_at" TIMESTAMPTZ;
ALTER TABLE "spec_lines" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "spec_lines_office_changed_at_idx" ON "spec_lines"("office_changed_at");
CREATE INDEX IF NOT EXISTS "spec_lines_deleted_at_idx" ON "spec_lines"("deleted_at");

-- yard_invites
ALTER TABLE "yard_invites" ADD COLUMN IF NOT EXISTS "origin_node" "SyncOriginNode" NOT NULL DEFAULT 'office';
ALTER TABLE "yard_invites" ADD COLUMN IF NOT EXISTS "office_changed_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "yard_invites" ADD COLUMN IF NOT EXISTS "relay_changed_at" TIMESTAMPTZ;
ALTER TABLE "yard_invites" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ;
ALTER TABLE "yard_invites" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS "yard_invites_office_changed_at_idx" ON "yard_invites"("office_changed_at");
CREATE INDEX IF NOT EXISTS "yard_invites_deleted_at_idx" ON "yard_invites"("deleted_at");

-- quote_meta
ALTER TABLE "quote_meta" ADD COLUMN IF NOT EXISTS "origin_node" "SyncOriginNode" NOT NULL DEFAULT 'office';
ALTER TABLE "quote_meta" ADD COLUMN IF NOT EXISTS "office_changed_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "quote_meta" ADD COLUMN IF NOT EXISTS "relay_changed_at" TIMESTAMPTZ;
ALTER TABLE "quote_meta" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "quote_meta_office_changed_at_idx" ON "quote_meta"("office_changed_at");
CREATE INDEX IF NOT EXISTS "quote_meta_deleted_at_idx" ON "quote_meta"("deleted_at");

-- quote_lines
ALTER TABLE "quote_lines" ADD COLUMN IF NOT EXISTS "origin_node" "SyncOriginNode" NOT NULL DEFAULT 'office';
ALTER TABLE "quote_lines" ADD COLUMN IF NOT EXISTS "office_changed_at" TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE "quote_lines" ADD COLUMN IF NOT EXISTS "relay_changed_at" TIMESTAMPTZ;
ALTER TABLE "quote_lines" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "quote_lines_office_changed_at_idx" ON "quote_lines"("office_changed_at");
CREATE INDEX IF NOT EXISTS "quote_lines_deleted_at_idx" ON "quote_lines"("deleted_at");

-- compare_snapshots
CREATE TABLE IF NOT EXISTS "compare_snapshots" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "invite_id" TEXT,
    "vendor_name" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "origin_node" "SyncOriginNode" NOT NULL DEFAULT 'ship',
    "office_changed_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "relay_changed_at" TIMESTAMPTZ,
    "deleted_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "compare_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "compare_snapshots_project_id_idx" ON "compare_snapshots"("project_id");
CREATE INDEX IF NOT EXISTS "compare_snapshots_invite_id_idx" ON "compare_snapshots"("invite_id");
CREATE INDEX IF NOT EXISTS "compare_snapshots_office_changed_at_idx" ON "compare_snapshots"("office_changed_at");
CREATE INDEX IF NOT EXISTS "compare_snapshots_deleted_at_idx" ON "compare_snapshots"("deleted_at");

ALTER TABLE "compare_snapshots" DROP CONSTRAINT IF EXISTS "compare_snapshots_project_id_fkey";
ALTER TABLE "compare_snapshots" ADD CONSTRAINT "compare_snapshots_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "compare_snapshots" DROP CONSTRAINT IF EXISTS "compare_snapshots_invite_id_fkey";
ALTER TABLE "compare_snapshots" ADD CONSTRAINT "compare_snapshots_invite_id_fkey"
  FOREIGN KEY ("invite_id") REFERENCES "yard_invites"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- sync_tombstones
CREATE TABLE IF NOT EXISTS "sync_tombstones" (
    "id" TEXT NOT NULL,
    "table_name" TEXT NOT NULL,
    "record_id" TEXT NOT NULL,
    "business_key" TEXT,
    "metadata" JSONB,
    "source" TEXT,
    "vessel_id" TEXT,
    "origin_node" "SyncOriginNode" NOT NULL DEFAULT 'office',
    "deleted_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "reason" TEXT,

    CONSTRAINT "sync_tombstones_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "sync_tombstones_table_name_record_id_idx" ON "sync_tombstones"("table_name", "record_id");
CREATE INDEX IF NOT EXISTS "sync_tombstones_table_name_business_key_idx" ON "sync_tombstones"("table_name", "business_key");
CREATE INDEX IF NOT EXISTS "sync_tombstones_vessel_id_table_name_idx" ON "sync_tombstones"("vessel_id", "table_name");
CREATE INDEX IF NOT EXISTS "sync_tombstones_deleted_at_idx" ON "sync_tombstones"("deleted_at");

-- Backfill office_changed_at from updated_at where sensible
UPDATE "projects" SET "office_changed_at" = COALESCE("updated_at", NOW()) WHERE "office_changed_at" IS NULL;
UPDATE "yard_invites" SET "office_changed_at" = COALESCE("updated_at", "created_at", NOW()) WHERE "office_changed_at" IS NULL;
