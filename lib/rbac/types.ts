import type { AppSurface, RbacScopeType, RbacUserType } from "@prisma/client";

export type SystemRoleSeed = {
  roleNo: number;
  code: string;
  name: string;
  userType: RbacUserType;
  hierarchyLevel: number;
  sortOrder: number;
  designation: string;
  department: string;
  description: string;
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
