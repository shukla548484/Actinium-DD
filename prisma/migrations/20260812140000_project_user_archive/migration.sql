-- AlterTable
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP(3);
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "archived_by_user_id" TEXT;

-- AlterTable
ALTER TABLE "dry_dock_projects" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP(3);
ALTER TABLE "dry_dock_projects" ADD COLUMN IF NOT EXISTS "archived_by_user_id" TEXT;

-- Backfill: DryDock projects already in archived status
UPDATE "dry_dock_projects"
SET "archived_at" = COALESCE("updated_at", NOW())
WHERE "status" = 'archived' AND "archived_at" IS NULL AND "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "projects_archived_at_idx" ON "projects"("archived_at");
CREATE INDEX IF NOT EXISTS "dry_dock_projects_archived_at_idx" ON "dry_dock_projects"("archived_at");
