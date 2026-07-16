import { isSeafarerSharePagePath } from "@/lib/seafarer-share-access";
import { hasMarketingHomeRouteClient } from "@/lib/auth-landing-path";

/** Routes that must never run the office AuthGate or force redirect to /login. */
export function isPublicAppPath(pathname: string): boolean {
  if (!pathname) return false;

  const marketingHome =
    hasMarketingHomeRouteClient() &&
    (pathname === "/home" || pathname.startsWith("/home/"));

  return (
    marketingHome ||
    pathname === "/faq" ||
    pathname.startsWith("/faq/") ||
    pathname === "/knowledge" ||
    pathname.startsWith("/knowledge/") ||
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/vendor/login" ||
    pathname.startsWith("/vendor/login/") ||
    pathname.startsWith("/vendor/") ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/unauthorized" ||
    isSeafarerSharePagePath(pathname)
  );
}

/** Best-effort pathname on the client when the App Router hook is still empty. */
export function resolveClientPathname(routerPathname: string): string {
  const fromRouter = routerPathname.trim();
  if (fromRouter) return fromRouter;
  if (typeof window !== "undefined") {
    return window.location.pathname || "/";
  }
  return fromRouter;
}

export function isPublicAppPathResolved(routerPathname: string): boolean {
  return isPublicAppPath(resolveClientPathname(routerPathname));
}

/** True when logout should not bounce the user to the office /login screen. */
export function shouldSkipOfficeLoginRedirect(pathname: string): boolean {
  return isPublicAppPath(pathname);
}
