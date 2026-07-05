import type { Prisma, RbacScopeType } from "@prisma/client";
import { NextResponse } from "next/server";
import { getUserPermissions } from "@/lib/db/rbac";
import { notDeleted } from "@/lib/superintendent/helpers";
import { prisma } from "@/lib/prisma";

/** Resolved RBAC scope for a signed-in user (permissions + scope dimensions). */
export type UserScope = {
  /** No vessel/project/invite filtering — org admin, system roles, etc. */
  unrestricted: boolean;
  vesselIds: string[];
  projectIds: string[];
  yardInviteIds: string[];
};

const ORG_WIDE_SCOPE_TYPES: RbacScopeType[] = ["organization", "system"];

export function emptyUserScope(): UserScope {
  return { unrestricted: false, vesselIds: [], projectIds: [], yardInviteIds: [] };
}

export function unrestrictedUserScope(): UserScope {
  return { unrestricted: true, vesselIds: [], projectIds: [], yardInviteIds: [] };
}

/** Load vessel / project / yard-invite scope from UserRole rows + employee assignments. */
export async function buildUserScope(userId: string): Promise<UserScope> {
  const [userRoles, employee, permissions] = await Promise.all([
    prisma.userRole.findMany({
      where: { userId, ...notDeleted },
      select: { scopeType: true, scopeId: true },
    }),
    prisma.employee.findFirst({
      where: { userId, ...notDeleted, status: "active" },
      select: {
        vesselAssignments: {
          where: { signOffDate: null, vessel: { ...notDeleted, status: "active" } },
          select: { vesselId: true },
        },
      },
    }),
    getUserPermissions(userId),
  ]);

  if (permissions.has("platform.tenant.manage")) {
    return unrestrictedUserScope();
  }

  if (userRoles.some((ur) => ORG_WIDE_SCOPE_TYPES.includes(ur.scopeType))) {
    return unrestrictedUserScope();
  }

  const vesselIds = new Set<string>();
  const projectIds = new Set<string>();
  const yardInviteIds = new Set<string>();

  for (const ur of userRoles) {
    if (!ur.scopeId) continue;
    if (ur.scopeType === "vessel") vesselIds.add(ur.scopeId);
    if (ur.scopeType === "project") projectIds.add(ur.scopeId);
    if (ur.scopeType === "yard_invite") yardInviteIds.add(ur.scopeId);
  }

  for (const a of employee?.vesselAssignments ?? []) {
    vesselIds.add(a.vesselId);
  }

  const hasRestriction = vesselIds.size > 0 || projectIds.size > 0 || yardInviteIds.size > 0;
  if (!hasRestriction) {
    return unrestrictedUserScope();
  }

  return {
    unrestricted: false,
    vesselIds: [...vesselIds],
    projectIds: [...projectIds],
    yardInviteIds: [...yardInviteIds],
  };
}

export function vesselScopeWhere(vesselIds: string[] | undefined): Prisma.VesselWhereInput {
  if (vesselIds === undefined) return {};
  if (vesselIds.length === 0) return { id: { in: [] } };
  return { id: { in: vesselIds } };
}

export function dryDockProjectScopeWhere(
  vesselIds: string[] | undefined,
): Prisma.DryDockProjectWhereInput {
  if (vesselIds === undefined) return {};
  if (vesselIds.length === 0) return { vesselId: { in: [] } };
  return { vesselId: { in: vesselIds } };
}

/** Prisma filter for tender projects visible to this scope. */
export function projectScopeWhere(scope: UserScope): Prisma.ProjectWhereInput {
  if (scope.unrestricted) return {};

  const or: Prisma.ProjectWhereInput[] = [];

  if (scope.projectIds.length > 0) {
    or.push({ id: { in: scope.projectIds } });
  }

  if (scope.vesselIds.length > 0) {
    or.push({ vesselId: { in: scope.vesselIds } });
  }

  if (scope.yardInviteIds.length > 0) {
    or.push({ yardInvites: { some: { id: { in: scope.yardInviteIds }, ...notDeleted } } });
  }

  if (or.length === 0) return { id: { in: [] } };
  return { OR: or };
}

export async function resolveScopedVesselIds(scope: UserScope): Promise<string[] | undefined> {
  if (scope.unrestricted) return undefined;

  const ids = new Set(scope.vesselIds);

  if (scope.projectIds.length > 0) {
    const rows = await prisma.project.findMany({
      where: { id: { in: scope.projectIds }, vesselId: { not: null }, ...notDeleted },
      select: { vesselId: true },
    });
    for (const r of rows) {
      if (r.vesselId) ids.add(r.vesselId);
    }

    const ddRows = await prisma.dryDockProject.findMany({
      where: { projectId: { in: scope.projectIds }, ...notDeleted },
      select: { vesselId: true },
    });
    for (const r of ddRows) ids.add(r.vesselId);
  }

  return [...ids];
}

