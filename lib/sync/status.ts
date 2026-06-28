import fs from "node:fs/promises";
import path from "node:path";

export interface SyncStatus {
  online: boolean;
  bucardoLogPath: string | null;
  lastLine: string | null;
  relayLogPath: string | null;
  relayLastLine: string | null;
  fleetOriginNode: string;
  vesselId: string | null;
  message: string;
}

async function tailFile(filePath: string): Promise<string | null> {
  try {
    const content = await fs.readFile(filePath, "utf8");
    const lines = content.trim().split("\n");
    return lines[lines.length - 1] ?? null;
  } catch {
    return null;
  }
}

export async function getSyncStatus(): Promise<SyncStatus> {
  const bucardoLogPath =
    process.env.BUCARDO_LOG_PATH ??
    (process.platform === "win32"
      ? "C:\\ProgramData\\drydock\\bucardo.log"
      : "/var/log/bucardo.log");
  const relayLogPath =
    process.env.RELAY_LOG_PATH ?? "/var/log/drydock-relay-sync.log";

  const [lastLine, relayLastLine] = await Promise.all([
    tailFile(bucardoLogPath),
    tailFile(relayLogPath),
  ]);

  return {
    online: typeof fetch !== "undefined",
    bucardoLogPath,
    lastLine,
    relayLogPath,
    relayLastLine,
    fleetOriginNode: process.env.FLEET_ORIGIN_NODE ?? "ship",
    vesselId: process.env.VESSEL_ID ?? null,
    message: lastLine
      ? "Bucardo log found — check last line for sync activity."
      : "No Bucardo log yet — run scripts/bucardo/*-init.sh after relay is up.",
  };
}
