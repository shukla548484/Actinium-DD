import type { RbacUserType } from "@prisma/client";

/** Canonical RBAC user types — each maps to a dedicated portal surface. */
export const RBAC_USER_TYPES = [
  "system",
  "office",
  "vessel",
  "shipyard",
  "external",
] as const satisfies readonly RbacUserType[];

export const RBAC_USER_TYPE_LABELS: Record<RbacUserType, string> = {
  system: "System",
  office: "Office",
  vessel: "Vessel",
  shipyard: "Shipyard",
  external: "External",
};

export const RBAC_USER_TYPE_DESCRIPTIONS: Record<RbacUserType, string> = {
  system: "Platform administrators with full access",
  office: "Shore office — fleet, superintendent, and company admin",
  vessel: "Onboard crew — ship access portal",
  shipyard: "Dockyard execution — workshops, planning, and job board",
  external: "Vendors, makers, class, and other external parties",
};

/** Default landing route after sign-in for each user type. */
export const PORTAL_HOME: Record<RbacUserType, string> = {
  system: "/admin",
  office: "/projects",
  vessel: "/ship-access",
  shipyard: "/shipyard",
  external: "/external",
};

/** Roles that always resolve to the shipyard user type. */
export const SHIPYARD_ROLE_CODES = new Set([
  "YARD_PM",
  "YARD_PLAN",
  "YARD_HULL",
  "YARD_STEEL",
  "YARD_PAINT",
  "YARD_MACH",
  "YARD_ELEC",
  "YARD_PIPE",
  "YARD_QA",
  "YARD_SAFETY",
  "YARD_COMM",
  /** @deprecated */
  "SHIPYARD",
]);

export function rbacUserTypeLabel(userType: RbacUserType | string): string {
  return RBAC_USER_TYPE_LABELS[userType as RbacUserType] ?? userType;
}

export function portalHomeForUserType(userType: RbacUserType): string {
  return PORTAL_HOME[userType];
}

export function resolveRbacUserTypeFromRole(
  role: { code: string; userType: string } | null | undefined,
): RbacUserType {
  if (!role) return "office";
  if (role.userType === "shipyard" || SHIPYARD_ROLE_CODES.has(role.code)) return "shipyard";
  if (role.userType === "vessel") return "vessel";
  if (role.userType === "system") return "system";
  if (role.userType === "external") return "external";
  return "office";
}

export function isVesselUserType(userType: RbacUserType | string | null | undefined): boolean {
  return userType === "vessel";
}

export function isShipyardUserType(userType: RbacUserType | string | null | undefined): boolean {
  return userType === "shipyard";
}

export function isExternalUserType(userType: RbacUserType | string | null | undefined): boolean {
  return userType === "external";
}

export function isOfficeUserType(userType: RbacUserType | string | null | undefined): boolean {
  return userType === "office";
}

export function isSystemUserType(userType: RbacUserType | string | null | undefined): boolean {
  return userType === "system";
}

/** Office and system users share the office portal (system additionally reaches admin). */
export function usesOfficePortal(userType: RbacUserType | string | null | undefined): boolean {
  return userType === "office" || userType === "system";
}
