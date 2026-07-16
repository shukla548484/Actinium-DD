type ReqItemRef = {
  id: string;
  partNumber?: string | null;
  itemName: string;
};

type QuoteItemRef = {
  id: string;
  requisitionItemId?: string | null;
  partNumber?: string | null;
  itemName: string;
  quantity: { toString(): string } | number;
  unit: string;
  unitPrice?: { toString(): string } | number | null;
  totalPrice?: { toString(): string } | number | null;
};

export function matchQuoteItemForRequisitionItem<
  R extends ReqItemRef,
  Q extends QuoteItemRef,
>(reqItem: R, quotedItems: Q[]): Q | null {
  const byRequisitionItemId = quotedItems.find(
    (q) => q.requisitionItemId && q.requisitionItemId === reqItem.id
  );
  if (byRequisitionItemId) return byRequisitionItemId;

  if (reqItem.partNumber) {
    const byPart = quotedItems.find(
      (q) => q.partNumber && q.partNumber === reqItem.partNumber
    );
    if (byPart) return byPart;
  }

  return quotedItems.find((q) => q.itemName === reqItem.itemName) ?? null;
}

export function toQuantityNumber(
  value: { toString(): string } | number | null | undefined
): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Tolerance for received vs ordered qty (matches API receipt-confirmation validation). */
export const RECEIPT_QTY_EPSILON = 0.0001;

/** Normalize user/API qty for display and compare (up to 3 decimal places). */
export function normalizeReceiptQuantity(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 1000) / 1000;
}

export function receiptQuantitiesEqual(
  receivedQuantity: number,
  orderedQuantity: number,
  epsilon: number = RECEIPT_QTY_EPSILON
): boolean {
  return (
    Math.abs(
      normalizeReceiptQuantity(receivedQuantity) -
        normalizeReceiptQuantity(orderedQuantity)
    ) <= epsilon
  );
}

/** Signed variance; 0 when quantities match within tolerance. */
export function receiptQuantityVariance(
  receivedQuantity: number,
  orderedQuantity: number,
  epsilon: number = RECEIPT_QTY_EPSILON
): number {
  if (receiptQuantitiesEqual(receivedQuantity, orderedQuantity, epsilon)) {
    return 0;
  }
  return normalizeReceiptQuantity(receivedQuantity - orderedQuantity);
}

export function orderedQuantityFromQuoteItem(
  quoteItem: Pick<QuoteItemRef, "quantity"> | null | undefined
): number | null {
  if (!quoteItem) return null;
  return toQuantityNumber(quoteItem.quantity);
}

export type ReceiptLineStatus =
  | "RECEIVED"
  | "NOT_RECEIVED"
  | "RETURNED"
  | "INCORRECT"
  | "QUANTITY_MISMATCH"
  | "OTHER_ISSUE";

export function resolveReceiptLineStatus(
  status: ReceiptLineStatus,
  receivedQuantity: number,
  orderedQuantity: number
): ReceiptLineStatus {
  if (status !== "RECEIVED") return status;
  if (!receiptQuantitiesEqual(receivedQuantity, orderedQuantity)) {
    return "QUANTITY_MISMATCH";
  }
  return "RECEIVED";
}

export function computeOverallReceiptStatus(
  items: Array<{
    status: ReceiptLineStatus;
    receivedQuantity: number;
    orderedQuantity: number;
  }>
): "FULLY_RECEIVED" | "PARTIALLY_RECEIVED" | "NOT_RECEIVED" {
  if (items.length === 0) return "NOT_RECEIVED";

  const allNotReceived = items.every(
    (item) =>
      item.status === "NOT_RECEIVED" ||
      (item.receivedQuantity === 0 && item.status !== "RECEIVED")
  );
  if (allNotReceived) return "NOT_RECEIVED";

  const allFullyReceived = items.every(
    (item) =>
      receiptQuantitiesEqual(item.receivedQuantity, item.orderedQuantity) &&
      (item.status === "RECEIVED" || item.status === "QUANTITY_MISMATCH")
  );
  if (allFullyReceived) return "FULLY_RECEIVED";

  return "PARTIALLY_RECEIVED";
}

export function hasReceiptQuantityVariance(
  items: Array<{ receivedQuantity: number; orderedQuantity: number }>
): boolean {
  return items.some(
    (item) => !receiptQuantitiesEqual(item.receivedQuantity, item.orderedQuantity)
  );
}
