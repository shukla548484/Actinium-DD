import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { logUserActivity, extractIpAddress, extractUserAgent, ActivityLogData } from "./activity-logger";
import { getNotificationRecipientIds } from "@/lib/notification-recipient-policy";
import { quoteCreatePoPath } from "@/lib/procurement/quote-po-navigation";
import { TASK_ARROW_CTA } from "@/lib/notifications/task-display";
import { resolveTaskDedupeKey } from "@/lib/notifications/task-dedupe";

export interface EnhancedActivityLogData extends ActivityLogData {
  // Notification data
  createNotification?: boolean;
  notificationTitle?: string;
  notificationMessage?: string;
  notificationType?: "SUCCESS" | "INFO" | "WARNING" | "ERROR" | "TASK_ASSIGNED" | "TASK_COMPLETED" | "PROJECT_UPDATE" | "COMMENT_ADDED" | "DEADLINE_APPROACHING" | "SYSTEM_NOTIFICATION";
  actionUrl?: string; // Link to the page where action is needed
  targetUserIds?: string[]; // Users who should receive this notification (e.g., approvers)
  targetAccessLevels?: number[]; // Access levels that should receive this notification
  companyId?: string;
}

/**
 * Get users who should receive notifications based on activity type and context
 */
async function getTargetUsers(
  activityType: string,
  module?: string,
  targetUserIds?: string[],
  targetAccessLevels?: number[],
  vesselId?: string,
  companyId?: string
): Promise<string[]> {
  const userIds: string[] = [];

  // If specific user IDs are provided, add them
  if (targetUserIds && targetUserIds.length > 0) {
    userIds.push(...targetUserIds);
  }

  // If access levels are specified, find users with those access levels (using Employee.designationAccessLevel)
  if (targetAccessLevels && targetAccessLevels.length > 0) {
    const users = await getNotificationRecipientIds({
      moduleNames: module ? [module] : undefined,
      accessLevels: targetAccessLevels,
      vesselId: vesselId || null,
      companyId: companyId || null,
    });
    userIds.push(...users);
  }

  // Default: For approval activities, notify admins (50) and managers (32, 33) if no target levels specified
  if (activityType.includes("APPROVE") || activityType.includes("PENDING_APPROVAL")) {
    if (!targetAccessLevels || targetAccessLevels.length === 0) {
      const approvers = await getNotificationRecipientIds({
        moduleNames: module ? [module] : undefined,
        accessLevels: [50, 32, 33],
        vesselId: vesselId || null,
        companyId: companyId || null,
      });
      userIds.push(...approvers);
    }
  }

  // Remove duplicates
  return Array.from(new Set(userIds));
}

/**
 * Create notification from activity log
 */
