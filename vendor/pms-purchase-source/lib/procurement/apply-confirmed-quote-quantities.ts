import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import {
  calculateDiscount,
  calculateTotalWithUpdatedQty,
} from '@/lib/procurement/quote-comparison-metrics';

export type ConfirmedQuantityInput = {
  requisitionItemId: string;
  quantity: number;
};

function normalizeName(name: string | null | undefined): string {
  return (name ?? '').toLowerCase().trim();
}

function findQuotedItemForRequisitionItem(
  quotedItems: Array<{
    id: string;
    requisitionItemId: string | null;
    itemName: string;
    quantity: unknown;
    unitPrice: unknown;
    totalPrice: unknown;
  }>,
  reqItem: { id: string; itemName: string },
  reqItemIndex: number
) {
  const byId = quotedItems.find((qi) => qi.requisitionItemId === reqItem.id);
  if (byId) return byId;

  const byName = quotedItems.find(
    (qi) => normalizeName(qi.itemName) === normalizeName(reqItem.itemName)
  );
  if (byName) return byName;

  return quotedItems[reqItemIndex] ?? null;
}

/**
 * Persist purchaser-confirmed quantities onto vendor quote line items and recalculate quote total.
 * Used at quote approval so PO PDFs and send flow reflect adjusted qty, not original requisition qty.
 */
export async function applyConfirmedQuoteQuantities(params: {
  quoteId: string;
  confirmedQuantities: ConfirmedQuantityInput[];
  /** When set (split PO), only these requisition lines are kept; other quote lines are zeroed. */
  allocatedRequisitionItemIds?: string[];
  tx?: Prisma.TransactionClient;
}): Promise<{ totalAmount: number }> {
  const db = params.tx ?? prisma;

  const quote = await db.vendorQuote.findUnique({
    where: { id: params.quoteId },
    include: {
      quotedItems: { orderBy: { createdAt: 'asc' } },
      requisition: { include: { items: { orderBy: { createdAt: 'asc' } } } },
    },
  });

  if (!quote) {
    throw new Error('Quote not found');
  }

  const qtyByItemId = new Map(
    params.confirmedQuantities.map((row) => [row.requisitionItemId, row.quantity])
  );

  const reqItems = quote.requisition.items;
  const allocatedSet = params.allocatedRequisitionItemIds
    ? new Set(params.allocatedRequisitionItemIds)
    : null;

  let lineTotalSum = 0;
  const updates: Promise<unknown>[] = [];

  reqItems.forEach((reqItem, index) => {
    if (allocatedSet && !allocatedSet.has(reqItem.id)) {
      return;
    }

    const confirmedQty = qtyByItemId.get(reqItem.id);
    if (confirmedQty === undefined) {
      return;
    }

    const quotedItem = findQuotedItemForRequisitionItem(quote.quotedItems, reqItem, index);
    if (!quotedItem) {
      return;
    }

    const originalQty = Number(quotedItem.quantity);
    const unitPrice = quotedItem.unitPrice != null ? Number(quotedItem.unitPrice) : null;
    const originalTotal = quotedItem.totalPrice != null ? Number(quotedItem.totalPrice) : null;
    const discount = calculateDiscount(originalTotal, originalQty, unitPrice);
    const newTotal = calculateTotalWithUpdatedQty(confirmedQty, unitPrice, discount) ?? 0;

    lineTotalSum += newTotal;

    updates.push(
      db.vendorQuoteItem.update({
        where: { id: quotedItem.id },
        data: {
          quantity: confirmedQty,
          totalPrice: newTotal,
        },
      })
    );
  });

  if (allocatedSet) {
    for (const quotedItem of quote.quotedItems) {
      const reqId = quotedItem.requisitionItemId;
      const belongsToAllocated =
        (reqId && allocatedSet.has(reqId)) ||
        reqItems.some(
          (ri) =>
            allocatedSet.has(ri.id) &&
            normalizeName(ri.itemName) === normalizeName(quotedItem.itemName)
        );

      if (!belongsToAllocated) {
        updates.push(
          db.vendorQuoteItem.update({
            where: { id: quotedItem.id },
            data: {
              quantity: 0,
              totalPrice: 0,
            },
          })
        );
      }
    }
  }

  await Promise.all(updates);

  const additionalCharges = Number(quote.additionalCharges ?? 0);
  const deliveryCharges = Number(quote.deliveryCharges ?? 0);
  const packingCharges = Number(quote.packingCharges ?? 0);
  const newQuoteTotal = lineTotalSum + additionalCharges + deliveryCharges + packingCharges;

  await db.vendorQuote.update({
    where: { id: params.quoteId },
    data: { totalAmount: newQuoteTotal },
  });

  return { totalAmount: newQuoteTotal };
}

export function parseConfirmedQuantities(
  raw: unknown,
  validRequisitionItemIds: Set<string>
): ConfirmedQuantityInput[] {
  if (!Array.isArray(raw)) return [];

  const parsed: ConfirmedQuantityInput[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const requisitionItemId = (row as { requisitionItemId?: unknown }).requisitionItemId;
    const quantity = (row as { quantity?: unknown }).quantity;
    if (typeof requisitionItemId !== 'string' || !validRequisitionItemIds.has(requisitionItemId)) {
      continue;
    }
    const qtyNum = Number(quantity);
    if (!Number.isFinite(qtyNum) || qtyNum < 0) continue;
    parsed.push({ requisitionItemId, quantity: qtyNum });
  }
  return parsed;
}
