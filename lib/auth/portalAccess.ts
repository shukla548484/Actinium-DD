import type { RbacUserType } from "@prisma/client";
import type { SessionPayload } from "@/lib/auth/session";
import {
  portalHomeForUserType,
  resolveRbacUserTypeFromRole,
} from "@/lib/rbac/userTypes";

/** Route prefixes each user type may access when authenticated. */
export const PORTAL_ROUTE_PREFIXES: Record<RbacUserType, readonly string[]> = {
  system: [
    "/admin",
    "/platform",
    "/office",
    "/projects",
    "/superintendent",
    "/shipyard",
    "/ship-access",
    "/external",
    "/account",
    "/dev",
  ],
  office: ["/admin", "/office", "/projects", "/superintendent", "/account", "/dev"],
  vessel: ["/ship-access", "/account", "/dev"],
  shipyard: ["/shipyard", "/quote", "/account", "/dev"],
  external: ["/external", "/quote", "/account", "/dev"],
};

/** API prefixes aligned with portal surfaces. */
export const PORTAL_API_PREFIXES: Record<RbacUserType, readonly string[]> = {
  system: [
    "/api/admin",
    "/api/projects",
    "/api/superintendent",
    "/api/mtil",
    "/api/shipyard",
    "/api/ship-access",
    "/api/external",
  ],
  office: ["/api/admin", "/api/projects", "/api/superintendent", "/api/mtil"],
  vessel: ["/api/ship-access"],
  shipyard: ["/api/shipyard"],
  external: ["/api/external"],
};

const PUBLIC_PATH_PREFIXES = ["/login", "/api/auth/login", "/api/auth/logout"] as const;

export function resolveSessionUserType(payload: {
  rbacUserType?: RbacUserType;
  isVesselCrew?: boolean;
  officeBootstrap?: boolean;
} | null): RbacUserType {
  if (!payload) return "office";
  if (payload.rbacUserType) return payload.rbacUserType;
  if (payload.isVesselCrew) return "vessel";
  if (payload.officeBootstrap) return "office";
  return "office";
}

export function resolveUserTypeFromRole(
  role: { code: string; userType: string } | null | undefined,
): RbacUserType {
  return resolveRbacUserTypeFromRole(role);
}

export function loginDestinationForUserType(
  userType: RbacUserType,
  nextPath?: string | null,
): string {
  const fallback = portalHomeForUserType(userType);
  const next = nextPath?.trim();
  if (!next || next === "/" || next === "/login") return fallback;

  if (isPathAllowedForUserType(next, userType)) return next;
  return fallback;
}

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isPathAllowedForUserType(pathname: string, userType: RbacUserType): boolean {
  if (isPublicPath(pathname)) return true;
  return PORTAL_ROUTE_PREFIXES[userType].some((prefix) => matchesPrefix(pathname, prefix));
}

export function isApiAllowedForUserType(pathname: string, userType: RbacUserType): boolean {
  if (pathname.startsWith("/api/auth")) return true;
  return PORTAL_API_PREFIXES[userType].some((prefix) => matchesPrefix(pathname, prefix));
}

export function redirectPathForBlockedUserType(
  pathname: string,
  userType: RbacUserType,
): string | null {
  if (isPublicPath(pathname)) return null;
  if (isPathAllowedForUserType(pathname, userType)) return null;
  return portalHomeForUserType(userType);
}

export async function getPortalUserTypeFromPayload(
  payload: SessionPayload | null,
  loadRole?: (userId: string) => Promise<{ code: string; userType: string } | null>,
): Promise<RbacUserType> {
  if (!payload) return "office";
  if (payload.rbacUserType) return payload.rbacUserType;
  if (payload.officeBootstrap) return "office";
  if (payload.isVesselCrew) return "vessel";
  if (payload.userId && loadRole) {
    const role = await loadRole(payload.userId);
    return resolveRbacUserTypeFromRole(role);
  }
  return "office";
}
