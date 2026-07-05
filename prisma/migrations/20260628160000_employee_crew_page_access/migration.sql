-- CreateTable
CREATE TABLE "employee_crew_page_access" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "permission_key" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_crew_page_access_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employee_crew_page_access_employee_id_permission_key_key" ON "employee_crew_page_access"("employee_id", "permission_key");

-- CreateIndex
CREATE INDEX "employee_crew_page_access_employee_id_idx" ON "employee_crew_page_access"("employee_id");

-- AddForeignKey
ALTER TABLE "employee_crew_page_access" ADD CONSTRAINT "employee_crew_page_access_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
