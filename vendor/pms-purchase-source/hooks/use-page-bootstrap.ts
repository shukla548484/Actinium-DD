import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { signalPageReady } from "@/lib/page-ready-coordinator";
import { markNavigationStart } from "@/lib/performance/page-ready-timing";
import {
  registerExplicitPageBootstrap,
  clearExplicitPageBootstrap,
} from "@/lib/page-bootstrap-registry";

export type PageBootstrapState = {
  /** First successful load completed; safe to render interactive UI */
  ready: boolean;
  /** Fatal error on initial load (optional) */
  error: string | null;
  setReady: (v: boolean) => void;
  setError: (msg: string | null) => void;
  /** Call after a successful initial fetch */
  markSuccess: () => void;
  /** Call after initial fetch fails */
  markFailure: (message: string) => void;
  /** Reset before retry from error state */
  reset: () => void;
};

/**
 * Tracks “initial page bootstrap” separately from refetch `loading` flags.
 * Typical pattern: `markSuccess()` in try after setting state; `markFailure(msg)` in catch; keep `loading` for spinners inside the page after ready.
 */
export function usePageBootstrap(): PageBootstrapState {
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const signaledPathRef = useRef<string | null>(null);

  const markSuccess = useCallback(() => {
    setError(null);
    setReady(true);
  }, []);

  useEffect(() => {
    if (!pathname) return;
    markNavigationStart(pathname);
    registerExplicitPageBootstrap(pathname);
    setReady(false);
    setError(null);
    signaledPathRef.current = null;
    return () => {
      clearExplicitPageBootstrap(pathname);
    };
  }, [pathname]);

  useEffect(() => {
    if (!ready || !pathname) return;
    if (signaledPathRef.current === pathname) return;
    signaledPathRef.current = pathname;
    signalPageReady(pathname);
  }, [ready, pathname]);

  const markFailure = useCallback((message: string) => {
    setError(message);
    setReady(false);
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setReady(false);
  }, []);

  return useMemo(
    () => ({
      ready,
      error,
      setReady,
      setError,
      markSuccess,
      markFailure,
      reset,
    }),
    [ready, error, setReady, setError, markSuccess, markFailure, reset]
  );
}
