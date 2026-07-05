-- CreateEnum
CREATE TYPE "DdInvoiceStatus" AS ENUM ('draft', 'submitted', 'verified', 'approved', 'paid', 'rejected');

-- CreateTable
CREATE TABLE "dd_invoices" (
    "id" TEXT NOT NULL,
    "dry_dock_project_id" TEXT NOT NULL,
    "purchase_order_id" TEXT,
    "invoice_number" TEXT,
    "supplier" TEXT,
    "description" TEXT,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" "DdInvoiceStatus" NOT NULL DEFAULT 'draft',
    "invoice_date" TIMESTAMP(3),
    "due_date" TIMESTAMP(3),
    "verified_by" TEXT,
    "verified_at" TIMESTAMP(3),
    "notes" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dd_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "user_label" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "summary" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dd_invoices_dry_dock_project_id_idx" ON "dd_invoices"("dry_dock_project_id");
CREATE INDEX "dd_invoices_purchase_order_id_idx" ON "dd_invoices"("purchase_order_id");
CREATE INDEX "dd_invoices_status_idx" ON "dd_invoices"("status");
CREATE INDEX "dd_invoices_deleted_at_idx" ON "dd_invoices"("deleted_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "dd_invoices" ADD CONSTRAINT "dd_invoices_dry_dock_project_id_fkey" FOREIGN KEY ("dry_dock_project_id") REFERENCES "dry_dock_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "dd_invoices" ADD CONSTRAINT "dd_invoices_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "dd_purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
