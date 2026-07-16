/**
 * In-memory JSON warm cache populated by BackgroundRouteWarm (idle, post page-ready).
 */

type WarmEntry = { data: unknown; cachedAt: number };

const warmStore = new Map<string, WarmEntry>();
const MAX_ENTRIES = 24;

export function setWarmCache(key: string, data: unknown): void {
  if (warmStore.size >= MAX_ENTRIES && !warmStore.has(key)) {
    const oldest = warmStore.keys().next().value;
    if (oldest) warmStore.delete(oldest);
  }
  warmStore.set(key, { data, cachedAt: Date.now() });
}

export function getWarmCache<T = unknown>(key: string, maxAgeMs = 5 * 60 * 1000): T | null {
  const entry = warmStore.get(key);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > maxAgeMs) {
    warmStore.delete(key);
    return null;
  }
  return entry.data as T;
}

export function clearWarmCache(): void {
  warmStore.clear();
}
