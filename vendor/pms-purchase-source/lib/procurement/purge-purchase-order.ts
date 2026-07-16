import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  recordPurchaseHistory,
  PurchaseHistoryActionType,
} from "@/lib/services/purchase-history.service";
import { PurchaseOrderWorkflowStatus } from "@/lib/types/purchase-order-workflow";
import { reconcileRequisitionAfterPoRemoval } from "@/lib/procurement/reconcile-requisition-after-po-removal";

export class PurchaseOrderPurgeBlockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PurchaseOrderPurgeBlockedError";
  }
}

type PurgePurchaseOrderParams = {
  purchaseOrderId: string;
  performedById: string;
  reason: string;
  /** When true, allows removing rows already marked cancelled (cleanup). */
  allowAlreadyCancelled?: boolean;
  /** When true (default), restore requisition to QUOTE_APPROVED if no PO remains. */
  reconcileRequisition?: boolean;
};

type PoPurgeSnapshot = {
  id: string;
  poNumber: string;
  requisitionId: string;
  quoteId: string;
  status: string;
  workflowStatus: string | null;
  totalAmount: Prisma.Decimal | null;
  currency: string;
};

async function loadPoForPurge(purchaseOrderId: string): Promise<
  | (PoPurgeSnapshot & {
      _count: {
        invoices: number;
        inventoryTransactions: number;
        creditNotes: number;
        childFreightOrders: number;
      };
      childFreightOrders: Array<{ id: string }>;
    })
  | null
> {
  return prisma.purchaseOrder.findUnique({
    where: { id: purchaseOrderId },
    select: {
      id: true,
      poNumber: true,
      requisitionId: true,
      quoteId: true,
      status: true,
      workflowStatus: true,
      totalAmount: true,
      currency: true,
      childFreightOrders: { select: { id: true } },
      _count: {
        select: {
          invoices: true,
          inventoryTransactions: true,
          creditNotes: true,
          childFreightOrders: true,
        },
      },
    },
  });
}

function assertPoCanBePurged(
  po: NonNullable<Awaited<ReturnType<typeof loadPoForPurge>>>,
  allowAlreadyCancelled: boolean
): void {
  const workflow = po.workflowStatus ?? PurchaseOrderWorkflowStatus.PO_CREATED;

  if (workflow === PurchaseOrderWorkflowStatus.PO_SENT) {
    throw new PurchaseOrderPurgeBlockedError(
      "Purchase orders that have been sent to the vendor cannot be removed from the database"
    );
  }

  if (
    !allowAlreadyCancelled &&
    (po.status === "CANCELLED" || workflow === PurchaseOrderWorkflowStatus.CANCELLED)
  ) {
    throw new PurchaseOrderPurgeBlockedError("Purchase order is already cancelled");
  }

  if (po._count.invoices > 0) {
    throw new PurchaseOrderPurgeBlockedError(
      "Purchase order has linked invoices and cannot be removed"
    );
  }

  if (po._count.inventoryTransactions > 0) {
    throw new PurchaseOrderPurgeBlockedError(
      "Purchase order has inventory transactions and cannot be removed"
    );
  }
}

async function purgePoNotifications(poId: string): Promise<void> {
  const dedupePrefix = `po:${poId}:%`;
  await prisma.$executeRaw`
    DELETE FROM operation_notifications
    WHERE operation IN (
      'PO_APPROVAL_PENDING',
      'PO_READY_TO_SEND',
      'APPROVE_PURCHASE_ORDER',
      'CREATE_PURCHASE_ORDER'
    )
      AND (
        metadata->>'poId' = ${poId}
        OR metadata->>'dedupeKey' LIKE ${dedupePrefix}
      )
  `;
  await prisma.$executeRaw`
    DELETE FROM notifications
    WHERE metadata->>'poId' = ${poId}
       OR metadata->>'dedupeKey' LIKE ${dedupePrefix}
  `;
}

