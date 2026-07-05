import { getSessionUserId } from "@/lib/auth/session";
import { buildAuthContext, getUserPermissions } from "@/lib/db/rbac";
import { getUserById } from "@/lib/db/employeeAuth";
import { buildUserScope, resolveScopedVesselIds } from "@/lib/rbac/scopeRules";
import { prisma } from "@/lib/prisma";

/** Cached auth payload for desktop / offline clients (refresh on sync). */
export async function buildAuthSnapshot(userId: string) {
  const [user, ctx, employee, scope] = await Promise.all([
    getUserById(userId),
    buildAuthContext(userId),
    prisma.employee.findFirst({
      where: { userId, deletedAt: null },
      select: {
        id: true,
        companyId: true,
        vesselAssignments: {
          where: { signOffDate: null },
          select: { vesselId: true },
        },
      },
    }),
    buildUserScope(userId),
  ]);

  if (!user || !ctx) return null;

  const permissions = await getUserPermissions(userId);
  const assignmentVesselIds = employee?.vesselAssignments.map((a) => a.vesselId) ?? [];
  const scopedVesselIds = await resolveScopedVesselIds(scope);

  return {
    userId,
    loginId: user.loginId,
    displayName: user.displayName,
    rbacUserType: user.rbacUserType,
    roleCodes: ctx.roleCodes,
    permissions: [...permissions],
    hierarchyLevel: ctx.hierarchyLevel,
    organizationId: ctx.organizationId,
    employeeId: employee?.id ?? null,
    assignedVesselIds: assignmentVesselIds,
    scopes: {
      unrestricted: scope.unrestricted,
      vesselIds: scope.unrestricted ? null : (scopedVesselIds ?? []),
      projectIds: scope.projectIds,
      yardInviteIds: scope.yardInviteIds,
    },
    validUntil: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    capturedAt: new Date().toISOString(),
  };
}

export async function getAuthSnapshotForSession() {
  const userId = await getSessionUserId();
  if (!userId) return null;
  return buildAuthSnapshot(userId);
}
