import { markUnreadTasksReadByDedupeKey } from "@/lib/notifications/has-unread-task";

/** Clear all tier approval tasks for a PO when it is rejected at any level. */
export async function clearPoApprovalPendingNotifications(poId: string): Promise<void> {
  for (const level of [1, 2, 3] as const) {
    await markUnreadTasksReadByDedupeKey({
      operation: "PO_APPROVAL_PENDING",
      dedupeKey: `po:${poId}:level${level}`,
    });
  }
}