async function detachFreightDeclarations(poId: string): Promise<void> {
  await prisma.freightDeclaration.updateMany({
    where: { freightPurchaseOrderId: poId },
    data: { freightPurchaseOrderId: null },
  });
}

async function recordPoPurgedOnRequisition(params: {
  requisitionId: string;
  performedById: string;
  poNumber: string;
  quoteId: string;
  previousStatus: string;
  previousWorkflowStatus: string | null;
  reason: string;
}): Promise<void> {
  await recordPurchaseHistory({
    requisitionId: params.requisitionId,
    actionType: PurchaseHistoryActionType.DELETED,
    performedById: params.performedById,
    actionDescription: `PO ${params.poNumber} removed from system`,
    previousStatus: params.previousStatus,
    newStatus: "REMOVED",
    newValue: {
      quoteId: params.quoteId,
      poNumber: params.poNumber,
      previousWorkflowStatus: params.previousWorkflowStatus,
    },
    comments: params.reason,
  });
}

/**
 * Hard-delete a purchase order that was cancelled / returned before vendor send.
 * Removes PO rows, child PO records, PO history, attachments, and related task notifications.
 * Does not delete requisitions, quotes, invoices, or inventory data.
 */
export async function purgePurchaseOrderRecord(
  params: PurgePurchaseOrderParams
): Promise<{ poNumber: string; requisitionId: string; quoteId: string }> {
  const po = await loadPoForPurge(params.purchaseOrderId);
  if (!po) {
    throw new PurchaseOrderPurgeBlockedError("Purchase order not found");
  }

  assertPoCanBePurged(po, Boolean(params.allowAlreadyCancelled));

  for (const child of po.childFreightOrders) {
    await purgePurchaseOrderRecord({
      purchaseOrderId: child.id,
      performedById: params.performedById,
      reason: params.reason,
      allowAlreadyCancelled: true,
    });
  }

  await recordPoPurgedOnRequisition({
    requisitionId: po.requisitionId,
    performedById: params.performedById,
    poNumber: po.poNumber,
    quoteId: po.quoteId,
    previousStatus: po.status,
    previousWorkflowStatus: po.workflowStatus,
    reason: params.reason,
  });

  await purgePoNotifications(po.id);
  await detachFreightDeclarations(po.id);

  await prisma.purchaseOrder.delete({
    where: { id: po.id },
  });

  if (params.reconcileRequisition !== false) {
    try {
      await reconcileRequisitionAfterPoRemoval({
        requisitionId: po.requisitionId,
        performedById: params.performedById,
        reason: params.reason,
      });
    } catch (reconcileErr) {
      console.error("Requisition reconcile after PO purge failed:", reconcileErr);
    }
  }

  return {
    poNumber: po.poNumber,
    requisitionId: po.requisitionId,
    quoteId: po.quoteId,
  };
}

/** Remove cancelled / unsent PO ghosts that block re-issuing from an approved quote. */
export async function purgeCancelledPurchaseOrdersForQuote(params: {
  quoteId: string;
  requisitionId?: string | null;
  performedById: string;
  reason: string;
}): Promise<string[]> {
  const rows = await prisma.purchaseOrder.findMany({
    where: {
      quoteId: params.quoteId,
      ...(params.requisitionId ? { requisitionId: params.requisitionId } : {}),
      OR: [
        { status: "CANCELLED" },
        { workflowStatus: PurchaseOrderWorkflowStatus.CANCELLED },
      ],
    },
    select: { id: true, workflowStatus: true, status: true },
  });

  const removed: string[] = [];
  for (const row of rows) {
    const workflow = row.workflowStatus ?? PurchaseOrderWorkflowStatus.PO_CREATED;
    if (workflow === PurchaseOrderWorkflowStatus.PO_SENT) continue;

    const result = await purgePurchaseOrderRecord({
      purchaseOrderId: row.id,
      performedById: params.performedById,
      reason: params.reason,
      allowAlreadyCancelled: true,
    });
    removed.push(result.poNumber);
  }
  return removed;
}
