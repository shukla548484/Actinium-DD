-- SyncOriginNode enum (idempotent; also created in 20260606110000_sync_foundation)
DO $$ BEGIN
    CREATE TYPE "SyncOriginNode" AS ENUM ('office', 'vps', 'ship', 'superintendent', 'yard');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE "project_categories" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "category_no" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortcut" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "origin_node" "SyncOriginNode" NOT NULL DEFAULT 'office',
    "office_changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "relay_changed_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "project_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_categories_project_id_sort_order_idx" ON "project_categories"("project_id", "sort_order");

-- CreateIndex
CREATE INDEX "project_categories_office_changed_at_idx" ON "project_categories"("office_changed_at");

-- CreateIndex
CREATE INDEX "project_categories_deleted_at_idx" ON "project_categories"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "project_categories_project_id_slug_key" ON "project_categories"("project_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "project_categories_project_id_category_no_key" ON "project_categories"("project_id", "category_no");

-- CreateIndex
CREATE UNIQUE INDEX "project_categories_project_id_shortcut_key" ON "project_categories"("project_id", "shortcut");

-- AddForeignKey
ALTER TABLE "project_categories" ADD CONSTRAINT "project_categories_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
