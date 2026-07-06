-- Shipyard portal profile (Module 1): docks, facilities, cranes, capacity calendar

CREATE TABLE "yard_profiles" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "logo_url" TEXT,
    "country" TEXT,
    "port" TEXT,
    "address" TEXT,
    "website" TEXT,
    "established_year" INTEGER,
    "repair_berths" INTEGER,
    "total_employees" INTEGER,
    "dock_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "yard_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "yard_docks" (
    "id" TEXT NOT NULL,
    "yard_profile_id" TEXT NOT NULL,
    "dock_no" TEXT NOT NULL,
    "dock_type" TEXT NOT NULL,
    "max_loa_m" DOUBLE PRECISION,
    "max_beam_m" DOUBLE PRECISION,
    "max_draft_m" DOUBLE PRECISION,
    "lifting_capacity_t" DOUBLE PRECISION,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "yard_docks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "yard_facilities" (
    "id" TEXT NOT NULL,
    "yard_profile_id" TEXT NOT NULL,
    "facility_type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capabilities" TEXT,
    "equipment_json" JSONB,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "yard_facilities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "yard_cranes" (
    "id" TEXT NOT NULL,
    "yard_profile_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity_t" DOUBLE PRECISION,
    "radius_m" DOUBLE PRECISION,
    "location" TEXT,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "certification_expiry" TIMESTAMP(3),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "yard_cranes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "yard_capacity_slots" (
    "id" TEXT NOT NULL,
    "yard_profile_id" TEXT NOT NULL,
    "dock_id" TEXT,
    "slot_label" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "occupancy_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "yard_capacity_slots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "yard_profiles_company_id_key" ON "yard_profiles"("company_id");
CREATE INDEX "yard_docks_yard_profile_id_idx" ON "yard_docks"("yard_profile_id");
CREATE UNIQUE INDEX "yard_docks_yard_profile_id_dock_no_key" ON "yard_docks"("yard_profile_id", "dock_no");
CREATE INDEX "yard_facilities_yard_profile_id_idx" ON "yard_facilities"("yard_profile_id");
CREATE INDEX "yard_cranes_yard_profile_id_idx" ON "yard_cranes"("yard_profile_id");
CREATE INDEX "yard_capacity_slots_yard_profile_id_year_month_idx" ON "yard_capacity_slots"("yard_profile_id", "year", "month");
CREATE UNIQUE INDEX "yard_capacity_slots_yard_profile_id_slot_label_year_month_key" ON "yard_capacity_slots"("yard_profile_id", "slot_label", "year", "month");

ALTER TABLE "yard_profiles" ADD CONSTRAINT "yard_profiles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "yard_docks" ADD CONSTRAINT "yard_docks_yard_profile_id_fkey" FOREIGN KEY ("yard_profile_id") REFERENCES "yard_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "yard_facilities" ADD CONSTRAINT "yard_facilities_yard_profile_id_fkey" FOREIGN KEY ("yard_profile_id") REFERENCES "yard_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "yard_cranes" ADD CONSTRAINT "yard_cranes_yard_profile_id_fkey" FOREIGN KEY ("yard_profile_id") REFERENCES "yard_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "yard_capacity_slots" ADD CONSTRAINT "yard_capacity_slots_yard_profile_id_fkey" FOREIGN KEY ("yard_profile_id") REFERENCES "yard_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "yard_capacity_slots" ADD CONSTRAINT "yard_capacity_slots_dock_id_fkey" FOREIGN KEY ("dock_id") REFERENCES "yard_docks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
