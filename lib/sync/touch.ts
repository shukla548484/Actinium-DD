import type { SyncOriginNode } from "@/lib/sync/constants";

/** Attach sync metadata for writes that should propagate via relay/Bucardo. */
export function withSyncWrite<T extends Record<string, unknown>>(
  data: T,
  originNode: SyncOriginNode,
): T & { originNode: SyncOriginNode; officeChangedAt: Date } {
  return {
    ...data,
    originNode,
    officeChangedAt: new Date(),
  };
}

export function fleetOriginFromEnv(): SyncOriginNode {
  const node = process.env.FLEET_ORIGIN_NODE?.trim().toLowerCase();
  if (node === "superintendent") return "superintendent";
  return "ship";
}
