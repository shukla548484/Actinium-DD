-- Add a permanent, human-readable tracking number to every daily report.

ALTER TABLE "dd_daily_reports"
  ADD COLUMN IF NOT EXISTS "report_number" TEXT;

WITH numbered_reports AS (
  SELECT
    report."id",
    'DPR-' ||
      UPPER(
        REGEXP_REPLACE(
          COALESCE(
            NULLIF(TRIM(project."reference_code"), ''),
            SUBSTRING(report."dry_dock_project_id", 1, 8)
          ),
          '[^A-Za-z0-9]+',
          '-',
          'g'
        )
      ) ||
      '-' ||
      LPAD(
        ROW_NUMBER() OVER (
          PARTITION BY report."dry_dock_project_id"
          ORDER BY report."report_date", report."created_at", report."id"
        )::TEXT,
        4,
        '0'
      ) AS generated_number
  FROM "dd_daily_reports" report
  JOIN "dry_dock_projects" project
    ON project."id" = report."dry_dock_project_id"
)
UPDATE "dd_daily_reports" report
SET "report_number" = numbered_reports.generated_number
FROM numbered_reports
WHERE report."id" = numbered_reports."id"
  AND report."report_number" IS NULL;

ALTER TABLE "dd_daily_reports"
  ALTER COLUMN "report_number" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "dd_daily_reports_report_number_key"
  ON "dd_daily_reports"("report_number");
