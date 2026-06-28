import { prisma } from "@/lib/prisma";
import type { AppSurface, RbacUserType } from "@prisma/client";

const notDeleted = { deletedAt: null };

export type RoleWithPermissions = Awaited<ReturnType<typeof getRoleWithPermissions>>;

export async function listRolesWithPermissionCounts(userType?: RbacUserType) {
  const roles = await prisma.role.findMany({
    where: {
      organizationId: null,
      isSystem: true,
      ...notDeleted,
      ...(userType ? { userType } : {}),
    },
    orderBy: { sortOrder: "asc" },
    include: {
      _count: { select: { rolePermissions: true, userRoles: true } },
    },
  });

  return roles.map((r) => ({
    id: r.id,
    roleNo: r.roleNo,
    code: r.code,
    name: r.name,
    userType: r.userType,
    hierarchyLevel: r.hierarchyLevel,
    designation: r.designation,
    department: r.department,
    description: r.description,
    permissionCount: r._count.rolePermissions,
    userCount: r._count.userRoles,
  }));
}

export async function getRoleWithPermissions(roleId: string) {
  return prisma.role.findFirst({
    where: { id: roleId, ...notDeleted },
    include: {
      rolePermissions: { include: { permission: true } },
      _count: { select: { userRoles: true } },
    },
  });
}

export async function listPermissionsGrouped(module?: string) {
  const rows = await prisma.permission.findMany({
    where: module ? { module } : undefined,
    orderBy: [{ module: "asc" }, { sortOrder: "asc" }, { key: "asc" }],
  });

  const byModule = new Map<string, typeof rows>();
  for (const p of rows) {
    const list = byModule.get(p.module) ?? [];
    list.push(p);
    byModule.set(p.module, list);
  }

  return Object.fromEntries(byModule);
}

export async function listPagePermissions(appSurface?: AppSurface) {
  return prisma.permission.findMany({
    where: {
      module: "page",
      ...(appSurface ? { appSurface } : {}),
    },
    orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
  });
}

/** Replace all permissions for a role (page + action keys). */
export async function setRolePermissions(roleId: string, permissionKeys: string[]) {
  const role = await prisma.role.findFirst({ where: { id: roleId, ...notDeleted } });
  if (!role) return null;

  const permissions = await prisma.permission.findMany({
    where: { key: { in: permissionKeys } },
  });

  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId } }),
    prisma.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId, permissionId: p.id })),
      skipDuplicates: true,
    }),
  ]);

  return getRoleWithPermissions(roleId);
}

/** Merge page permission keys onto existing role permissions (non-page keys preserved). */
export async function setRolePagePermissions(roleId: string, pagePermissionKeys: string[]) {
  const role = await prisma.role.findFirst({ where: { id: roleId, ...notDeleted } });
  if (!role) return null;

  const pagePermissions = await prisma.permission.findMany({
    where: { module: "page" },
  });
  const pageIds = new Set(pagePermissions.map((p) => p.id));
  const selectedPageIds = new Set(
    pagePermissions.filter((p) => pagePermissionKeys.includes(p.key)).map((p) => p.id),
  );

  const existing = await prisma.rolePermission.findMany({
    where: { roleId },
  });

  const keepNonPage = existing.filter((rp) => !pageIds.has(rp.permissionId));
  const newPageRows = [...selectedPageIds].map((permissionId) => ({ roleId, permissionId }));

  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId } }),
    prisma.rolePermission.createMany({
      data: [...keepNonPage.map((r) => ({ roleId, permissionId: r.permissionId })), ...newPageRows],
      skipDuplicates: true,
    }),
  ]);

  return getRoleWithPermissions(roleId);
}

export async function getAdminStats() {
  const [
    roleCount,
    permissionCount,
    pagePermissionCount,
    userCount,
    companyCount,
    vesselCount,
    employeeCount,
  ] = await Promise.all([
    prisma.role.count({ where: { organizationId: null, isSystem: true, ...notDeleted } }),
    prisma.permission.count(),
    prisma.permission.count({ where: { module: "page" } }),
    prisma.user.count({ where: notDeleted }),
    prisma.company.count({ where: notDeleted }),
    prisma.vessel.count({ where: notDeleted }),
    prisma.employee.count({ where: notDeleted }),
  ]);

  return {
    roleCount,
    permissionCount,
    pagePermissionCount,
    userCount,
    companyCount,
    vesselCount,
    employeeCount,
  };
}
