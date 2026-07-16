/**
 * Persists vessel/rank crew page ACL so the main app can resolve navigation when offline
 * (localStorage survives reloads; auth cookie may not be refreshable without network).
 */

import {
  normalizeNavPath,
  withMasterSyncSetupPaths,
} from "@/lib/nav/master-crew-sync-nav";

const STORAGE_KEY = "actinium-crew-nav-v1";

export type CrewNavOfflinePayload = {
  vesselId: string;
  rankAccessLevel: number;
  crewAllowedPagePaths: string[];
  cachedAt: string;
};

export function saveCrewNavOfflineSnapshot(payload: Omit<CrewNavOfflinePayload, "cachedAt">): void {
  if (typeof window === "undefined") return;
  try {
    const full: CrewNavOfflinePayload = {
      ...payload,
      cachedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(full));
  } catch {
    /* quota / private mode */
  }
}

export function loadCrewNavOfflineSnapshot(): CrewNavOfflinePayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as CrewNavOfflinePayload;
    if (
      !data ||
      typeof data.vesselId !== "string" ||
      typeof data.rankAccessLevel !== "number" ||
      !Array.isArray(data.crewAllowedPagePaths)
    ) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function clearCrewNavOfflineSnapshot(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Shell routes always reachable for crew (home, help, auth flows). */
const CREW_SHELL_PREFIXES = [
  "/maindashboard",
  "/dashboard",
  "/profile",
  "/change-password",
  "/help",
  "/unauthorized",
  "/login",
];

function pathMatchesPrefix(pathname: string, prefix: string): boolean {
  if (prefix === "/") return pathname === "/" || pathname.startsWith("/?");
  if (pathname === prefix) return true;
  const base = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
  return pathname.startsWith(`${base}/`);
}

/**
 * If the stored user is missing `crewAllowedPagePaths` but we have a matching offline snapshot, merge paths in.
 */
export function hydrateCrewUserFromOfflineCache<T extends Record<string, unknown>>(user: T): T {
  const u = user as T & {
    isCrewCredential?: boolean;
    vesselId?: string;
    designationAccessLevel?: number;
    crewAllowedPagePaths?: string[];
  };
  if (!u.isCrewCredential || !u.vesselId) return user;

  if (u.crewAllowedPagePaths && u.crewAllowedPagePaths.length > 0) {
    return user;
  }

  const snap = loadCrewNavOfflineSnapshot();
  if (!snap) return user;
  if (snap.vesselId !== u.vesselId || snap.rankAccessLevel !== (u.designationAccessLevel ?? 0)) {
    return user;
  }

  return {
    ...user,
    crewAllowedPagePaths: snap.crewAllowedPagePaths,
  };
}

/**
 * Whether pathname is allowed for crew page-level ACL (offline or online client guard).
 */
export function isCrewPathAllowed(
  pathname: string,
  crewAllowedPagePaths: string[] | undefined | null
): boolean {
  if (!crewAllowedPagePaths?.length) return true;

  const allowedPaths = withMasterSyncSetupPaths(crewAllowedPagePaths);

  for (const shell of CREW_SHELL_PREFIXES) {
    if (pathMatchesPrefix(pathname, shell)) return true;
  }

  for (const p of allowedPaths) {
    if (!p || typeof p !== "string") continue;
    if (pathMatchesPrefix(pathname, normalizeNavPath(p))) return true;
  }

  return false;
}
