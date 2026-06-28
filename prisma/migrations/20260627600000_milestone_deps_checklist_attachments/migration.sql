-- Milestone dependencies + checklist file attachments
ALTER TABLE "dd_milestones"
  ADD COLUMN IF NOT EXISTS "depends_on_milestone_id" TEXT;

DO $$ BEGIN
  ALTER TABLE "dd_milestones"
    ADD CONSTRAINT "dd_milestones_depends_on_milestone_id_fkey"
    FOREIGN KEY ("depends_on_milestone_id") REFERENCES "dd_milestones"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "dd_milestones_depends_on_milestone_id_idx"
  ON "dd_milestones" ("depends_on_milestone_id");

CREATE TABLE IF NOT EXISTS "dd_checklist_attachments" (
  "id" TEXT NOT NULL,
  "checklist_item_id" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "file_url" TEXT NOT NULL,
  "mime_type" TEXT,
  "file_size" INTEGER,
  "caption" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "dd_checklist_attachments_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "dd_checklist_attachments"
    ADD CONSTRAINT "dd_checklist_attachments_checklist_item_id_fkey"
    FOREIGN KEY ("checklist_item_id") REFERENCES "dd_checklist_items"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "dd_checklist_attachments_checklist_item_id_idx"
  ON "dd_checklist_attachments" ("checklist_item_id");

-- Chain existing special-survey milestones by sort order when no dependency set
WITH ordered AS (
  SELECT
    id,
    dry_dock_project_id,
    sort_order,
    LAG(id) OVER (PARTITION BY dry_dock_project_id ORDER BY sort_order ASC) AS prev_id
  FROM "dd_milestones"
  WHERE "deleted_at" IS NULL
)
UPDATE "dd_milestones" m
SET "depends_on_milestone_id" = o.prev_id
FROM ordered o
WHERE m.id = o.id
  AND o.prev_id IS NOT NULL
  AND m."depends_on_milestone_id" IS NULL;
