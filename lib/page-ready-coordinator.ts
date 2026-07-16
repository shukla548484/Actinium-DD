/**
 * Coordinates shell background work (notifications, idle warm) after the active page
 * has finished its initial bootstrap — avoids competing with route data on navigation.
 */

import { reportPageReady } from "@/lib/performance/page-ready-timing";

export const PAGE_READY_EVENT = "act-page-ready";
export const CHROME_READY_EVENT = "act-chrome-ready";

export function signalPageReady(pathname?: string): void {
  if (typeof window === "undefined") return;
  const path = pathname ?? window.location.pathname;
  reportPageReady(path);
  window.dispatchEvent(
    new CustomEvent(PAGE_READY_EVENT, {
      detail: { pathname: path, at: Date.now() },
    })
  );
}

/** Header badges (notifications + tasks counts) finished loading for the active route. */
export function signalChromeDataReady(pathname?: string): void {
  if (typeof window === "undefined") return;
  const path = pathname ?? window.location.pathname;
  window.dispatchEvent(
    new CustomEvent(CHROME_READY_EVENT, {
      detail: { pathname: path, at: Date.now() },
    })
  );
}

export function subscribePageReady(handler: (pathname: string) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (e: Event) => {
    const ce = e as CustomEvent<{ pathname?: string }>;
    handler(ce.detail?.pathname ?? window.location.pathname);
  };
  window.addEventListener(PAGE_READY_EVENT, listener);
  return () => window.removeEventListener(PAGE_READY_EVENT, listener);
}

export function subscribeChromeDataReady(handler: (pathname: string) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (e: Event) => {
    const ce = e as CustomEvent<{ pathname?: string }>;
    handler(ce.detail?.pathname ?? window.location.pathname);
  };
  window.addEventListener(CHROME_READY_EVENT, listener);
  return () => window.removeEventListener(CHROME_READY_EVENT, listener);
}

/** Routes allowed to use Next.js hover prefetch (high-traffic only). */
export const HOVER_PREFETCH_ROUTES = new Set([
  "/purchase/view-requisitions",
  "/purchase/purchase-orders",
  "/purchase/dashboard",
  "/defects/monitoring",
  "/defects/reports",
  "/maindashboard-new",
  "/maindashboard",
  "/technical/dashboard",
  "/hseq/dashboard",
]);

export function shouldHoverPrefetch(href: string): boolean {
  const base = href.split("?")[0] ?? href;
  return HOVER_PREFETCH_ROUTES.has(base);
}