async function createNotificationFromActivity(
  data: EnhancedActivityLogData,
  userName: string
): Promise<void> {
  try {
    if (!data.createNotification) return;

    const targetUserIds = await getTargetUsers(
      data.activityType,
      data.module,
      data.targetUserIds,
      data.targetAccessLevels,
      data.vesselId,
      data.companyId
    );

    if (targetUserIds.length === 0) return;

    const meta = (data.metadata ?? {}) as Record<string, unknown>;
    const canonicalDedupeKey = resolveTaskDedupeKey(data.activityType, meta);
    const entityId =
      (typeof meta.poId === "string" && meta.poId) ||
      (typeof meta.quoteId === "string" && meta.quoteId) ||
      (typeof meta.requisitionId === "string" && meta.requisitionId) ||
      (typeof meta.invoiceId === "string" && meta.invoiceId) ||
      data.vesselId ||
      undefined;

    // Replace {USER_NAME} placeholder with actual user name
    const notificationMessage = (data.notificationMessage || data.activityDescription)
      .replace("{USER_NAME}", userName);

    const notifications: {
      title: string;
      message: string;
      type: NonNullable<EnhancedActivityLogData["notificationType"]> | "INFO";
      operation: string;
      entityType: string;
      entityId: string | undefined;
      userId: string;
      isRead: boolean;
      metadata: Record<string, unknown>;
    }[] = [];

    const usersWithDuplicateTask = new Set<string>();
    const revisionRowsToRefresh: { id: string; userId: string }[] = [];
    if (canonicalDedupeKey && data.notificationType === "TASK_ASSIGNED") {
      const existing = await prisma.operationNotification.findMany({
        where: {
          userId: { in: targetUserIds },
          isRead: false,
          operation: data.activityType,
          type: "TASK_ASSIGNED",
        },
        select: { id: true, userId: true, metadata: true },
      });
      for (const row of existing) {
        if (!row.userId) continue;
        const rowMeta = (row.metadata as Record<string, unknown> | null) ?? {};
        if (
          resolveTaskDedupeKey(data.activityType, rowMeta) !== canonicalDedupeKey
        ) {
          continue;
        }
        if (data.activityType === "PO_RETURNED_FOR_REVISION") {
          revisionRowsToRefresh.push({ id: row.id, userId: row.userId });
        } else {
          usersWithDuplicateTask.add(row.userId);
        }
      }
    }

    if (revisionRowsToRefresh.length > 0) {
      const refreshedMetadata = {
        activityId: data.userId,
        actorName: userName,
        activityType: data.activityType,
        module: data.module,
        page: data.page,
        actionUrl: data.actionUrl,
        requisitionNumber: data.requisitionNumber,
        purchaseOrderNumber: data.purchaseOrderNumber,
        machineryName: data.machineryName,
        vesselId: data.vesselId,
        ...meta,
        ...(canonicalDedupeKey ? { dedupeKey: canonicalDedupeKey } : {}),
      };
      await Promise.all(
        revisionRowsToRefresh.map((row) =>
          prisma.operationNotification.update({
            where: { id: row.id },
            data: {
              title: data.notificationTitle || data.activityDescription,
              message: notificationMessage,
              metadata: refreshedMetadata,
              createdAt: new Date(),
            },
          })
        )
      );
      for (const row of revisionRowsToRefresh) {
        usersWithDuplicateTask.add(row.userId);
      }
    }

    for (const userId of targetUserIds) {
      if (usersWithDuplicateTask.has(userId)) continue;

      notifications.push({
        title: data.notificationTitle || data.activityDescription,
        message: notificationMessage,
        type: data.notificationType || "INFO",
        operation: data.activityType,
        entityType: data.module || "System",
        entityId,
        userId,
        isRead: false,
        metadata: {
          activityId: data.userId,
          actorName: userName,
          activityType: data.activityType,
          module: data.module,
          page: data.page,
          actionUrl: data.actionUrl,
          requisitionNumber: data.requisitionNumber,
          purchaseOrderNumber: data.purchaseOrderNumber,
          machineryName: data.machineryName,
          vesselId: data.vesselId,
          ...meta,
          ...(canonicalDedupeKey ? { dedupeKey: canonicalDedupeKey } : {}),
        },
      });
    }

    if (notifications.length === 0) return;

    // Bulk create notifications
    await prisma.operationNotification.createMany({
      data: notifications,
    });
  } catch (error) {
    // Log error but don't throw - notification creation should not break the main flow
    console.error("Failed to create notification from activity:", error);
  }
}

/**
 * Enhanced activity logging with notification support
 */
export async function logActivityWithNotification(
  request: NextRequest,
  userId: string,
  activityType: string,
  activityDescription: string,
  data: EnhancedActivityLogData
): Promise<void> {
  // Get user name for notification messages
  let userName = "User";
  let actorCompanyId: string | undefined;
  try {
    const user = await prisma.employee.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, companyId: true },
    });
    if (user) {
      userName = `${user.firstName} ${user.lastName}`;
      actorCompanyId = user.companyId;
    }
  } catch (error) {
    console.error("Error fetching user name:", error);
  }

  // Log the activity
  await logUserActivity({
    userId,
    activityType,
    activityDescription,
    module: data.module,
    page: data.page || request.nextUrl.pathname,
    ipAddress: data.ipAddress || extractIpAddress(request),
    computerName: data.computerName || request.headers.get("x-computer-name") || undefined,
    userAgent: data.userAgent || extractUserAgent(request),
    requestMethod: data.requestMethod || request.method,
    requestUrl: data.requestUrl || request.nextUrl.toString(),
    requisitionNumber: data.requisitionNumber,
    purchaseOrderNumber: data.purchaseOrderNumber,
    machineryName: data.machineryName,
    vesselId: data.vesselId,
    metadata: data.metadata,
  });

  // Create notification if requested
  if (data.createNotification) {
    await createNotificationFromActivity(
      {
        ...data,
        companyId: data.companyId || actorCompanyId,
        userId,
        activityType,
        activityDescription,
      },
      userName
    );
  }
}

