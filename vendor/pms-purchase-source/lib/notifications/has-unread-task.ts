import { prisma } from "@/lib/prisma";
import { resolveTaskDedupeKey } from "@/lib/notifications/task-dedupe";

/** True when user already has an unread notification for this canonical key. */
export async function hasUnreadTaskForUser(
  userId: string,
  operation: string,
  dedupeKey: string,
  options?: { notificationType?: string }
): Promise<boolean> {
  const rows = await prisma.operationNotification.findMany({
    where: {
      userId,
      isRead: false,
      operation,
      ...(options?.notificationType ? { type: options.notificationType } : {}),
    },
    select: { metadata: true, operation: true },
    take: 50,
  });
  return rows.some((row) => {
    const meta = (row.metadata as Record<string, unknown> | null) ?? {};
    return resolveTaskDedupeKey(row.operation, meta) === dedupeKey;
  });
}

/** Drop user IDs that already have the same pending notification. */
export async function filterUsersWithoutUnreadTask(input: {
  userIds: string[];
  operation: string;
  dedupeKey: string;
  notificationType?: string;
}): Promise<string[]> {
  const out: string[] = [];
  for (const userId of input.userIds) {
    const exists = await hasUnreadTaskForUser(
      userId,
      input.operation,
      input.dedupeKey,
      input.notificationType !== undefined
        ? { notificationType: input.notificationType }
        : undefined
    );
    if (!exists) out.push(userId);
  }
  return out;
}

/** Mark unread TASK_ASSIGNED rows matching operation + canonical dedupe key. */
export async function markUnreadTasksReadByDedupeKey(input: {
  operation: string;
  dedupeKey: string;
  userIds?: string[];
}): Promise<number> {
  const where: {
    operation: string;
    type: "TASK_ASSIGNED";
    isRead: false;
    userId?: { in: string[] };
  } = {
    operation: input.operation,
    type: "TASK_ASSIGNED",
    isRead: false,
  };
  if (input.userIds?.length) {
    where.userId = { in: input.userIds };
  }

  const rows = await prisma.operationNotification.findMany({
    where,
    select: { id: true, metadata: true },
    take: 200,
  });

  const ids = rows
    .filter((row) => {
      const meta = (row.metadata as Record<string, unknown> | null) ?? {};
      return resolveTaskDedupeKey(input.operation, meta) === input.dedupeKey;
    })
    .map((row) => row.id);

  if (ids.length === 0) return 0;

  const result = await prisma.operationNotification.updateMany({
    where: { id: { in: ids } },
    data: { isRead: true },
  });
  return result.count;
}
