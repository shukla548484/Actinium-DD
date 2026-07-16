/**
 * Tracks routes that use explicit `usePageBootstrap` / PageReadyGate so the shell
 * does not auto-complete before page data is loaded.
 */

let explicitPath: string | null = null;

function normalizePath(path: string): string {
  if (!path) return "/";
  const base = path.split("?")[0]?.split("#")[0] ?? path;
  return base.length > 1 && base.endsWith("/") ? base.slice(0, -1) : base;
}

export function registerExplicitPageBootstrap(pathname: string): void {
  explicitPath = normalizePath(pathname);
}

export function clearExplicitPageBootstrap(pathname?: string): void {
  if (!pathname) {
    explicitPath = null;
    return;
  }
  const norm = normalizePath(pathname);
  if (explicitPath === norm) explicitPath = null;
}

export function hasExplicitPageBootstrap(pathname: string): boolean {
  return explicitPath === normalizePath(pathname);
}
