-- CreateEnum
CREATE TYPE "DdVesselJobAssignedParty" AS ENUM (
  'vessel_crew',
  'shipyard',
  'third_party_workshop',
  'makers_service_engineer',
  'class'
);

-- AlterTable
ALTER TABLE "dd_vessel_jobs"
  ADD COLUMN "assigned_party" "DdVesselJobAssignedParty",
  ADD COLUMN "assigned_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "dd_vessel_jobs_vessel_id_assigned_party_idx" ON "dd_vessel_jobs"("vessel_id", "assigned_party");
