import type { Prisma } from '@prisma/client';
import {
  assignRequisitionLineNumbers,
  resolveRequisitionItemIdForQuoteLine,
  type RequisitionLineIdentity,
} from '@/lib/procurement/requisition-line-identity';

export function extractPartNumberFromDescription(description: string | null | undefined): string | null {
  if (!description) return null;
  const impaMatch = description.match(/\(IMPA:\s*([^)]+)\)/i);
  if (impaMatch?.[1]) return impaMatch[1].trim();
  const partMatch = description.match(/\(Part:\s*([^)]+)\)/i);
  if (partMatch?.[1]) return partMatch[1].trim();
  return null;
}

export async function loadRequisitionLineIdentities(
  tx: Prisma.TransactionClient,
  requisitionId: string
): Promise<RequisitionLineIdentity[]> {
  const items = await tx.requisitionItem.findMany({
    where: { requisitionId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      itemName: true,
      impaNumber: true,
      itemNumber: true,
      partNumber: true,
      quantity: true,
      unit: true,
    },
  });

  return assignRequisitionLineNumbers(
    items.map((item) => ({
      id: item.id,
      itemName: item.itemName,
      impaNumber: item.impaNumber,
      itemNumber: item.itemNumber,
      partNumber: item.partNumber,
      quantity: Number(item.quantity),
      unit: item.unit,
    }))
  );
}

export function resolveQuoteLineLinks(
  quoteLine: {
    lineNumber?: number | null;
    itemName: string;
    partNumber?: string | null;
    description?: string | null;
    requisitionItemId?: string | null;
  },
  requisitionLines: RequisitionLineIdentity[]
): { requisitionItemId: string | null; partNumber: string | null } {
  const partNumber =
    quoteLine.partNumber?.trim() ||
    extractPartNumberFromDescription(quoteLine.description) ||
    null;

  const requisitionItemId = resolveRequisitionItemIdForQuoteLine(
    {
      requisitionItemId: quoteLine.requisitionItemId,
      lineNumber: quoteLine.lineNumber,
      itemName: quoteLine.itemName,
      partNumber,
    },
    requisitionLines
  );

  return { requisitionItemId, partNumber };
}
