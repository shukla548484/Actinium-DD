import "server-only";

import prisma from "@/lib/prisma";
import {
  CLARIFICATION_RESPONSE_DAYS,
  clarificationResponseDueAt,
} from "@/lib/procurement/clarification-escalation-dates";

export {
  CLARIFICATION_RESPONSE_DAYS,
  clarificationResponseDueAt,
  isClarificationOverdue,
} from "@/lib/procurement/clarification-escalation-dates";

/**
 * Notify purchaser when an OPEN clarification passes the response window.
 * Idempotent: one escalation notification per clarification.
 */
export async function processOpenClarificationEscalations(params?: {
  vesselId?: string;
  requisitionId?: string;
}) {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - CLARIFICATION_RESPONSE_DAYS);

  const openRows = await prisma.rfqClarificationRequest.findMany({
    where: {
      status: "OPEN",
      requestedAt: { lte: cutoff },
      ...(params?.vesselId ? { vesselId: params.vesselId } : {}),
      ...(params?.requisitionId ? { requisitionId: params.requisitionId } : {}),
    },
    include: {
      requisition: {
        select: {
          id: true,
          requisitionNumber: true,
          createdById: true,
          vessel: { select: { name: true } },
        },
      },
      requisitionItem: { select: { itemName: true } },
      vendor: { select: { name: true } },
    },
    take: 50,
  });

  let escalated = 0;

  for (const row of openRows) {
    const existing = await prisma.operationNotification.findFirst({
      where: {
        operation: "RFQ_CLARIFICATION_ESCALATED",
        entityType: "RfqClarification",
        entityId: row.id,
      },
      select: { id: true },
    });
    if (existing) continue;

    const purchaserIds = [row.requisition.createdById].filter(Boolean) as string[];
    if (!purchaserIds.length) continue;

    const due = clarificationResponseDueAt(row.requestedAt);
    const itemLabel = row.requisitionItem?.itemName ? ` (${row.requisitionItem.itemName})` : "";

    await prisma.operationNotification.createMany({
      data: purchaserIds.map((userId) => ({
        title: "RFQ clarification overdue",
        message: `${row.requisition.requisitionNumber}${itemLabel} on ${row.requisition.vessel.name}: vessel response was due ${due.toLocaleDateString()}. Vendor ${row.vendor.name} is waiting.`,
        type: "WARNING",
        operation: "RFQ_CLARIFICATION_ESCALATED",
        entityType: "RfqClarification",
        entityId: row.id,
        userId,
        isRead: false,
        metadata: {
          actionUrl: `/purchase/requisitions/${row.requisitionId}/clarifications/${row.id}?view=office`,
          requisitionId: row.requisitionId,
          requisitionNumber: row.requisition.requisitionNumber,
          clarificationId: row.id,
          dueAt: due.toISOString(),
          dedupeKey: `clarification:${row.id}:escalated`,
        },
      })),
    });

    escalated += 1;
  }

  return { checked: openRows.length, escalated };
}
