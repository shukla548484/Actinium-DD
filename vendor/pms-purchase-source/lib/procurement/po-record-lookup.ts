/** PO rows that block issuing a new purchase order for the same quote + requisition. */
export const BLOCKING_PO_STATUSES = ["ACTIVE"] as const;

/**
 * Quote lookup used by confirmed-quotes / deep-links.
 * Create/reject paths must additionally purge CANCELLED rows synchronously —
 * ACTIVE-only is not enough if reject leaves a CANCELLED ghost before purge.
 */
export function activePurchaseOrderWhere(quoteId: string, requisitionId: string) {
  return {
    quoteId,
    requisitionId,
    status: { in: [...BLOCKING_PO_STATUSES] },
  };
}

export function quoteHasBlockingPurchaseOrder(
  purchaseOrders: Array<{ quoteId: string | null; status: string }>,
  quoteId: string
): boolean {
  return purchaseOrders.some(
    (po) => po.quoteId === quoteId && BLOCKING_PO_STATUSES.includes(po.status as (typeof BLOCKING_PO_STATUSES)[number])
  );
}
