import prisma from "@/lib/prisma";
import {
  applyBudgetClassificationAtPoIssue,
  formatBudgetClassificationLabel,
} from "@/lib/procurement/requisition-budget-classification";
import {
  resolveEffectiveIsBudgeted,
} from "@/lib/purchase/po-budget-classification";
import {
  canApprovePoBudgetChange,
  canRequestPoBudgetChange,
} from "@/lib/purchase/po-budget-change-access";
import { isAdminEquivalentAccessLevel } from "@/lib/admin-access-level";
import {
  recordInvoiceHistory,
  InvoiceHistoryActionType,
} from "@/lib/services/invoice-history.service";

export type PoBudgetChangeListRow = {
  id: string;
  purchaseOrderId: string;
  poNumber: string;
  requisitionId: string;
  requisitionNumber: string;
  requisitionHeading: string;
  invoiceId: string | null;
  invoiceNumber: string | null;
  vessel: { id: string; name: string; code: string };
  currentIsBudgeted: boolean;
  requestedIsBudgeted: boolean;
  status: string;
  reason: string | null;
  requestedAt: string;
  requestedBy: { id: string; name: string };
  reviewedAt: string | null;
  reviewedBy: { id: string; name: string } | null;
  reviewComments: string | null;
};

function employeeDisplayName(employee: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
}): string {
  const name = [employee.firstName, employee.lastName].filter(Boolean).join(" ").trim();
  return name || employee.email || "User";
}

function mapRequestRow(
  row: Awaited<ReturnType<typeof loadBudgetChangeRequestInclude>>
): PoBudgetChangeListRow {
  const po = row.purchaseOrder;
  const req = row.requisition;
  return {
    id: row.id,
    purchaseOrderId: row.purchaseOrderId,
    poNumber: po.poNumber,
    requisitionId: row.requisitionId,
    requisitionNumber: req.requisitionNumber,
    requisitionHeading: req.heading,
    invoiceId: row.invoiceId,
    invoiceNumber: row.invoice?.invoiceNumber ?? null,
    vessel: {
      id: req.vessel.id,
      name: req.vessel.name,
      code: req.vessel.code,
    },
    currentIsBudgeted: row.currentIsBudgeted,
    requestedIsBudgeted: row.requestedIsBudgeted,
    status: row.status,
    reason: row.reason,
    requestedAt: row.requestedAt.toISOString(),
    requestedBy: {
      id: row.requestedBy.id,
      name: employeeDisplayName(row.requestedBy),
    },
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewedBy: row.reviewedBy
      ? { id: row.reviewedBy.id, name: employeeDisplayName(row.reviewedBy) }
      : null,
    reviewComments: row.reviewComments,
  };
}

const budgetChangeInclude = {
  purchaseOrder: { select: { id: true, poNumber: true } },
  requisition: {
    select: {
      id: true,
      requisitionNumber: true,
      heading: true,
      vessel: { select: { id: true, name: true, code: true, companyId: true } },
    },
  },
  invoice: { select: { id: true, invoiceNumber: true } },
  requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
  reviewedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
} as const;

async function loadBudgetChangeRequestInclude(id: string) {
  return prisma.poBudgetChangeRequest.findUniqueOrThrow({
    where: { id },
    include: budgetChangeInclude,
  });
}

