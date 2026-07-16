/**
 * Match a vendor quote line to a requisition line for bid comparison / split totals.
 * Uses stable row identity — never returns the first line with a similar name.
 */

import type { QuoteLineIdentity, RequisitionLineIdentity } from '@/lib/procurement/requisition-line-identity';

export type QuoteLineForMatch = QuoteLineIdentity & {
  unitPrice?: number | null;
  totalPrice?: number | null;
  remarks?: string | null;
  itemRemarks?: string | null;
};

export type RequisitionLineForMatch = RequisitionLineIdentity;

function normalizeName(name: string | null | undefined): string {
  return (name ?? '').toLowerCase().trim();
}

function normalizeCode(code: string | null | undefined): string {
  return (code ?? '').replace(/\s+/g, '').toLowerCase();
}

function lineCode(item: {
  impaNumber?: string | null;
  partNumber?: string | null;
  itemNumber?: string | null;
}): string {
  return normalizeCode(item.impaNumber ?? item.partNumber ?? item.itemNumber);
}

function countCodeInRequisition(code: string, requisitionItems: RequisitionLineForMatch[]): number {
  if (!code) return 0;
  return requisitionItems.filter((r) => lineCode(r) === code).length;
}

function countCodeInQuote(code: string, quoteLines: QuoteLineForMatch[]): number {
  if (!code) return 0;
  return quoteLines.filter((q) => lineCode(q) === code).length;
}

function findByLineNumber<T extends QuoteLineForMatch>(
  quoteLines: T[],
  lineNumber: number
): T | undefined {
  const byField = quoteLines.find((q) => q.lineNumber === lineNumber);
  if (byField) return byField;
  const byIndex = quoteLines[lineNumber - 1];
  return byIndex;
}

function findByUniqueCode<T extends QuoteLineForMatch>(
  quoteLines: T[],
  requisitionItem: RequisitionLineForMatch,
  requisitionItems: RequisitionLineForMatch[]
): T | undefined {
  const code = lineCode(requisitionItem);
  if (!code) return undefined;
  if (countCodeInRequisition(code, requisitionItems) !== 1) return undefined;
  if (countCodeInQuote(code, quoteLines) !== 1) return undefined;
  return quoteLines.find((q) => lineCode(q) === code);
}

function findAmongDuplicateNames<T extends QuoteLineForMatch>(
  quoteLines: T[],
  requisitionItem: RequisitionLineForMatch,
  requisitionItems: RequisitionLineForMatch[]
): T | undefined {
  const reqName = normalizeName(requisitionItem.itemName);
  const sameNameReqItems = requisitionItems.filter((r) => normalizeName(r.itemName) === reqName);
  const sameNameQuoteLines = quoteLines.filter((q) => normalizeName(q.itemName) === reqName);

  if (sameNameReqItems.length <= 1 && sameNameQuoteLines.length <= 1) {
    return sameNameQuoteLines[0];
  }

  const byQtyUnit = sameNameQuoteLines.find(
    (q) =>
      Number(q.quantity ?? 0) === Number(requisitionItem.quantity) &&
      normalizeName(q.unit) === normalizeName(requisitionItem.unit)
  );
  if (byQtyUnit) return byQtyUnit;

  const occurrence = sameNameReqItems.findIndex((r) => r.id === requisitionItem.id);
  if (occurrence >= 0 && occurrence < sameNameQuoteLines.length) {
    return sameNameQuoteLines[occurrence];
  }

  return undefined;
}

export function matchQuoteLineToRequisitionItem<T extends QuoteLineForMatch>(
  quoteLines: T[],
  requisitionItem: RequisitionLineForMatch,
  requisitionItems: RequisitionLineForMatch[]
): T | undefined {
  if (!quoteLines.length) return undefined;

  const byReqId = quoteLines.find((q) => q.requisitionItemId === requisitionItem.id);
  if (byReqId) return byReqId;

  if (requisitionItem.lineNumber > 0) {
    const byLine = findByLineNumber(quoteLines, requisitionItem.lineNumber);
    if (byLine) return byLine;
  } else {
    const reqIdx = requisitionItems.findIndex((r) => r.id === requisitionItem.id);
    if (reqIdx >= 0) {
      const byLine = findByLineNumber(quoteLines, reqIdx + 1);
      if (byLine) return byLine;
    }
  }

  const byUniqueCode = findByUniqueCode(quoteLines, requisitionItem, requisitionItems);
  if (byUniqueCode) return byUniqueCode;

  return findAmongDuplicateNames(quoteLines, requisitionItem, requisitionItems);
}

/** Factory for quote-comparison-metrics matchItem callbacks. */
export function createQuoteRequisitionItemMatcher(requisitionItems: RequisitionLineForMatch[]) {
  return <T extends QuoteLineForMatch>(quote: { items: T[] }, reqItem: RequisitionLineForMatch) =>
    matchQuoteLineToRequisitionItem(quote.items, reqItem, requisitionItems);
}

export function toRequisitionLineForMatch(
  item: {
    id: string;
    itemName: string;
    impaNumber?: string | null;
    itemNumber?: string | null;
    partNumber?: string | null;
    quantity: number;
    unit: string;
  },
  lineNumber: number
): RequisitionLineForMatch {
  return {
    id: item.id,
    lineNumber,
    itemName: item.itemName,
    impaNumber: item.impaNumber,
    itemNumber: item.itemNumber,
    partNumber: item.partNumber,
    quantity: item.quantity,
    unit: item.unit,
  };
}
