/**
 * Client-side session bootstrap pack (profile, vessels, modules, warm metadata).
 */

import { cacheVesselsData, getCachedVesselsData } from "@/lib/cookie-cache";

const STORAGE_KEY = "act-session-bootstrap-v1";

export type SessionBootstrapPack = {
  version: 1;
  cachedAt: string;
  userId: string;
  user: Record<string, unknown>;
  vessels: Array<{ id: string; name: string; code?: string; [key: string]: unknown }>;
  modules?: Array<{ name: string; description?: string | null }>;
  crewAllowedPagePaths?: string[];
  lastVesselId?: string | null;
};

export function loadSessionBootstrap(): SessionBootstrapPack | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SessionBootstrapPack;
    if (!data?.userId || !data?.cachedAt) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveSessionBootstrap(pack: SessionBootstrapPack): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pack));
    if (pack.vessels?.length) {
      cacheVesselsData(pack.vessels as Parameters<typeof cacheVesselsData>[0]);
    }
  } catch {
    /* quota */
  }
}

export function clearSessionBootstrap(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function hydrateVesselsFromBootstrap(): boolean {
  const pack = loadSessionBootstrap();
  if (pack?.vessels?.length) {
    cacheVesselsData(pack.vessels as Parameters<typeof cacheVesselsData>[0]);
    return true;
  }
  const cached = getCachedVesselsData();
  return Boolean(cached?.length);
}

export function getBootstrapLastVesselId(): string | null {
  const pack = loadSessionBootstrap();
  if (pack?.lastVesselId) return pack.lastVesselId;
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("act-last-vessel-id");
      if (stored) return stored;
    } catch {
      /* ignore */
    }
  }
  return pack?.vessels?.[0]?.id ?? null;
}

export function setBootstrapLastVesselId(vesselId: string): void {
  const pack = loadSessionBootstrap();
  if (!pack) return;
  saveSessionBootstrap({ ...pack, lastVesselId: vesselId });
}