export async function listPoBudgetChangeRequests(params: {
  accessLevel: number;
  userId: string;
  status?: string;
  purchaseOrderId?: string;
}): Promise<{
  requests: PoBudgetChangeListRow[];
  canRequest: boolean;
  canApprove: boolean;
}> {
  const canRequest = canRequestPoBudgetChange(params.accessLevel);
  const canApprove = canApprovePoBudgetChange(params.accessLevel);

  const where: {
    status?: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
    purchaseOrderId?: string;
  } = {};

  if (params.status && ["PENDING", "APPROVED", "REJECTED", "CANCELLED"].includes(params.status)) {
    where.status = params.status as "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  }
  if (params.purchaseOrderId) {
    where.purchaseOrderId = params.purchaseOrderId;
  }

  const rows = await prisma.poBudgetChangeRequest.findMany({
    where,
    include: budgetChangeInclude,
    orderBy: [{ status: "asc" }, { requestedAt: "desc" }],
    take: 200,
  });

  const requests = rows
    .filter((row) => {
      if (isAdminEquivalentAccessLevel(params.accessLevel)) return true;
      if (canApprove && row.status === "PENDING") return true;
      if (canRequest && row.requestedById === params.userId) return true;
      return false;
    })
    .map(mapRequestRow);

  return { requests, canRequest, canApprove };
}

export async function createPoBudgetChangeRequest(params: {
  purchaseOrderId: string;
  requestedIsBudgeted: boolean;
  reason?: string;
  requestedById: string;
  accessLevel: number;
}): Promise<PoBudgetChangeListRow> {
  if (!canRequestPoBudgetChange(params.accessLevel)) {
    throw new Error("You do not have permission to request PO budget reclassification");
  }

  const purchaseOrder = await prisma.purchaseOrder.findUnique({
    where: { id: params.purchaseOrderId },
    include: {
      requisition: { select: { id: true, isBudgeted: true } },
      invoices: {
        where: { status: { not: "CANCELLED" } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, invoiceNumber: true, status: true },
      },
    },
  });

  if (!purchaseOrder) {
    throw new Error("Purchase order not found");
  }

  const latestInvoice = purchaseOrder.invoices[0];
  if (!latestInvoice) {
    throw new Error("An invoice must be uploaded before requesting a budget classification change");
  }

  const currentEffective = resolveEffectiveIsBudgeted(
    purchaseOrder.isBudgeted,
    purchaseOrder.requisition.isBudgeted
  );
  const currentIsBudgeted = currentEffective === true;
  if (currentEffective == null) {
    throw new Error("Current budget classification is unset — contact purchasing to classify this PO first");
  }
  if (currentIsBudgeted === params.requestedIsBudgeted) {
    throw new Error(
      `PO is already classified as ${formatBudgetClassificationLabel(params.requestedIsBudgeted)}`
    );
  }

  const existingPending = await prisma.poBudgetChangeRequest.findFirst({
    where: { purchaseOrderId: params.purchaseOrderId, status: "PENDING" },
    select: { id: true },
  });
  if (existingPending) {
    throw new Error("A budget change request is already pending approval for this PO");
  }

  const created = await prisma.poBudgetChangeRequest.create({
    data: {
      purchaseOrderId: purchaseOrder.id,
      requisitionId: purchaseOrder.requisitionId,
      invoiceId: latestInvoice.id,
      currentIsBudgeted,
      requestedIsBudgeted: params.requestedIsBudgeted,
      reason: params.reason?.trim() || null,
      requestedById: params.requestedById,
    },
    include: budgetChangeInclude,
  });

  return mapRequestRow(created);
}

export async function approvePoBudgetChangeRequest(params: {
  requestId: string;
  reviewedById: string;
  accessLevel: number;
  reviewComments?: string;
}): Promise<PoBudgetChangeListRow> {
  if (!canApprovePoBudgetChange(params.accessLevel)) {
    throw new Error("You do not have permission to approve PO budget reclassification");
  }

  const request = await prisma.poBudgetChangeRequest.findUnique({
    where: { id: params.requestId },
    include: budgetChangeInclude,
  });

  if (!request) {
    throw new Error("Budget change request not found");
  }
  if (request.status !== "PENDING") {
    throw new Error("This request is no longer pending approval");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.poBudgetChangeRequest.update({
      where: { id: params.requestId },
      data: {
        status: "APPROVED",
        reviewedById: params.reviewedById,
        reviewedAt: new Date(),
        reviewComments: params.reviewComments?.trim() || null,
      },
      include: budgetChangeInclude,
    });

    await applyBudgetClassificationAtPoIssue({
      requisitionId: row.requisitionId,
      purchaseOrderId: row.purchaseOrderId,
      isBudgeted: row.requestedIsBudgeted,
    });

    await tx.invoice.updateMany({
      where: {
        purchaseOrderId: row.purchaseOrderId,
        status: { notIn: ["CANCELLED", "PAID"] },
      },
      data: { isBudgeted: row.requestedIsBudgeted },
    });

    return row;
  });

  if (updated.invoiceId) {
    try {
      await recordInvoiceHistory({
        invoiceId: updated.invoiceId,
        actionType: InvoiceHistoryActionType.UPDATED,
        actionDescription: `Budget classification approved as ${formatBudgetClassificationLabel(updated.requestedIsBudgeted)}`,
        performedById: params.reviewedById,
        comments: params.reviewComments?.trim() || undefined,
      });
    } catch (historyError) {
      console.error("po-budget-change invoice history:", historyError);
    }
  }

  return mapRequestRow(updated);
}

export async function rejectPoBudgetChangeRequest(params: {
  requestId: string;
  reviewedById: string;
  accessLevel: number;
  reviewComments?: string;
}): Promise<PoBudgetChangeListRow> {
  if (!canApprovePoBudgetChange(params.accessLevel)) {
    throw new Error("You do not have permission to reject PO budget reclassification");
  }

  const request = await prisma.poBudgetChangeRequest.findUnique({
    where: { id: params.requestId },
  });
  if (!request) {
    throw new Error("Budget change request not found");
  }
  if (request.status !== "PENDING") {
    throw new Error("This request is no longer pending approval");
  }

  const updated = await prisma.poBudgetChangeRequest.update({
    where: { id: params.requestId },
    data: {
      status: "REJECTED",
      reviewedById: params.reviewedById,
      reviewedAt: new Date(),
      reviewComments: params.reviewComments?.trim() || null,
    },
    include: budgetChangeInclude,
  });

  return mapRequestRow(updated);
}

export async function getPendingBudgetChangeForPo(
  purchaseOrderId: string
): Promise<PoBudgetChangeListRow | null> {
  const row = await prisma.poBudgetChangeRequest.findFirst({
    where: { purchaseOrderId, status: "PENDING" },
    include: budgetChangeInclude,
  });
  return row ? mapRequestRow(row) : null;
}
