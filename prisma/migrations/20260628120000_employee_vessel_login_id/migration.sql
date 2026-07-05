-- AlterTable
ALTER TABLE "employees" ADD COLUMN "vessel_login_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "employees_vessel_login_id_key" ON "employees"("vessel_login_id");

-- Backfill: move existing vessel-pattern user login ids onto employees
UPDATE "employees" AS e
SET "vessel_login_id" = u."login_id"
FROM "users" AS u
WHERE e."user_id" = u."id"
  AND e."vessel_login_id" IS NULL
  AND u."login_id" IS NOT NULL
  AND u."login_id" <> e."employee_code";

UPDATE "users" AS u
SET "login_id" = e."employee_code"
FROM "employees" AS e
WHERE e."user_id" = u."id"
  AND e."vessel_login_id" IS NOT NULL
  AND u."login_id" = e."vessel_login_id";
