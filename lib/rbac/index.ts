export {
  RBAC_USER_TYPES,
  RBAC_USER_TYPE_LABELS,
  RBAC_USER_TYPE_DESCRIPTIONS,
  PORTAL_HOME,
  portalHomeForUserType,
  resolveRbacUserTypeFromRole,
} from "@/lib/rbac/userTypes";
export type { AuthContext, PermissionSeed, SystemRoleSeed, UserRoleAssignment } from "@/lib/rbac/types";
export type { UserScope } from "@/lib/rbac/scopeRules";
export {
  buildUserScope,
  projectScopeWhere,
  assertProjectInUserScope,
  assertVesselInUserScope,
  assertDryDockProjectInUserScope,
  assertYardInviteTokenInUserScope,
  resolveScopedVesselIds,
} from "@/lib/rbac/scopeRules";
export { SYSTEM_ROLES, ROLE_BY_CODE } from "@/lib/rbac/roles";
export { PERMISSIONS, PERMISSION_BY_KEY } from "@/lib/rbac/permissions";
export {
  DEFAULT_ROLE_PERMISSIONS,
  PAGE_ROUTE_PERMISSIONS,
  PROJECT_TAB_PERMISSIONS,
  pagePermissionForPath,
  resolveRolePermissionKeys,
} from "@/lib/rbac/rolePermissions";
export {
  buildAuthContext,
  can,
  canAccessPage,
  getRoleByCode,
  getUserPermissions,
  listPermissions,
  listSystemRoles,
  seedRbacCatalog,
} from "@/lib/db/rbac";
