import { writeAuditLog } from "@/lib/db/audit";
import { prisma } from "@/lib/prisma";
import { requiredApprovalLevel } from "@/lib/rbac/approvalLevel";
import { notDeleted } from "@/lib/superintendent/helpers";

type PurchaseOrderRow = {
  id: string;
  dryDockProjectId: string;
  poNumber: string | null;
  supplier: string | null;
  description: string | null;
  amount: number;
  status: string;
};

export async function syncPurchaseOrderApproval(po: PurchaseOrderRow) {
  if (po.status !== "issued") return null;

  const minLevel = requiredApprovalLevel("purchase_order", po.amount);
  const referenceKey = `purchase_order:${po.id}`;

  const existing = await prisma.ddApprovalRequest.findFirst({
    where: {
      dryDockProjectId: po.dryDockProjectId,
      approvalType: referenceKey,
      ...notDeleted,
    },
  });
  if (existing) return existing;

  const approval = await prisma.ddApprovalRequest.create({
    data: {
      dryDockProjectId: po.dryDockProjectId,
      approvalType: referenceKey,
      title: `PO ${po.poNumber ?? po.id.slice(0, 8)} — ${po.supplier ?? "Supplier TBC"}`,
      description: `${po.description ?? "Purchase order"} · Requires approval level A${minLevel} or higher.`,
      amount: po.amount,
      status: "pending",
      requestedBy: "Procurement",
    },
  });

  await writeAuditLog({
    action: "create",
    entityType: "dd_approval",
    entityId: approval.id,
    summary: `PO approval queued for ${po.poNumber ?? po.id.slice(0, 8)}`,
    metadata: { purchaseOrderId: po.id, amount: po.amount, minLevel },
  });

  return approval;
}

export async function resolvePurchaseOrderApproval(
  approvalType: string,
  status: "approved" | "rejected",
) {
  if (!approvalType.startsWith("purchase_order:")) return;
  const poId = approvalType.slice("purchase_order:".length);
  const po = await prisma.ddPurchaseOrder.findFirst({ where: { id: poId, ...notDeleted } });
  if (!po) return;

  if (status === "approved" && po.status === "issued") {
    await prisma.ddPurchaseOrder.update({
      where: { id: po.id },
      data: { status: "acknowledged" },
    });
    await writeAuditLog({
      action: "approve",
      entityType: "dd_purchase_order",
      entityId: po.id,
      summary: `PO ${po.poNumber ?? po.id.slice(0, 8)} approved`,
      metadata: { amount: po.amount },
    });
  } else if (status === "rejected" && po.status === "issued") {
    await prisma.ddPurchaseOrder.update({
      where: { id: po.id },
      data: { status: "draft", notes: "Returned to draft after approval rejection." },
    });
    await writeAuditLog({
      action: "reject",
      entityType: "dd_purchase_order",
      entityId: po.id,
      summary: `PO ${po.poNumber ?? po.id.slice(0, 8)} rejected`,
      metadata: { amount: po.amount },
    });
  }
}
