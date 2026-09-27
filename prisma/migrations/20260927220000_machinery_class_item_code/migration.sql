-- Link vessel machinery assets to Class Status Report item codes (CSM / continuous survey codes).

ALTER TABLE "vessel_machinery_assets" ADD COLUMN "class_item_code" TEXT;

CREATE UNIQUE INDEX "vessel_machinery_assets_vessel_id_class_item_code_key"
  ON "vessel_machinery_assets"("vessel_id", "class_item_code");

CREATE INDEX "vessel_machinery_assets_vessel_id_class_item_code_idx"
  ON "vessel_machinery_assets"("vessel_id", "class_item_code");
