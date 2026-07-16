import "server-only";

import prisma from "@/lib/prisma";
import { findRfqClarificationNotifyRecipientIds } from "@/lib/procurement/clarification-recipients";
import { resolveTaskDedupeKey } from "@/lib/notifications/task-dedupe";
import { filterUsersWithoutUnreadTask } from "@/lib/notifications/has-unread-task";

export {
  buildVesselVisibleClarificationMessage,
  canManagePurchaseClarifications,
  canRespondToVesselClarification,
} from "@/lib/procurement/clarification-notifications-access";

export async function notifyClarificationCreated(params: {
  clarificationId: string;
  requisitionId: string;
  requisitionNumber: string;
  vesselId: string;
  vesselName: string;
  itemName?: string | null;
  vesselVisibleMessage: string;
  vendorName: string;
  purchaserUserIds: string[];
  creatorAccessLevel: number;
}) {
  try {
    const vesselTitle = "Additional information required for requisition";
    const vesselMessage = params.itemName
      ? `${params.requisitionNumber}: ${params.itemName} — ${params.vesselVisibleMessage}`
      : `${params.requisitionNumber} — ${params.vesselVisibleMessage}`;

    const vesselUserIds = await findRfqClarificationNotifyRecipientIds(
      prisma,
      params.vesselId,
      params.creatorAccessLevel
    );

    if (vesselUserIds.length) {
      const dedupeKey = resolveTaskDedupeKey("RFQ_CLARIFICATION_REQUESTED", {
        clarificationId: params.clarificationId,
        requisitionId: params.requisitionId,
      });
      const notifyIds = dedupeKey
        ? await filterUsersWithoutUnreadTask({
            userIds: vesselUserIds,
            operation: "RFQ_CLARIFICATION_REQUESTED",
            dedupeKey,
          })
        : vesselUserIds;

      if (notifyIds.length) {
        await prisma.operationNotification.createMany({
          data: notifyIds.map((userId) => ({
            title: vesselTitle,
            message: vesselMessage,
            type: "TASK_ASSIGNED",
            operation: "RFQ_CLARIFICATION_REQUESTED",
            entityType: "RfqClarification",
            entityId: params.clarificationId,
            userId,
            isRead: false,
            metadata: {
              actionUrl: `/purchase/requisitions/${params.requisitionId}/clarifications/${params.clarificationId}?view=vessel`,
              requisitionId: params.requisitionId,
              requisitionNumber: params.requisitionNumber,
              vesselId: params.vesselId,
              clarificationId: params.clarificationId,
              anonymous: true,
              ...(dedupeKey ? { dedupeKey } : {}),
            },
          })),
        });
      }
    }

    const officeIds = [...new Set(params.purchaserUserIds.filter(Boolean))];
    if (officeIds.length) {
      await prisma.operationNotification.createMany({
        data: officeIds.map((userId) => ({
          title: "Vendor requested RFQ clarification",
          message: `${params.vendorName} requested clarification on ${params.requisitionNumber}${params.itemName ? ` (${params.itemName})` : ""}.`,
          type: "INFO",
          operation: "RFQ_CLARIFICATION_REQUESTED",
          entityType: "RfqClarification",
          entityId: params.clarificationId,
          userId,
          isRead: false,
          metadata: {
            actionUrl: `/purchase/requisitions/${params.requisitionId}/clarifications/${params.clarificationId}?view=office`,
            requisitionId: params.requisitionId,
            requisitionNumber: params.requisitionNumber,
            vendorName: params.vendorName,
          },
        })),
      });
    }
  } catch (error) {
    console.error("[notifyClarificationCreated]", error);
  }
}

export async function notifyClarificationAnswered(params: {
  clarificationId: string;
  requisitionId: string;
  requisitionNumber: string;
  vesselName: string;
  vendorQuoteId: string;
  vendorId: string;
  purchaserUserIds: string[];
}) {
  try {
    if (params.purchaserUserIds.length) {
      await prisma.operationNotification.createMany({
        data: params.purchaserUserIds.map((userId) => ({
          title: "RFQ clarification answered",
          message: `${params.vesselName} responded to clarification on ${params.requisitionNumber}.`,
          type: "SUCCESS",
          operation: "RFQ_CLARIFICATION_ANSWERED",
          entityType: "RfqClarification",
          entityId: params.clarificationId,
          userId,
          isRead: false,
          metadata: {
            actionUrl: `/purchase/requisitions/${params.requisitionId}/clarifications/${params.clarificationId}?view=office`,
            requisitionId: params.requisitionId,
            vesselName: params.vesselName,
          },
        })),
      });
    }

    await prisma.operationNotification.create({
      data: {
        title: "Clarification response available",
        message: `${params.vesselName} has replied to your clarification request for requisition ${params.requisitionNumber}.`,
        type: "INFO",
        operation: "RFQ_CLARIFICATION_ANSWERED",
        entityType: "VendorQuote",
        entityId: params.vendorQuoteId,
        userId: null,
        isRead: false,
        metadata: {
          vendorId: params.vendorId,
          actionUrl: `/vendor/rfqs/${params.vendorQuoteId}/quote?tab=clarifications`,
          requisitionNumber: params.requisitionNumber,
          vesselName: params.vesselName,
          anonymous: true,
        },
      },
    });
  } catch (error) {
    console.error("[notifyClarificationAnswered]", error);
  }
}