/**
 * Helper to create actionable notification messages with links
 */
export function createActionableMessage(
  activityType: string,
  entityType: string,
  entityIdentifier: string,
  userName: string,
  actionUrl?: string
): { title: string; message: string; actionUrl: string } {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.actinium-sm.org";
  
  let title = "";
  let message = "";
  let url = actionUrl || "";

  switch (activityType) {
    case "CREATE_PURCHASE_ORDER":
      title = "Purchase Order Created - Approval Required";
      message = `${userName} has created PO ${entityIdentifier}. ${TASK_ARROW_CTA}`;
      url = actionUrl || `${baseUrl}/purchase/view-pos?po=${encodeURIComponent(entityIdentifier)}`;
      break;

    case "CREATE_REQUISITION":
      title = "Requisition Created - Approval Required";
      message = `${userName} has created a requisition ${entityIdentifier}. ${TASK_ARROW_CTA}`;
      url = actionUrl || `${baseUrl}/purchase/requisitions/${entityIdentifier}/approve`;
      break;

    case "UPDATE_REQUISITION":
      title = "Requisition Updated - Review Required";
      message = `${userName} has updated Requisition "${entityIdentifier}". ${TASK_ARROW_CTA}`;
      url = actionUrl || `${baseUrl}/purchase/view-requisitions?req=${encodeURIComponent(entityIdentifier)}`;
      break;

    case "CREATE_QUOTE":
      title = "Quote Created - Review Required";
      message = `${userName} has created a quote for requisition ${entityIdentifier}. ${TASK_ARROW_CTA}`;
      url = actionUrl || `${baseUrl}/purchase/quotes/${entityIdentifier}/confirm`;
      break;

    case "APPROVE_PURCHASE_ORDER":
      title = "Purchase Order Approved";
      message = `${userName} has approved Purchase Order "${entityIdentifier}".`;
      url = actionUrl || `${baseUrl}/purchase/view-pos?po=${encodeURIComponent(entityIdentifier)}`;
      break;

    case "PO_APPROVAL_PENDING":
      title = "Purchase Order — Approval Required";
      message = `PO ${entityIdentifier} requires your approval. ${TASK_ARROW_CTA}`;
      url = actionUrl || `${baseUrl}/purchase/view-pos?po=${encodeURIComponent(entityIdentifier)}`;
      break;

    case "PO_READY_TO_SEND":
      title = "Purchase Order — Ready to Send";
      message = `PO ${entityIdentifier} has all approvals. ${TASK_ARROW_CTA}`;
      url = actionUrl || `${baseUrl}/purchase/view-pos?po=${encodeURIComponent(entityIdentifier)}`;
      break;

    case "PO_RETURNED_FOR_REVISION":
      title = "Purchase Order — Revision Required";
      message = `PO ${entityIdentifier} was rejected. Revise and re-create the purchase order. ${TASK_ARROW_CTA}`;
      url = actionUrl || `${baseUrl}/purchase/quotes`;
      break;

    case "REQ_APPROVAL_PENDING":
      title = "Requisition — Approval Required";
      message = `Requisition ${entityIdentifier} requires your approval. ${TASK_ARROW_CTA}`;
      url = actionUrl || `${baseUrl}/purchase/view-requisitions?req=${encodeURIComponent(entityIdentifier)}`;
      break;

    case "REJECT_PURCHASE_ORDER":
      title = "Purchase Order Rejected";
      message = `${userName} has rejected Purchase Order "${entityIdentifier}". Please review.`;
      url = actionUrl || `${baseUrl}/purchase/view-pos?po=${encodeURIComponent(entityIdentifier)}`;
      break;

    case "APPROVE_REQUISITION":
      title = "Requisition Approved";
      message = `${userName} has approved Requisition "${entityIdentifier}". Next step: Send for Quote. ${TASK_ARROW_CTA}`;
      url = actionUrl || `${baseUrl}/purchase/view-requisitions?req=${encodeURIComponent(entityIdentifier)}`;
      break;

    case "REJECT_REQUISITION":
      title = "Requisition Rejected";
      message = `${userName} has rejected Requisition "${entityIdentifier}". Please review.`;
      url = actionUrl || `${baseUrl}/purchase/view-requisitions?req=${encodeURIComponent(entityIdentifier)}`;
      break;

    case "CREATE_INVOICE":
      title = "Invoice Created - Verification Required";
      message = `${userName} has uploaded Invoice ${entityIdentifier}. ${TASK_ARROW_CTA}`;
      url = actionUrl || `${baseUrl}/purchase/invoices?invoice=${encodeURIComponent(entityIdentifier)}`;
      break;

    case "INVOICE_APPROVAL_PENDING":
      title = "Invoice — Verification Required";
      message = `Invoice ${entityIdentifier} requires your verification. ${TASK_ARROW_CTA}`;
      url = actionUrl || `${baseUrl}/purchase/invoices?invoice=${encodeURIComponent(entityIdentifier)}`;
      break;

    case "INVOICE_READY_FOR_PAYMENT":
      title = "Invoice — Ready for Payment";
      message = `Invoice ${entityIdentifier} is fully verified and ready for payment. ${TASK_ARROW_CTA}`;
      url = actionUrl || `${baseUrl}/accounts/pending-invoices?invoice=${encodeURIComponent(entityIdentifier)}`;
      break;

    case "VERIFY_INVOICE":
      title = "Invoice Verified - Next Step Required";
      message = `Invoice ${entityIdentifier} was verified by ${userName}. Please complete the next verification step or process payment.`;
      url = actionUrl || `${baseUrl}/accounts/pending-invoices?invoice=${encodeURIComponent(entityIdentifier)}`;
      break;

    case "CREATE_MACHINERY":
      title = "Machinery Created";
      message = `${userName} has created Machinery "${entityIdentifier}".`;
      url = actionUrl || `${baseUrl}/admin/machinery?machinery=${encodeURIComponent(entityIdentifier)}`;
      break;

    case "UPDATE_MACHINERY":
      title = "Machinery Updated";
      message = `User ${userName} has updated Machinery "${entityIdentifier}".`;
      url = actionUrl || `${baseUrl}/admin/machinery?machinery=${encodeURIComponent(entityIdentifier)}`;
      break;

    case "REJECT_QUOTE":
      title = "Quote Rejected";
      message = `User ${userName} has rejected Quote "${entityIdentifier}". Please review.`;
      url = actionUrl || `${baseUrl}/purchase/quotes`;
      break;

    case "RETURN_REQUISITION":
      title = "Requisition Returned for Editing";
      message = `${userName} has returned requisition ${entityIdentifier} for editing. ${TASK_ARROW_CTA}`;
      url = actionUrl || `${baseUrl}/purchase/requisitions/${entityIdentifier}/view`;
      break;

    case "CANCEL_PURCHASE_ORDER":
      title = "Purchase Order Cancelled";
      message = `User ${userName} has cancelled Purchase Order "${entityIdentifier}".`;
      url = actionUrl || `${baseUrl}/purchase/view-pos?po=${encodeURIComponent(entityIdentifier)}`;
      break;

    case "APPROVE_QUOTE":
      title = "Quote Approved";
      message = `${userName} has approved the quote for requisition ${entityIdentifier}. ${TASK_ARROW_CTA}`;
      url =
        actionUrl ||
        `${baseUrl}${quoteCreatePoPath(entityIdentifier, { from: "notification" })}`;
      break;

    case "CREATE_VESSEL":
      title = "Vessel Created";
      message = `User ${userName} has created Vessel "${entityIdentifier}".`;
      url = actionUrl || `${baseUrl}/admin/vessels`;
      break;

    case "UPDATE_VESSEL":
      title = "Vessel Updated";
      message = `User ${userName} has updated Vessel "${entityIdentifier}".`;
      url = actionUrl || `${baseUrl}/admin/vessels`;
      break;

    case "CREATE_EMPLOYEE":
      title = "Employee Created";
      message = `User ${userName} has created Employee "${entityIdentifier}".`;
      url = actionUrl || `${baseUrl}/admin/employee`;
      break;

    case "UPDATE_EMPLOYEE":
      title = "Employee Updated";
      message = `User ${userName} has updated Employee "${entityIdentifier}".`;
      url = actionUrl || `${baseUrl}/admin/employee`;
      break;

    case "PAY_INVOICE":
      title = "Invoice Paid";
      message = `User ${userName} has recorded payment for Invoice "${entityIdentifier}".`;
      url = actionUrl || `${baseUrl}/accounts/pending-invoices`;
      break;

    case "CREATE_SAFETY_OBSERVATION":
      title = "Safety Observation - Action Required";
      message = `${userName} has created a safety observation requiring your action. ${TASK_ARROW_CTA}`;
      url = actionUrl || `${baseUrl}/hseq/safety-observations`;
      break;

    default:
      title = "Activity Update";
      message = `${userName} performed ${activityType} on ${entityType} "${entityIdentifier}".`;
      url = actionUrl || baseUrl;
  }

  return { title, message, actionUrl: appendFromNotification(url) };
}

