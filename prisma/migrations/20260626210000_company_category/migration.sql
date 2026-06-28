-- Company business category (shipyard, ship management, ship owner, other)

CREATE TYPE "CompanyCategory" AS ENUM ('shipyard', 'ship_management', 'ship_owner', 'other');

ALTER TABLE "companies" ADD COLUMN "category" "CompanyCategory";

UPDATE "companies" SET "category" = 'ship_owner' WHERE "is_shipowner" = true;
UPDATE "companies" SET "category" = 'other' WHERE "category" IS NULL;

ALTER TABLE "companies" ALTER COLUMN "category" SET NOT NULL;
ALTER TABLE "companies" ALTER COLUMN "category" SET DEFAULT 'other';

CREATE INDEX "companies_category_idx" ON "companies"("category");
