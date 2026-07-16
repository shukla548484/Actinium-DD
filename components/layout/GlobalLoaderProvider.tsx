"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { ActiniumLoaderOverlay } from "@/components/ui/ActiniumLoader";

type GlobalLoaderContextValue = {
  /** True when global overlay should show (navigation or manual tasks). */
  isLoading: boolean;
  /** Increment manual loading counter — overlay stays until all tasks finish. */
  startLoading: (key?: string) => void;
  stopLoading: (key?: string) => void;
  /** Wrap an async call with automatic start/stop. */
  withLoading: <T>(fn: () => Promise<T>, key?: string) => Promise<T>;
};

const GlobalLoaderContext = createContext<GlobalLoaderContextValue | null>(null);

const BOOT_TIMEOUT_MS = 2500;
const NAV_TIMEOUT_MS = 4000;

function isInternalNavigationLink(anchor: HTMLAnchorElement, pathname: string): boolean {
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;
  if (anchor.getAttribute("href")?.startsWith("#")) return false;

  const href = anchor.getAttribute("href");
  if (!href) return false;

  try {
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) return false;
    // Same path (ignoring hash) — no transition overlay.
    if (url.pathname === pathname && url.search === window.location.search) return false;
    return true;
  } catch {
    return false;
  }
}

export function GlobalLoaderProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [navigating, setNavigating] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const taskCountsRef = useRef(new Map<string, number>());
  const [taskVersion, setTaskVersion] = useState(0);

  const taskCount = useMemo(() => {
    let total = 0;
    for (const n of taskCountsRef.current.values()) total += n;
    return total;
  }, [taskVersion]);

  const bumpTasks = useCallback(() => setTaskVersion((v) => v + 1), []);

  const startLoading = useCallback(
    (key = "default") => {
      const map = taskCountsRef.current;
      map.set(key, (map.get(key) ?? 0) + 1);
      bumpTasks();
    },
    [bumpTasks],
  );

  const stopLoading = useCallback(
    (key = "default") => {
      const map = taskCountsRef.current;
      const next = (map.get(key) ?? 0) - 1;
      if (next <= 0) map.delete(key);
      else map.set(key, next);
      bumpTasks();
    },
    [bumpTasks],
  );

  const withLoading = useCallback(
    async <T,>(fn: () => Promise<T>, key = "default"): Promise<T> => {
      startLoading(key);
      try {
        return await fn();
      } finally {
        stopLoading(key);
      }
    },
    [startLoading, stopLoading],
  );

  /** First paint / hydration — always clear within a timeout so the UI cannot stick. */
  useEffect(() => {
    const clear = () => setBootLoading(false);
    if (document.readyState === "complete") {
      clear();
      return;
    }
    window.addEventListener("load", clear);
    document.addEventListener("readystatechange", clear);
    const timeout = window.setTimeout(clear, BOOT_TIMEOUT_MS);
    return () => {
      window.removeEventListener("load", clear);
      document.removeEventListener("readystatechange", clear);
      window.clearTimeout(timeout);
    };
  }, []);

  /** Route arrived — clear navigation overlay. */
  useEffect(() => {
    setNavigating(false);
  }, [pathname]);

  /** Safety: never leave the nav overlay up if the route fails to change. */
  useEffect(() => {
    if (!navigating) return;
    const timeout = window.setTimeout(() => setNavigating(false), NAV_TIMEOUT_MS);
    return () => window.clearTimeout(timeout);
  }, [navigating]);

  /** Intercept in-app link clicks to show loader during transitions. */
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest("a");
      if (!anchor || !isInternalNavigationLink(anchor, pathname)) return;

      setNavigating(true);
    };

    const onPopState = () => setNavigating(true);

    // Bubble phase — after Next.js Link handles the click — so we don't race the overlay
    // over the top of the in-flight navigation gesture.
    document.addEventListener("click", onClick);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("popstate", onPopState);
    };
  }, [pathname]);

  const isLoading = bootLoading || navigating || taskCount > 0;

  const value = useMemo<GlobalLoaderContextValue>(
    () => ({
      isLoading,
      startLoading,
      stopLoading,
      withLoading,
    }),
    [isLoading, startLoading, stopLoading, withLoading],
  );

  return (
    <GlobalLoaderContext.Provider value={value}>
      {children}
      {isLoading ? <ActiniumLoaderOverlay label="Loading Actinium-DD…" /> : null}
    </GlobalLoaderContext.Provider>
  );
}

export function useGlobalLoader(): GlobalLoaderContextValue {
  const ctx = useContext(GlobalLoaderContext);
  if (!ctx) {
    throw new Error("useGlobalLoader must be used within GlobalLoaderProvider");
  }
  return ctx;
}

/** Optional hook — safe outside provider (no-op). */
export function useGlobalLoaderOptional(): GlobalLoaderContextValue | null {
  return useContext(GlobalLoaderContext);
}
