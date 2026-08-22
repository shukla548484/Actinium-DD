/**
 * Offline-first language packs for the shipyard module.
 * Online: refresh packs from /api/shipyard/i18n/packs into localStorage.
 * Offline: read from localStorage, then bundled fallbacks.
 */

import type { ShipyardQuoteLocale, ShipyardQuoteUiKey } from "@/lib/i18n/shipyardQuotationUi";
import { shipyardQuoteBundledPacks } from "@/lib/i18n/shipyardBundledPacks";

export const SHIPYARD_LANG_PACKS_STORAGE_KEY = "actinium.shipyard.i18n.packs.v1";
export const SHIPYARD_LANG_PACKS_META_KEY = "actinium.shipyard.i18n.packs.meta.v1";

export type ShipyardLangPack = Record<string, string>;
export type ShipyardLangPacks = Record<ShipyardQuoteLocale, ShipyardLangPack>;

type PackMeta = {
  version: string;
  updatedAt: string;
  source: "network" | "bundle" | "cache";
};

let memoryPacks: ShipyardLangPacks | null = null;
let memoryMeta: PackMeta | null = null;

export function getBundledShipyardLangPacks(): ShipyardLangPacks {
  return shipyardQuoteBundledPacks as ShipyardLangPacks;
}

export function loadCachedShipyardLangPacks(): ShipyardLangPacks | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SHIPYARD_LANG_PACKS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ShipyardLangPacks;
    if (!parsed?.en || !parsed.zh) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function loadCachedShipyardLangPackMeta(): PackMeta | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SHIPYARD_LANG_PACKS_META_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PackMeta;
  } catch {
    return null;
  }
}

export function saveShipyardLangPacks(packs: ShipyardLangPacks, source: PackMeta["source"]) {
  if (typeof window === "undefined") return;
  const meta: PackMeta = {
    version: packs.en?.packVersion ?? "1",
    updatedAt: new Date().toISOString(),
    source,
  };
  window.localStorage.setItem(SHIPYARD_LANG_PACKS_STORAGE_KEY, JSON.stringify(packs));
  window.localStorage.setItem(SHIPYARD_LANG_PACKS_META_KEY, JSON.stringify(meta));
  memoryPacks = packs;
  memoryMeta = meta;
  window.dispatchEvent(new Event("actinium-shipyard-i18n-packs"));
}

function packVersionNumber(value: string | undefined | null): number {
  const n = Number(value ?? "0");
  return Number.isFinite(n) ? n : 0;
}

/** Resolve packs: memory → localStorage → bundle. Re-seeds when bundled packs are newer. */
export function resolveShipyardLangPacks(): { packs: ShipyardLangPacks; meta: PackMeta } {
  const bundled = getBundledShipyardLangPacks();
  const bundledVersion = packVersionNumber(bundled.en.packVersion);

  if (memoryPacks) {
    const memVersion = packVersionNumber(memoryMeta?.version ?? memoryPacks.en?.packVersion);
    if (memVersion >= bundledVersion) {
      return {
        packs: memoryPacks,
        meta: memoryMeta ?? { version: String(memVersion), updatedAt: "", source: "cache" },
      };
    }
    memoryPacks = null;
    memoryMeta = null;
  }

  const cached = loadCachedShipyardLangPacks();
  const cachedMeta = loadCachedShipyardLangPackMeta();
  const cachedVersion = packVersionNumber(
    cachedMeta?.version ?? cached?.en?.packVersion,
  );
  if (cached && cachedVersion >= bundledVersion) {
    memoryPacks = cached;
    memoryMeta = cachedMeta ?? {
      version: String(cachedVersion),
      updatedAt: "",
      source: "cache",
    };
    return { packs: cached, meta: memoryMeta };
  }

  memoryPacks = bundled;
  memoryMeta = { version: bundled.en.packVersion ?? "1", updatedAt: "", source: "bundle" };
  // Seed / refresh localStorage so offline works and stale packs are replaced.
  if (typeof window !== "undefined") {
    try {
      saveShipyardLangPacks(bundled, "bundle");
    } catch {
      /* quota */
    }
  }
  return { packs: bundled, meta: memoryMeta };
}

export function translateFromPacks(
  packs: ShipyardLangPacks,
  locale: ShipyardQuoteLocale,
  key: ShipyardQuoteUiKey | string,
): string {
  const primary = packs[locale]?.[key];
  if (primary) return primary;
  const en = packs.en?.[key];
  if (en) return en;
  return String(key);
}

/** Fetch packs when online; keep cache when offline / failed. */
export async function syncShipyardLangPacksFromNetwork(): Promise<{
  ok: boolean;
  source: PackMeta["source"];
  error?: string;
}> {
  if (typeof window === "undefined") {
    return { ok: false, source: "bundle", error: "ssr" };
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    resolveShipyardLangPacks();
    return { ok: true, source: "cache" };
  }

  try {
    const res = await fetch("/api/shipyard/i18n/packs", { cache: "no-store" });
    if (!res.ok) {
      resolveShipyardLangPacks();
      return { ok: false, source: memoryMeta?.source ?? "cache", error: `HTTP ${res.status}` };
    }
    const data = (await res.json()) as { packs?: ShipyardLangPacks; version?: string };
    if (!data.packs?.en) {
      resolveShipyardLangPacks();
      return { ok: false, source: "cache", error: "invalid payload" };
    }
    saveShipyardLangPacks(data.packs, "network");
    return { ok: true, source: "network" };
  } catch (err) {
    resolveShipyardLangPacks();
    return {
      ok: false,
      source: memoryMeta?.source ?? "cache",
      error: err instanceof Error ? err.message : "network error",
    };
  }
}
