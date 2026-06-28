-- Company, Vessel, Employee management (PMS-aligned)

CREATE TYPE "EntityStatus" AS ENUM ('active', 'wait', 'inactive');
CREATE TYPE "CompanyType" AS ENUM ('MASTER', 'SUB');

CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CompanyType" NOT NULL DEFAULT 'MASTER',
    "status" "EntityStatus" NOT NULL DEFAULT 'wait',
    "parent_id" TEXT,
    "address" TEXT,
    "contact_person" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "is_shipowner" BOOLEAN NOT NULL DEFAULT false,
    "origin_node" "SyncOriginNode" NOT NULL DEFAULT 'office',
    "office_changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "relay_changed_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "companies_code_key" ON "companies"("code");
CREATE INDEX "companies_parent_id_idx" ON "companies"("parent_id");
CREATE INDEX "companies_status_idx" ON "companies"("status");
CREATE INDEX "companies_deleted_at_idx" ON "companies"("deleted_at");
CREATE INDEX "companies_office_changed_at_idx" ON "companies"("office_changed_at");

ALTER TABLE "companies" ADD CONSTRAINT "companies_parent_id_fkey"
    FOREIGN KEY ("parent_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "vessels" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imo_number" TEXT,
    "flag" TEXT,
    "vessel_type" TEXT,
    "call_sign" TEXT,
    "gross_tonnage" DOUBLE PRECISION,
    "year_built" INTEGER,
    "status" "EntityStatus" NOT NULL DEFAULT 'active',
    "origin_node" "SyncOriginNode" NOT NULL DEFAULT 'office',
    "office_changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "relay_changed_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vessels_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "vessels_imo_number_key" ON "vessels"("imo_number");
CREATE UNIQUE INDEX "vessels_company_id_code_key" ON "vessels"("company_id", "code");
CREATE INDEX "vessels_company_id_idx" ON "vessels"("company_id");
CREATE INDEX "vessels_status_idx" ON "vessels"("status");
CREATE INDEX "vessels_deleted_at_idx" ON "vessels"("deleted_at");
CREATE INDEX "vessels_office_changed_at_idx" ON "vessels"("office_changed_at");

ALTER TABLE "vessels" ADD CONSTRAINT "vessels_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "employee_code" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "designation" TEXT,
    "department" TEXT,
    "status" "EntityStatus" NOT NULL DEFAULT 'wait',
    "role_id" TEXT,
    "user_id" TEXT,
    "origin_node" "SyncOriginNode" NOT NULL DEFAULT 'office',
    "office_changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "relay_changed_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "employees_employee_code_key" ON "employees"("employee_code");
CREATE UNIQUE INDEX "employees_email_key" ON "employees"("email");
CREATE UNIQUE INDEX "employees_user_id_key" ON "employees"("user_id");
CREATE INDEX "employees_company_id_idx" ON "employees"("company_id");
CREATE INDEX "employees_status_idx" ON "employees"("status");
CREATE INDEX "employees_deleted_at_idx" ON "employees"("deleted_at");
CREATE INDEX "employees_office_changed_at_idx" ON "employees"("office_changed_at");

ALTER TABLE "employees" ADD CONSTRAINT "employees_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employees" ADD CONSTRAINT "employees_role_id_fkey"
    FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "employee_vessels" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "vessel_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_watch_keeper" BOOLEAN NOT NULL DEFAULT false,
    "sign_off_date" TIMESTAMP(3),

    CONSTRAINT "employee_vessels_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "employee_vessels_employee_id_vessel_id_key" ON "employee_vessels"("employee_id", "vessel_id");
CREATE INDEX "employee_vessels_vessel_id_idx" ON "employee_vessels"("vessel_id");

ALTER TABLE "employee_vessels" ADD CONSTRAINT "employee_vessels_employee_id_fkey"
    FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_vessels" ADD CONSTRAINT "employee_vessels_vessel_id_fkey"
    FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "projects" ADD COLUMN "company_id" TEXT;
CREATE INDEX "projects_company_id_idx" ON "projects"("company_id");
ALTER TABLE "projects" ADD CONSTRAINT "projects_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_vessel_id_fkey"
    FOREIGN KEY ("vessel_id") REFERENCES "vessels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