export async function assertVesselInUserScope(
  vesselId: string,
  scope: UserScope,
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  if (scope.unrestricted) return { ok: true };

  const allowed = await resolveScopedVesselIds(scope);
  if (allowed === undefined || allowed.includes(vesselId)) return { ok: true };

  return {
    ok: false,
    response: NextResponse.json({ error: "Forbidden — vessel not in your scope" }, { status: 403 }),
  };
}

export async function assertProjectInUserScope(
  projectId: string,
  scope: UserScope,
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  if (scope.unrestricted) return { ok: true };

  if (scope.projectIds.includes(projectId)) return { ok: true };

  if (scope.yardInviteIds.length > 0) {
    const linked = await prisma.yardInvite.findFirst({
      where: {
        projectId,
        id: { in: scope.yardInviteIds },
        ...notDeleted,
      },
      select: { id: true },
    });
    if (linked) return { ok: true };
  }

  if (scope.vesselIds.length > 0) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, ...notDeleted },
      select: { vesselId: true },
    });
    if (project?.vesselId && scope.vesselIds.includes(project.vesselId)) {
      return { ok: true };
    }
  }

  return {
    ok: false,
    response: NextResponse.json({ error: "Forbidden — project not in your scope" }, { status: 403 }),
  };
}

export async function assertDryDockProjectInUserScope(
  dryDockProjectId: string,
  scope: UserScope,
): Promise<{ ok: true; vesselId: string } | { ok: false; response: NextResponse }> {
  const project = await prisma.dryDockProject.findFirst({
    where: { id: dryDockProjectId, ...notDeleted },
    select: { vesselId: true, projectId: true },
  });

  if (!project) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Dry dock project not found" }, { status: 404 }),
    };
  }

  if (scope.unrestricted) return { ok: true, vesselId: project.vesselId };

  const allowedVessels = await resolveScopedVesselIds(scope);
  if (allowedVessels !== undefined && !allowedVessels.includes(project.vesselId)) {
    if (project.projectId && scope.projectIds.includes(project.projectId)) {
      return { ok: true, vesselId: project.vesselId };
    }
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden — vessel not in your scope" }, { status: 403 }),
    };
  }

  if (project.projectId && scope.projectIds.includes(project.projectId)) {
    return { ok: true, vesselId: project.vesselId };
  }

  if (allowedVessels !== undefined && allowedVessels.includes(project.vesselId)) {
    return { ok: true, vesselId: project.vesselId };
  }

  if (!scope.unrestricted && scope.projectIds.length === 0 && scope.vesselIds.length === 0) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden — project not in your scope" }, { status: 403 }),
    };
  }

  return { ok: true, vesselId: project.vesselId };
}

/** When logged in, yard-invite-scoped users may only open assigned invite tokens. */
export async function assertYardInviteTokenInUserScope(
  token: string,
  scope: UserScope,
): Promise<{ ok: true; inviteId: string } | { ok: false; response: NextResponse }> {
  const invite = await prisma.yardInvite.findFirst({
    where: { token, ...notDeleted },
    select: { id: true },
  });

  if (!invite) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Invalid or expired quote link." }, { status: 404 }),
    };
  }

  if (scope.unrestricted || scope.yardInviteIds.length === 0) {
    return { ok: true, inviteId: invite.id };
  }

  if (!scope.yardInviteIds.includes(invite.id)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "This quote link is not in your assigned scope." },
        { status: 403 },
      ),
    };
  }

  return { ok: true, inviteId: invite.id };
}

/** Dry dock project filter for list queries under a user scope. */
export async function dryDockProjectWhereForScope(
  scope: UserScope,
): Promise<Prisma.DryDockProjectWhereInput> {
  if (scope.unrestricted) return {};

  const or: Prisma.DryDockProjectWhereInput[] = [];

  if (scope.projectIds.length > 0) {
    or.push({ projectId: { in: scope.projectIds } });
    or.push({ id: { in: scope.projectIds } });
  }

  const vesselIds = await resolveScopedVesselIds(scope);
  if (vesselIds && vesselIds.length > 0) {
    or.push({ vesselId: { in: vesselIds } });
  }

  if (or.length === 0) return { id: { in: [] } };
  return { OR: or };
}
