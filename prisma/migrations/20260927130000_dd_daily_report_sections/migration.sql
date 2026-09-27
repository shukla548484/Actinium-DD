-- Daily report redesign: sections JSON, weather, per-section attachments,
-- and soft-delete-aware uniqueness on (project, calendar day).

ALTER TABLE "dd_daily_reports" ADD COLUMN IF NOT EXISTS "sections_json" JSONB;
ALTER TABLE "dd_daily_reports" ADD COLUMN IF NOT EXISTS "weather_condition" TEXT;

CREATE TABLE IF NOT EXISTS "dd_daily_report_attachments" (
    "id" TEXT NOT NULL,
    "daily_report_id" TEXT NOT NULL,
    "section_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "mime_type" TEXT,
    "file_size" INTEGER,
    "caption" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dd_daily_report_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "dd_daily_report_attachments_daily_report_id_section_key_idx"
  ON "dd_daily_report_attachments"("daily_report_id", "section_key");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dd_daily_report_attachments_daily_report_id_fkey'
  ) THEN
    ALTER TABLE "dd_daily_report_attachments"
      ADD CONSTRAINT "dd_daily_report_attachments_daily_report_id_fkey"
      FOREIGN KEY ("daily_report_id") REFERENCES "dd_daily_reports"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- One active report per project + calendar day (soft-deleted rows may share the date).
CREATE UNIQUE INDEX IF NOT EXISTS "dd_daily_reports_project_date_active_key"
  ON "dd_daily_reports"("dry_dock_project_id", "report_date")
  WHERE "deleted_at" IS NULL;
