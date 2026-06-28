-- CreateTable
CREATE TABLE "master_spec_lines" (
    "id" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "line_code" TEXT,
    "description_en" TEXT NOT NULL,
    "description_zh" TEXT,
    "description_ja" TEXT,
    "unit" TEXT,
    "default_qty" DOUBLE PRECISION,
    "scope_days" DOUBLE PRECISION,
    "scope_area_m2" DOUBLE PRECISION,
    "scope_notes" TEXT,
    "allow_discount" BOOLEAN NOT NULL DEFAULT true,
    "max_discount_pct" DOUBLE PRECISION,
    "reference_unit_rate" DOUBLE PRECISION,
    "calc_rule" TEXT NOT NULL,
    "calc_params" JSONB NOT NULL DEFAULT '{}',
    "service_def_id" TEXT,
    "is_optional" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_spec_lines_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "master_spec_lines_line_code_key" ON "master_spec_lines"("line_code");
CREATE INDEX "master_spec_lines_bucket_sort_order_idx" ON "master_spec_lines"("bucket", "sort_order");
CREATE INDEX "master_spec_lines_is_active_idx" ON "master_spec_lines"("is_active");
