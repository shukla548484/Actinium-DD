-- AlterTable
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "preferred_shipyards" TEXT[] DEFAULT ARRAY[]::TEXT[];
