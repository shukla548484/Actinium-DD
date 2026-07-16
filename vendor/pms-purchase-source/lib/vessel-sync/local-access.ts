/** Access levels that may trigger local HTTPS sync (ship crew / vessel band). */
export const LOCAL_SYNC_ACCESS_MIN = 6;
export const LOCAL_SYNC_ACCESS_MAX = 25;

const ADMIN_SYNC_LEVELS = new Set([25, 50, 99, 100]);

export function isLocalSyncEligibleAccessLevel(level: number | null | undefined): boolean {
  const l = level ?? 0;
  if (ADMIN_SYNC_LEVELS.has(l)) return true;
  return l >= LOCAL_SYNC_ACCESS_MIN && l <= LOCAL_SYNC_ACCESS_MAX;
}

export function isLocalDeployment(): boolean {
  return (process.env.DEPLOYMENT_ROLE ?? "server").trim().toLowerCase() === "local";
}

export function localSyncIntervalMinutes(): number {
  const raw = process.env.VESSEL_SYNC_INTERVAL_MINUTES;
  const n = raw ? parseInt(raw, 10) : 30;
  if (!Number.isFinite(n) || n < 5) return 30;
  return Math.min(n, 24 * 60);
}
