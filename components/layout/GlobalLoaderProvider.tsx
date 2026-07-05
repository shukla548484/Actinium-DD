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

function isInternalNavigationLink(anchor: HTMLAnchorElement, pathname: string): boolean {
  if (anchor.target && anchor.target !== "_self") return false;
  if (anchor.hasAttribute("download")) return false;
  if (anchor.getAttribute("href")?.startsWith("#")) return false;

  const href = anchor.getAttribute("href");
  if (!href) return false;

  try {
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin) return false;
    if (url.pathname === pathname && !url.search) return false;
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

  /** First paint / hydration — hide once document is ready. */
  useEffect(() => {
    if (document.readyState === "complete") {
      setBootLoading(false);
      return;
    }
    const onReady = () => setBootLoading(false);
    window.addEventListener("load", onReady);
    document.addEventListener("readystatechange", onReady);
    return () => {
      window.removeEventListener("load", onReady);
      document.removeEventListener("readystatechange", onReady);
    };
  }, []);

  /** Route arrived — clear navigation overlay after content paints. */
  useEffect(() => {
    if (!navigating) return;
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setNavigating(false));
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname, navigating]);

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

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick, true);
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