/** Append from=notification to action URLs so approval pages can show Return link and redirect after action */
function appendFromNotification(url: string): string {
  if (!url) return url;
  return url.includes("?") ? `${url}&from=notification` : `${url}?from=notification`;
}

/**
 * Enhanced helper to log activity from API route with notifications
 */
export async function logActivityFromRequestWithNotification(
  request: NextRequest,
  userId: string,
  activityType: string,
  activityDescription: string,
  additionalData?: {
    module?: string;
    page?: string;
    requisitionNumber?: string;
    purchaseOrderNumber?: string;
    machineryName?: string;
    vesselId?: string;
    metadata?: Record<string, any>;
    // Notification-specific
    createNotification?: boolean;
    notificationType?: "SUCCESS" | "INFO" | "WARNING" | "ERROR" | "TASK_ASSIGNED" | "TASK_COMPLETED" | "PROJECT_UPDATE" | "COMMENT_ADDED" | "DEADLINE_APPROACHING" | "SYSTEM_NOTIFICATION";
    actionUrl?: string;
    targetUserIds?: string[];
    targetAccessLevels?: number[];
    companyId?: string;
  }
): Promise<void> {
  const ipAddress = extractIpAddress(request);
  const userAgent = extractUserAgent(request);
  const computerName = request.headers.get("x-computer-name") || undefined;

  // Create actionable message if notification is requested
  let notificationTitle = "";
  let notificationMessage = "";
  let actionUrl = additionalData?.actionUrl;

  if (additionalData?.createNotification) {
    const entityIdentifier = 
      additionalData.purchaseOrderNumber || 
      additionalData.requisitionNumber || 
      additionalData.machineryName || 
      "item";
    
    const actionable = createActionableMessage(
      activityType,
      additionalData.module || "System",
      entityIdentifier,
      "{USER_NAME}", // Replaced with actual user name when creating notification
      actionUrl
    );
    notificationTitle = actionable.title;
    notificationMessage = actionable.message;
    actionUrl = actionable.actionUrl;
  }

  await logActivityWithNotification(
    request,
    userId,
    activityType,
    activityDescription,
    {
      userId,
      activityType,
      activityDescription,
      module: additionalData?.module,
      page: additionalData?.page || request.nextUrl.pathname,
      ipAddress,
      computerName,
      userAgent,
      requestMethod: request.method,
      requestUrl: request.nextUrl.toString(),
      requisitionNumber: additionalData?.requisitionNumber,
      purchaseOrderNumber: additionalData?.purchaseOrderNumber,
      machineryName: additionalData?.machineryName,
      vesselId: additionalData?.vesselId,
      companyId: additionalData?.companyId,
      metadata: additionalData?.metadata,
      createNotification: additionalData?.createNotification,
      notificationTitle,
      notificationMessage,
      notificationType: additionalData?.notificationType || "INFO",
      actionUrl,
      targetUserIds: additionalData?.targetUserIds,
      targetAccessLevels: additionalData?.targetAccessLevels,
    }
  );
}

