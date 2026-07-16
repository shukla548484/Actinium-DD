import { prisma } from "@/lib/prisma";
import { getNotificationRecipientIds } from "@/lib/notification-recipient-policy";
import { createActionableMessage } from "@/lib/utils/enhanced-activity-logger";
import { TASK_ARROW_CTA } from "@/lib/notifications/task-display";
import { hasUnreadTaskForUser } from "@/lib/notifications/has-unread-task";
import { resolveTaskDedupeKey } from "@/lib/notifications/task-dedupe";

export type ProcurementTaskNotificationInput = {
  operation: string;
  title?: string;
  message?: string;
  actionUrl: string;
  targetAccessLevels: number[];
  vesselId?: string | null;
  companyId?: string | null;
  entityType?: string;
  entityId?: string | null;
  dedupeKey: string;
  metadata?: Record<string, unknown>;
  actorUserId?: string;
  actorName?: string;
};

/** Prefer human entity numbers from metadata over internal dedupe keys. */
function resolveProcurementEntityLabel(input: ProcurementTaskNotificationInput): string {
  const meta = input.metadata ?? {};
  if (typeof meta.requisitionNumber === "string" && meta.requisitionNumber) {
    return meta.requisitionNumber;
  }
  if (typeof meta.poNumber === "string" && meta.poNumber) {
    return meta.poNumber;
  }
  if (typeof meta.invoiceNumber === "string" && meta.invoiceNumber) {
    return meta.invoiceNumber;
  }
  return input.dedupeKey;
}

async function resolveBackfillActorLabel(
  input: ProcurementTaskNotificationInput
): Promise<string> {
  if (input.actorName?.trim()) return input.actorName.trim();

  const meta = input.metadata ?? {};
  const requisitionId =
    typeof meta.requisitionId === "string" ? meta.requisitionId : null;
  if (requisitionId) {
    const req = await prisma.requisition.findUnique({
      where: { id: requisitionId },
      select: {
        approvedBy: { select: { firstName: true, lastName: true, designation: true } },
      },
    });
    if (req?.approvedBy) {
      const name = `${req.approvedBy.firstName ?? ""} ${req.approvedBy.lastName ?? ""}`.trim();
      if (name) return name;
      if (req.approvedBy.designation?.trim()) return req.approvedBy.designation.trim();
    }
  }

  return "An approver";
}

/** @deprecated Use `hasUnreadTaskForUser` from `@/lib/notifications/has-unread-task`. */
export async function hasUnreadProcurementTask(
  userId: string,
  operation: string,
  dedupeKey: string
): Promise<boolean> {
  return hasUnreadTaskForUser(userId, operation, dedupeKey, {
    notificationType: "TASK_ASSIGNED",
  });
}

/**
 * Create task notifications for procurement approvers (backfill-safe — deduped).
 */
export async function createProcurementTaskNotifications(
  input: ProcurementTaskNotificationInput
): Promise<number> {
  const recipientIds = await getNotificationRecipientIds({
    moduleNames: ["Purchase"],
    accessLevels: input.targetAccessLevels,
    vesselId: input.vesselId ?? null,
    companyId: input.companyId ?? null,
  });

  if (recipientIds.length === 0) return 0;

  const actorName = await resolveBackfillActorLabel(input);
  const entityLabel = resolveProcurementEntityLabel(input);
  const actionable = createActionableMessage(
    input.operation,
    input.entityType ?? "Purchase",
    entityLabel,
    actorName,
    input.actionUrl
  );

  const title = input.title ?? actionable.title;
  const message =
    input.message ??
    (actionable.message.includes(TASK_ARROW_CTA)
      ? actionable.message
      : `${actionable.message.replace(/\.\s*$/, "")}. ${TASK_ARROW_CTA}`);

  const toCreate: Array<{
    title: string;
    message: string;
    type: "TASK_ASSIGNED";
    operation: string;
    entityType: string;
    entityId: string | null;
    userId: string;
    isRead: boolean;
    metadata: Record<string, unknown>;
  }> = [];

  const usersWithExistingTask = new Set<string>();
  if (input.operation === "PO_RETURNED_FOR_REVISION") {
    const existing = await prisma.operationNotification.findMany({
      where: {
        userId: { in: recipientIds },
        isRead: false,
        operation: input.operation,
        type: "TASK_ASSIGNED",
      },
      select: { id: true, userId: true, metadata: true },
    });

    const refreshIds: string[] = [];
    for (const row of existing) {
      if (!row.userId) continue;
      const rowMeta = (row.metadata as Record<string, unknown> | null) ?? {};
      if (resolveTaskDedupeKey(input.operation, rowMeta) !== input.dedupeKey) continue;
      refreshIds.push(row.id);
      usersWithExistingTask.add(row.userId);
    }

    if (refreshIds.length > 0) {
      await prisma.operationNotification.updateMany({
        where: { id: { in: refreshIds } },
        data: {
          title,
          message,
          metadata: {
            dedupeKey: input.dedupeKey,
            actionUrl: input.actionUrl,
            vesselId: input.vesselId,
            syncBackfill: true,
            actorName,
            ...input.metadata,
          },
          createdAt: new Date(),
        },
      });
    }
  }

  for (const userId of recipientIds) {
    if (usersWithExistingTask.has(userId)) continue;

    const exists = await hasUnreadTaskForUser(userId, input.operation, input.dedupeKey, {
      notificationType: "TASK_ASSIGNED",
    });
    if (exists) continue;

    toCreate.push({
      title,
      message,
      type: "TASK_ASSIGNED",
      operation: input.operation,
      entityType: input.entityType ?? "Purchase",
      entityId: input.entityId ?? null,
      userId,
      isRead: false,
      metadata: {
        dedupeKey: input.dedupeKey,
        actionUrl: input.actionUrl,
        vesselId: input.vesselId,
        syncBackfill: true,
        actorName,
        ...input.metadata,
      },
    });
  }

  if (toCreate.length === 0) {
    return usersWithExistingTask.size;
  }

  await prisma.operationNotification.createMany({ data: toCreate });
  return toCreate.length + usersWithExistingTask.size;
}
