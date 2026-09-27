-- Link daily report photos to a work-done point (client-generated id in sectionsJson).

ALTER TABLE "dd_daily_report_attachments" ADD COLUMN IF NOT EXISTS "point_id" TEXT;

CREATE INDEX IF NOT EXISTS "dd_daily_report_attachments_daily_report_id_point_id_idx"
  ON "dd_daily_report_attachments"("daily_report_id", "point_id");
