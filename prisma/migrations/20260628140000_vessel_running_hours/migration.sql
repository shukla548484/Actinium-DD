-- AlterTable
ALTER TABLE "vessel_technical_profiles" ADD COLUMN "main_engine_running_hours" INTEGER;
ALTER TABLE "vessel_technical_profiles" ADD COLUMN "auxiliary_engine_running_hours" INTEGER;
ALTER TABLE "vessel_technical_profiles" ADD COLUMN "boiler_running_hours" INTEGER;
ALTER TABLE "vessel_technical_profiles" ADD COLUMN "running_hours_updated_at" TIMESTAMP(3);
ALTER TABLE "vessel_technical_profiles" ADD COLUMN "running_hours_updated_by" TEXT;
