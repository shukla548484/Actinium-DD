/**
 * Stable identity for requisition ↔ vendor quote line matching.
 *
 * Hierarchy (never use "first name match"):
 * 1. requisitionItemId (UUID link persisted at quote import)
 * 2. lineNumber (S.No. / row position within the requisition)
 * 3. Unique IMPA / part / item number within the requisition
 * 4. Same lineNumber occurrence among duplicate descriptions (qty + unit)
 */

export type RequisitionLineIdentity = {
  id: string;
  lineNumber: number;
  itemName: string;
  impaNumber?: string | null;
  itemNumber?: string | null;
  partNumber?: string | null;
  quantity: number;
  unit: string;
};

export type QuoteLineIdentity = {
  id?: string;
  requisitionItemId?: string | null;
  lineNumber?: number | null;
  itemName: string;
  impaNumber?: string | null;
  partNumber?: string | null;
  quantity?: number | null;
  unit?: string | null;
};

export function assignRequisitionLineNumbers<T extends { id: string }>(
  items: T[]
): Array<T & { lineNumber: number }> {
  return items.map((item, index) => ({ ...item, lineNumber: index + 1 }));
}

export function getRequisitionLineNumber(
  requisitionItemId: string,
  requisitionItems: Array<{ id: string }>
): number {
  const idx = requisitionItems.findIndex((r) => r.id === requisitionItemId);
  return idx >= 0 ? idx + 1 : 0;
}

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

function countCodeMatches(code: string, items: Array<{ impaNumber?: string | null; partNumber?: string | null; itemNumber?: string | null }>): number {
  if (!code) return 0;
  return items.filter((i) => lineCode(i) === code).length;
}

/** Resolve requisition item id when persisting vendor quote lines from Excel (import time). */
export function resolveRequisitionItemIdForQuoteLine(
  quoteLine: QuoteLineIdentity,
  requisitionItems: RequisitionLineIdentity[]
): string | null {
  if (quoteLine.requisitionItemId) {
    const exists = requisitionItems.some((r) => r.id === quoteLine.requisitionItemId);
    if (exists) return quoteLine.requisitionItemId;
  }

  if (quoteLine.lineNumber != null && quoteLine.lineNumber > 0) {
    const byLine = requisitionItems.find((r) => r.lineNumber === quoteLine.lineNumber);
    if (byLine) return byLine.id;
    const byIndex = requisitionItems[quoteLine.lineNumber - 1];
    if (byIndex) return byIndex.id;
  }

  const code = lineCode(quoteLine);
  if (code && countCodeMatches(code, requisitionItems) === 1) {
    const match = requisitionItems.find((r) => lineCode(r) === code);
    if (match) return match.id;
  }

  return null;
}
