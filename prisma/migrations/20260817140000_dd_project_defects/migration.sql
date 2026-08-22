-- Dry-dock project defects imported from Excel (no photos).
CREATE TABLE IF NOT EXISTS "dd_project_defects" (
    "id" TEXT NOT NULL,
    "dry_dock_project_id" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "defect_details" TEXT NOT NULL,
    "machinery_associated" TEXT,
    "requisition_number" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "imported_from_file" TEXT,
    "created_by_user_id" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "dd_project_defects_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "dd_project_defects_dry_dock_project_id_sort_order_idx"
  ON "dd_project_defects"("dry_dock_project_id", "sort_order");
CREATE INDEX IF NOT EXISTS "dd_project_defects_deleted_at_idx"
  ON "dd_project_defects"("deleted_at");

ALTER TABLE "dd_project_defects"
  ADD CONSTRAINT "dd_project_defects_dry_dock_project_id_fkey"
  FOREIGN KEY ("dry_dock_project_id") REFERENCES "dry_dock_projects"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
