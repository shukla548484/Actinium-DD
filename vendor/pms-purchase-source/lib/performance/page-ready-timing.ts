/**
 * Dev-only navigation → page-ready timing (console + Performance API).
 * Enable verbose logs: localStorage.setItem('perf:page-ready', '1')
 */

const STORAGE_KEY = "perf:page-ready";

function isEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NODE_ENV !== "development") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

let navigationStartedAt = 0;
let navigationPath = "";

export function markNavigationStart(pathname: string): void {
  if (typeof performance === "undefined") return;
  navigationPath = pathname;
  navigationStartedAt = performance.now();
  try {
    performance.mark(`nav-start:${pathname}`);
  } catch {
    /* ignore duplicate marks */
  }
}

export function reportPageReady(pathname: string): void {
  if (typeof performance === "undefined" || !navigationStartedAt) return;

  const elapsedMs = Math.round(performance.now() - navigationStartedAt);
  const sameRoute = navigationPath === pathname;

  try {
    if (sameRoute) {
      performance.mark(`page-ready:${pathname}`);
      performance.measure(`page-ready:${pathname}`, `nav-start:${pathname}`, `page-ready:${pathname}`);
    }
  } catch {
    /* marks may be missing on rapid navigations */
  }

  if (isEnabled()) {
    const label = sameRoute ? pathname : `${navigationPath} → ${pathname}`;
    console.info(
      `%c[page-ready]%c ${label} %c${elapsedMs}ms`,
      "color:#059669;font-weight:bold",
      "color:inherit",
      "color:#2563eb;font-weight:bold"
    );
  }

  navigationStartedAt = 0;
  navigationPath = "";
}
