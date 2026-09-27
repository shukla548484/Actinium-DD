-- Machinery register: identification number, units, location, nameplate photo, active flag

ALTER TABLE "vessel_machinery_assets" ADD COLUMN "identification_number" TEXT;
ALTER TABLE "vessel_machinery_assets" ADD COLUMN "units" TEXT;
ALTER TABLE "vessel_machinery_assets" ADD COLUMN "location" TEXT;
ALTER TABLE "vessel_machinery_assets" ADD COLUMN "nameplate_photo_url" TEXT;
ALTER TABLE "vessel_machinery_assets" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX "vessel_machinery_assets_vessel_id_identification_number_key"
  ON "vessel_machinery_assets"("vessel_id", "identification_number");

CREATE INDEX "vessel_machinery_assets_vessel_id_is_active_idx"
  ON "vessel_machinery_assets"("vessel_id", "is_active");
