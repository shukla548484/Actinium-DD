import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { resolveRolePermissionKeys } from "@/lib/rbac/rolePermissions";
import { LEGACY_ROLE_CODE_ALIASES, SYSTEM_ROLES } from "@/lib/rbac/roles";
import type { AuthContext } from "@/lib/rbac/types";

const notDeleted = { deletedAt: null };

export async function listSystemRoles() {
  return prisma.role.findMany({
    where: { organizationId: null, isSystem: true, ...notDeleted },
    orderBy: { sortOrder: "asc" },
  });
}

export async function listPermissions(module?: string) {
  return prisma.permission.findMany({
    where: module ? { module } : undefined,
    orderBy: [{ module: "asc" }, { sortOrder: "asc" }, { key: "asc" }],
  });
}

export async function getRoleByCode(code: string, organizationId: string | null = null) {
  const resolved = LEGACY_ROLE_CODE_ALIASES[code] ?? code;
  return prisma.role.findFirst({
    where: { code: resolved, organizationId, ...notDeleted },
  });
}

export async function getUserPermissions(userId: string): Promise<Set<string>> {
  const user = await prisma.user.findFirst({
    where: { id: userId, ...notDeleted },
    include: {
      userRoles: {
        where: notDeleted,
        include: {
          role: {
            include: {
              rolePermissions: { include: { permission: true } },
            },
          },
        },
      },
      permissionOverrides: { include: { permission: true } },
    },
  });

  if (!user) return new Set();

  const keys = new Set<string>();

  for (const ur of user.userRoles) {
    for (const rp of ur.role.rolePermissions) {
      keys.add(rp.permission.key);
    }
  }

  for (const ov of user.permissionOverrides) {
    if (ov.granted) keys.add(ov.permission.key);
    else keys.delete(ov.permission.key);
  }

  return keys;
}

export async function buildAuthContext(userId: string): Promise<AuthContext | null> {
  const user = await prisma.user.findFirst({
    where: { id: userId, ...notDeleted },
    include: {
      userRoles: {
        where: notDeleted,
        include: { role: true },
      },
    },
  });

  if (!user) return null;

  const permissions = await getUserPermissions(userId);
  const roleCodes = user.userRoles.map((ur) => ur.role.code);
  const hierarchyLevel = Math.min(
    ...user.userRoles.map((ur) => ur.role.hierarchyLevel),
    99,
  );

  return {
    userId: user.id,
    organizationId: user.organizationId,
    roleCodes,
    permissions,
    hierarchyLevel,
  };
}

export function can(context: AuthContext | null, permission: string): boolean {
  if (!context) return false;
  if (context.permissions.has("platform.tenant.manage")) return true;
  return context.permissions.has(permission);
}

export function canAccessPage(context: AuthContext | null, pagePermission: string): boolean {
  return can(context, pagePermission);
}

async function upsertSystemRole(role: (typeof SYSTEM_ROLES)[number]) {
  const data = {
    roleNo: role.roleNo,
    code: role.code,
    name: role.name,
    userType: role.userType,
    hierarchyLevel: role.hierarchyLevel,
    categoryTier: role.categoryTier,
    approvalLevel: role.approvalLevel,
    reportsToCode: role.reportsToCode,
    jobScope: role.jobScope,
    sortOrder: role.sortOrder,
    designation: role.designation,
    department: role.department,
    description: role.jobScope,
    isSystem: true,
    organizationId: null as null,
  };

  const existing = await prisma.role.findFirst({
    where: { organizationId: null, code: role.code, ...notDeleted },
  });

  if (existing) {
    return prisma.role.update({ where: { id: existing.id }, data });
  }

  return prisma.role.create({ data });
}

/** Idempotent seed — safe to run on every deploy. */
export async function seedRbacCatalog() {
  const allPermissionKeys = PERMISSIONS.map((p) => p.key);

  for (const perm of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      create: {
        key: perm.key,
        module: perm.module,
        resource: perm.resource ?? null,
        appSurface: perm.appSurface ?? null,
        description: perm.description,
        sortOrder: perm.sortOrder ?? 0,
      },
      update: {
        module: perm.module,
        resource: perm.resource ?? null,
        appSurface: perm.appSurface ?? null,
        description: perm.description,
        sortOrder: perm.sortOrder ?? 0,
      },
    });
  }

  const permissionRows = await prisma.permission.findMany();
  const permissionIdByKey = Object.fromEntries(permissionRows.map((p) => [p.key, p.id]));

  for (const role of SYSTEM_ROLES) {
    const row = await upsertSystemRole(role);

    const keys = resolveRolePermissionKeys(role.code, allPermissionKeys);
    for (const key of keys) {
      const permissionId = permissionIdByKey[key];
      if (!permissionId) continue;
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: row.id, permissionId },
        },
        create: { roleId: row.id, permissionId },
        update: {},
      });
    }
  }

  // Retire legacy role codes superseded by the new catalog.
  const retiredCodes = Object.keys(LEGACY_ROLE_CODE_ALIASES);
  await prisma.role.updateMany({
    where: { organizationId: null, code: { in: retiredCodes }, ...notDeleted },
    data: { deletedAt: new Date() },
  });

  return {
    roles: SYSTEM_ROLES.length,
    permissions: PERMISSIONS.length,
  };
}
