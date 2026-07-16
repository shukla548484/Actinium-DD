"use client";

import { useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  loadSessionBootstrap,
  saveSessionBootstrap,
  type SessionBootstrapPack,
} from "@/lib/session-bootstrap-cache";
import { cacheUserData } from "@/lib/cookie-cache";

const BOOTSTRAP_MAX_AGE_MS = 5 * 60 * 1000;

function isFresh(pack: SessionBootstrapPack | null): boolean {
  if (!pack?.cachedAt) return false;
  return Date.now() - new Date(pack.cachedAt).getTime() < BOOTSTRAP_MAX_AGE_MS;
}

/**
 * Fetches /api/session/bootstrap after login and refreshes stale packs in the background.
 */
export function useSessionBootstrap(enabled = true): void {
  const { isAuthenticated, user } = useAuth();
  const inflightRef = useRef(false);

  const fetchBootstrap = useCallback(async (force = false) => {
    if (inflightRef.current) return;
    const existing = loadSessionBootstrap();
    if (!force && isFresh(existing) && existing?.userId === user?.id) {
      return;
    }

    inflightRef.current = true;
    try {
      const res = await fetch("/api/session/bootstrap", {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return;
      const data = (await res.json()) as SessionBootstrapPack;
      if (!data?.userId) return;
      saveSessionBootstrap(data);
      if (data.user && typeof data.user === "object") {
        cacheUserData(data.user as Parameters<typeof cacheUserData>[0]);
      }
    } catch {
      /* non-critical */
    } finally {
      inflightRef.current = false;
    }
  }, [user?.id]);

  useEffect(() => {
    if (!enabled || !isAuthenticated || !user?.id) return;
    const existing = loadSessionBootstrap();
    if (isFresh(existing) && existing.userId === user.id) return;
    void fetchBootstrap(true);
  }, [enabled, isAuthenticated, user?.id, fetchBootstrap]);
}

/** Fire-and-forget bootstrap prefetch (e.g. right after login). */
export async function prefetchSessionBootstrap(): Promise<void> {
  try {
    const res = await fetch("/api/session/bootstrap", {
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return;
    const data = (await res.json()) as SessionBootstrapPack;
    if (!data?.userId) return;
    saveSessionBootstrap(data);
    if (data.user && typeof data.user === "object") {
      cacheUserData(data.user as Parameters<typeof cacheUserData>[0]);
    }
  } catch {
    /* ignore */
  }
}
