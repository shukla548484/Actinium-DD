import type { AppSurface, RbacScopeType, RbacUserType } from "@prisma/client";

export type RoleCategoryTier =
  | "system"
  | "company"
  | "department"
  | "office"
  | "vessel"
  | "external";

export type SystemRoleSeed = {
  roleNo: number;
  code: string;
  name: string;
  userType: RbacUserType;
  /** Designation tier 1–6 (1000s=1 … 6000s=6). */
  hierarchyLevel: number;
  /** Spreadsheet category band. */
  categoryTier: RoleCategoryTier;
  /** Sign-off authority 1–5 (higher = more approval power). */
  approvalLevel: number;
  /** Role code of reporting manager, or null for top of chain. */
  reportsToCode: string | null;
  sortOrder: number;
  designation: string;
  department: string;
  /** Full job scope from designation catalog. */
  jobScope: string;
  /** @deprecated Use jobScope — kept for DB description column sync. */
  description?: string;
};

export type PermissionSeed = {
  key: string;
  module: string;
  resource?: string;
  appSurface?: AppSurface;
  description: string;
  sortOrder?: number;
};

export type UserRoleAssignment = {
  roleCode: string;
  scopeType?: RbacScopeType;
  scopeId?: string | null;
};

export type AuthContext = {
  userId: string;
  organizationId: string | null;
  roleCodes: string[];
  permissions: Set<string>;
  hierarchyLevel: number;
};
