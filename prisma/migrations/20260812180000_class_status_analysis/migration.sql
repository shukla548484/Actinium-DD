-- Class status report AI extraction + user confirmation (pre-dock).
ALTER TABLE "dd_checklist_items" ADD COLUMN IF NOT EXISTS "class_status_analysis" JSONB;
