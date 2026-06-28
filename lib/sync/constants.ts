/** Tables replicated Office ↔ VPS relay ↔ Ship/Superintendent (Bucardo manifest). */
export const SYNC_MANIFEST_TABLES = [
  "projects",
  "spec_lines",
  "yard_invites",
  "quote_meta",
  "quote_lines",
  "compare_snapshots",
  "sync_tombstones",
] as const;

export type SyncManifestTable = (typeof SYNC_MANIFEST_TABLES)[number];

export const RELAY_DB_NAME = "drydock_sync_relay";

export type SyncOriginNode = "office" | "vps" | "ship" | "superintendent" | "yard";

/** Fleet-originated writes eligible for relay → office push. */
export const FLEET_ORIGIN_NODES: SyncOriginNode[] = ["ship", "superintendent"];

/** Yard portal writes land on office with this origin. */
export const YARD_ORIGIN_NODE: SyncOriginNode = "yard";
