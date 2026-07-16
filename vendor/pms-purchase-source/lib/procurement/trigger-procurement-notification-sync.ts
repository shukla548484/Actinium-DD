import { syncPendingProcurementNotifications } from "@/lib/procurement/sync-pending-approval-notifications";

let lastSyncAt = 0;
const SYNC_THROTTLE_MS = 5 * 60 * 1000;

/** Best-effort backfill for missing procurement task notifications (throttled). */
export function triggerProcurementNotificationSync(options?: {
  limitPerCategory?: number;
  force?: boolean;
}): Promise<void> | undefined {
  const now = Date.now();
  if (!options?.force && now - lastSyncAt <= SYNC_THROTTLE_MS) {
    return undefined;
  }
  lastSyncAt = now;
  return syncPendingProcurementNotifications({
    limitPerCategory: options?.limitPerCategory ?? 80,
  }).catch((err) => {
    console.error("[procurement-sync] notification backfill failed:", err);
  });
}
