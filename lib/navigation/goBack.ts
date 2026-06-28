/** Paths where a back control is hidden (module landing pages). */
const MODULE_ROOTS = new Set([
  "/",
  "/projects",
  "/superintendent",
  "/admin",
  "/shipyard",
  "/ship-access",
  "/login",
  "/compare",
  "/account",
]);

/** Parent URL segment — used when browser history is empty. */
export function getParentPath(pathname: string): string {
  const normalized = pathname.split("?")[0]?.split("#")[0] ?? "/";
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length <= 1) return "/";
  parts.pop();
  return `/${parts.join("/")}`;
}

export function shouldShowPageBack(pathname: string): boolean {
  const normalized = pathname.split("?")[0]?.split("#")[0] ?? "/";
  if (MODULE_ROOTS.has(normalized)) return false;
  return normalized.split("/").filter(Boolean).length >= 2;
}

export function resolveBackFallback(pathname: string, explicit?: string): string {
  return explicit ?? getParentPath(pathname);
}
