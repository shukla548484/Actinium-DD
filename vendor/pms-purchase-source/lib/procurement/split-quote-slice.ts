/**
 * Split PO quote slicing: totals and line items for allocated requisition lines only.
 * Unallocated quote lines are zeroed so grand totals reflect selected items.
 */

import {
  calculateDiscount,
  calculateTotalWithUpdatedQty,
  type RequisitionItemForMetrics,
} from '@/lib/procurement/quote-comparison-metrics';

export type SplitQuoteLine = {
  id?: string;
  requisitionItemId?: string | null;
  itemName: string;
  quantity: number | null;
  unit?: string | null;
  unitPrice: number | null;
  totalPrice: number | null;
  remarks?: string | null;
  itemRemarks?: string | null;
};

export type SplitQuoteInput = {
  quotedItems: SplitQuoteLine[];
  additionalCharges?: number | null;
  deliveryCharges?: number | null;
  packingCharges?: number | null;
  totalAmount?: number | null;
  currency?: string | null;
};

export type ParentItemRef = {
  id: string;
  itemName: string;
  quantity: number;
  unit: string;
};

function normalizeName(name: string | null | undefined): string {
  return (name ?? '').toLowerCase().trim();
}

/** Resolve which quote lines belong to allocated parent requisition items. */
export function resolveAllocatedQuoteLines(
  quote: SplitQuoteInput,
  allocatedParentItemIds: string[],
  parentItems: ParentItemRef[]
): SplitQuoteLine[] {
  const allocatedSet = new Set(allocatedParentItemIds);
  const parentById = new Map(parentItems.map((i) => [i.id, i]));

  const byReqItemId = quote.quotedItems.filter(
    (qi) => qi.requisitionItemId && allocatedSet.has(qi.requisitionItemId)
  );

  if (byReqItemId.length > 0) {
    const allocatedQuoteLineIds = new Set(byReqItemId.map((q) => q.id).filter(Boolean));
    return quote.quotedItems.map((qi) => {
      if (qi.id && allocatedQuoteLineIds.has(qi.id)) return qi;
      if (qi.requisitionItemId && allocatedSet.has(qi.requisitionItemId)) return qi;
      return zeroQuoteLine(qi);
    });
  }

  const allocatedIndices = parentItems
    .map((ri, idx) => (allocatedSet.has(ri.id) ? idx : -1))
    .filter((i) => i >= 0);

  const allocatedByIndex = new Set(
    allocatedIndices.map((i) => quote.quotedItems[i]?.id ?? `idx:${i}`)
  );

  return quote.quotedItems.map((qi, idx) => {
    const key = qi.id ?? `idx:${idx}`;
    if (allocatedByIndex.has(key)) return qi;

    const parentItem = parentItems[idx];
    if (parentItem && allocatedSet.has(parentItem.id)) {
      if (normalizeName(qi.itemName) === normalizeName(parentItem.itemName)) return qi;
    }

    const matchedParent = [...allocatedSet]
      .map((id) => parentById.get(id))
      .find((p) => p && normalizeName(p.itemName) === normalizeName(qi.itemName));
    if (matchedParent) return qi;

    return zeroQuoteLine(qi);
  });
}

function zeroQuoteLine(line: SplitQuoteLine): SplitQuoteLine {
  return {
    ...line,
    quantity: 0,
    unitPrice: line.unitPrice != null ? 0 : line.unitPrice,
    totalPrice: 0,
  };
}

/** Grand total for one vendor allocation (selected lines + that vendor's charges). */
export function computeSplitAllocationTotal(
  quote: SplitQuoteInput,
  allocatedParentItemIds: string[],
  parentItems: ParentItemRef[],
  getUpdatedQuantity: (itemId: string, defaultQty: number) => number = (_id, qty) => qty
): number {
  const allocatedItems: RequisitionItemForMetrics[] = parentItems
    .filter((i) => allocatedParentItemIds.includes(i.id))
    .map((i) => ({
      id: i.id,
      itemName: i.itemName,
      quantity: i.quantity,
      unit: i.unit,
    }));

  if (allocatedItems.length === 0) return 0;

  const slicedLines = resolveAllocatedQuoteLines(quote, allocatedParentItemIds, parentItems);

  const matchItem = (_quote: unknown, reqItem: RequisitionItemForMetrics) => {
    const line = slicedLines.find(
      (qi) =>
        (qi.requisitionItemId && qi.requisitionItemId === reqItem.id) ||
        normalizeName(qi.itemName) === normalizeName(reqItem.itemName)
    );
    if (!line || Number(line.quantity ?? 0) === 0) return undefined;
    return {
      itemName: line.itemName,
      quantity: Number(line.quantity ?? reqItem.quantity),
      unitPrice: line.unitPrice != null ? Number(line.unitPrice) : null,
      totalPrice: line.totalPrice != null ? Number(line.totalPrice) : null,
    };
  };

  let subTotal = 0;
  let totalDiscount = 0;
  for (const item of allocatedItems) {
    const quoteItem = matchItem(null, item);
    if (!quoteItem?.unitPrice) continue;
    const uq = getUpdatedQuantity(item.id, item.quantity);
    subTotal += uq * quoteItem.unitPrice;
    const disc = calculateDiscount(quoteItem.totalPrice, quoteItem.quantity, quoteItem.unitPrice);
    if (disc > 0) {
      const orig = uq * quoteItem.unitPrice;
      const discounted = calculateTotalWithUpdatedQty(uq, quoteItem.unitPrice, disc);
      if (discounted != null) totalDiscount += orig - discounted;
    }
  }

  const additionalCharges = Number(quote.additionalCharges ?? 0);
  const deliveryCharges = Number(quote.deliveryCharges ?? 0);
  return subTotal - totalDiscount + additionalCharges + deliveryCharges;
}

/** Build a quote payload for PO PDF: all lines present, unselected lines zeroed. */
export function buildSplitQuoteSlice(
  quote: SplitQuoteInput,
  allocatedParentItemIds: string[],
  parentItems: ParentItemRef[]
): { quoteSlice: SplitQuoteInput; sliceTotal: number } {
  const quotedItems = resolveAllocatedQuoteLines(quote, allocatedParentItemIds, parentItems);
  const sliceTotal = computeSplitAllocationTotal(quote, allocatedParentItemIds, parentItems);
  return {
    quoteSlice: {
      ...quote,
      quotedItems,
      totalAmount: sliceTotal,
    },
    sliceTotal,
  };
}
