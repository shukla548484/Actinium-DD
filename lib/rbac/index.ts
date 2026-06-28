export type { AuthContext, PermissionSeed, SystemRoleSeed, UserRoleAssignment } from "@/lib/rbac/types";
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
