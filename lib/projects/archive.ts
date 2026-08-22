import { NextResponse } from "next/server";
import type { AuthContext } from "@/lib/rbac/types";
import { buildAuthContext, can } from "@/lib/db/rbac";
import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/superintendent/helpers";
import {
  buildUserScope,
  dryDockProjectScopeWhere,
  projectScopeWhere,
  resolveScopedVesselIds,
} from "@/lib/rbac/scopeRules";
import { getScopedVesselIds } from "@/lib/superintendent/scope";

/** Only admins may permanently soft-delete projects. */
export function canHardDeleteProjects(auth: AuthContext | null): boolean {
  if (!auth) return false;
  if (can(auth, "platform.tenant.manage") || can(auth, "*")) return true;
  if (can(auth, "project.delete")) return true;
  return auth.roleCodes.includes("SYS_ADMIN") || auth.roleCodes.includes("COMP_ADMIN");
}

export function denyProjectDeleteUnlessAdmin(
  auth: AuthContext | null,
): NextResponse | null {
  if (canHardDeleteProjects(auth)) return null;
  return NextResponse.json(
    {
      error:
        "Only an administrator can delete a project. Archive it instead so it moves to your Archived section.",
    },
    { status: 403 },
  );
}

/** Archiver or admin may restore an archived project. */
export function canUnarchiveProject(
  auth: AuthContext | null,
  userId: string | null,
  archivedByUserId: string | null,
): boolean {
  if (!auth || !userId) return false;
  if (canHardDeleteProjects(auth)) return true;
  return archivedByUserId != null && archivedByUserId === userId;
}

export function denyUnarchiveUnlessAllowed(
  auth: AuthContext | null,
  userId: string | null,
  archivedByUserId: string | null,
): NextResponse | null {
  if (canUnarchiveProject(auth, userId, archivedByUserId)) return null;
  return NextResponse.json(
    {
      error:
        "Only the user who archived this project, or an administrator, can unarchive it.",
    },
    { status: 403 },
  );
}

export const notArchived = { archivedAt: null } as const;

/** Archive a tender project and any linked dry-dock workspaces. */
export async function archiveTenderProject(projectId: string, userId: string) {
  const now = new Date();
  await prisma.$transaction([
    prisma.project.update({
      where: { id: projectId },
      data: {
        archivedAt: now,
        archivedByUserId: userId,
        officeChangedAt: now,
      },
    }),
    prisma.dryDockProject.updateMany({
      where: { projectId, ...notDeleted, archivedAt: null },
      data: {
        archivedAt: now,
        archivedByUserId: userId,
        status: "archived",
      },
    }),
  ]);
}

export async function archiveDryDockProject(projectId: string, userId: string) {
  const now = new Date();
  return prisma.dryDockProject.update({
    where: { id: projectId },
    data: {
      archivedAt: now,
      archivedByUserId: userId,
      status: "archived",
    },
  });
}

/** Restore a tender project and linked dry-dock workspaces that were archived with it. */
export async function unarchiveTenderProject(projectId: string) {
  const now = new Date();
  await prisma.$transaction([
    prisma.project.update({
      where: { id: projectId },
      data: {
        archivedAt: null,
        archivedByUserId: null,
        officeChangedAt: now,
      },
    }),
    prisma.dryDockProject.updateMany({
      where: { projectId, ...notDeleted, archivedAt: { not: null } },
      data: {
        archivedAt: null,
        archivedByUserId: null,
        status: "reopened",
      },
    }),
  ]);
}

export async function unarchiveDryDockProject(projectId: string) {
  return prisma.dryDockProject.update({
    where: { id: projectId },
    data: {
      archivedAt: null,
      archivedByUserId: null,
      status: "reopened",
    },
  });
}

export type ArchivedProjectRow = {
  id: string;
  kind: "tender" | "dryDock";
  name: string;
  referenceCode: string | null;
  status: string;
  vesselLabel: string | null;
  archivedAt: string;
  archivedByUserId: string | null;
  canUnarchive: boolean;
  href: string;
};

/** Archived projects visible to this user (vessel / RBAC scope). */
export async function listArchivedProjectsForUser(
  userId: string,
): Promise<ArchivedProjectRow[]> {
  const [scope, vesselIds, auth] = await Promise.all([
    buildUserScope(userId),
    getScopedVesselIds(),
    buildAuthContext(userId),
  ]);

  if (vesselIds?.length === 0 && !scope.unrestricted && scope.projectIds.length === 0) {
    return [];
  }

  const resolvedVessels =
    vesselIds === undefined ? await resolveScopedVesselIds(scope) : vesselIds;

  const [tenders, dryDocks] = await Promise.all([
    prisma.project.findMany({
      where: {
        ...notDeleted,
        archivedAt: { not: null },
        ...projectScopeWhere(scope),
      },
      orderBy: { archivedAt: "desc" },
      take: 200,
      select: {
        id: true,
        name: true,
        referenceCode: true,
        status: true,
        vesselName: true,
        archivedAt: true,
        archivedByUserId: true,
        vessel: { select: { name: true, code: true } },
      },
    }),
    prisma.dryDockProject.findMany({
      where: {
        ...notDeleted,
        archivedAt: { not: null },
        ...dryDockProjectScopeWhere(resolvedVessels),
      },
      orderBy: { archivedAt: "desc" },
      take: 200,
      select: {
        id: true,
        name: true,
        referenceCode: true,
        status: true,
        archivedAt: true,
        archivedByUserId: true,
        vessel: { select: { name: true, code: true } },
      },
    }),
  ]);

  const rows: ArchivedProjectRow[] = [
    ...tenders.map((p) => ({
      id: p.id,
      kind: "tender" as const,
      name: p.name,
      referenceCode: p.referenceCode,
      status: p.status,
      vesselLabel: p.vessel
        ? `${p.vessel.name} (${p.vessel.code})`
        : p.vesselName,
      archivedAt: p.archivedAt!.toISOString(),
      archivedByUserId: p.archivedByUserId,
      canUnarchive: canUnarchiveProject(auth, userId, p.archivedByUserId),
      href: `/projects/${p.id}`,
    })),
    ...dryDocks.map((p) => ({
      id: p.id,
      kind: "dryDock" as const,
      name: p.name,
      referenceCode: p.referenceCode,
      status: p.status,
      vesselLabel: `${p.vessel.name} (${p.vessel.code})`,
      archivedAt: p.archivedAt!.toISOString(),
      archivedByUserId: p.archivedByUserId,
      canUnarchive: canUnarchiveProject(auth, userId, p.archivedByUserId),
      href: `/superintendent/projects/${p.id}`,
    })),
  ];

  rows.sort((a, b) => b.archivedAt.localeCompare(a.archivedAt));
  return rows;
}
