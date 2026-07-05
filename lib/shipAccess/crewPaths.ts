/** Paths crew users may access (office modules are blocked). Edge-safe — no Node/server imports. */
export const CREW_ALLOWED_PATH_PREFIXES = [
  "/ship-access",
  "/account/password",
  "/login",
] as const;

export function isCrewAllowedPath(pathname: string): boolean {
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname.startsWith("/api/ship-access")) return true;
  return CREW_ALLOWED_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
