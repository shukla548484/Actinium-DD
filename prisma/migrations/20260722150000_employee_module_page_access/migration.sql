-- Employee module + page assignments (exclusive access for office staff and ship crew)
CREATE TABLE IF NOT EXISTS "employee_module_assignments" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "module_code" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "employee_module_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "employee_module_assignments_employee_id_module_code_key"
  ON "employee_module_assignments"("employee_id", "module_code");

CREATE INDEX IF NOT EXISTS "employee_module_assignments_employee_id_idx"
  ON "employee_module_assignments"("employee_id");

ALTER TABLE "employee_module_assignments"
  DROP CONSTRAINT IF EXISTS "employee_module_assignments_employee_id_fkey";
ALTER TABLE "employee_module_assignments"
  ADD CONSTRAINT "employee_module_assignments_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "employee_module_pages" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "module_code" TEXT NOT NULL,
    "page_key" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "employee_module_pages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "employee_module_pages_employee_id_module_code_page_key_key"
  ON "employee_module_pages"("employee_id", "module_code", "page_key");

CREATE INDEX IF NOT EXISTS "employee_module_pages_employee_id_idx"
  ON "employee_module_pages"("employee_id");

CREATE INDEX IF NOT EXISTS "employee_module_pages_employee_id_module_code_idx"
  ON "employee_module_pages"("employee_id", "module_code");

ALTER TABLE "employee_module_pages"
  DROP CONSTRAINT IF EXISTS "employee_module_pages_employee_id_fkey";
ALTER TABLE "employee_module_pages"
  ADD CONSTRAINT "employee_module_pages_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
