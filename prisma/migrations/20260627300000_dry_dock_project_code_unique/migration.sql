-- Backfill missing dry dock project IDs before adding unique constraint
WITH numbered AS (
  SELECT
    p.id,
    v.code AS vessel_code,
    ROW_NUMBER() OVER (PARTITION BY p.vessel_id ORDER BY p.created_at ASC, p.id ASC) AS rn
  FROM dry_dock_projects p
  INNER JOIN vessels v ON v.id = p.vessel_id
  WHERE p.reference_code IS NULL
    AND p.deleted_at IS NULL
)
UPDATE dry_dock_projects p
SET reference_code = n.vessel_code || '-DD-' || LPAD(n.rn::text, 4, '0')
FROM numbered n
WHERE p.id = n.id;

CREATE UNIQUE INDEX "dry_dock_projects_reference_code_key" ON "dry_dock_projects"("reference_code");
