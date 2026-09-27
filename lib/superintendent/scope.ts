import { cookies } from "next/headers";
import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import {
  buildUserScope,
  dryDockProjectScopeWhere as rbacDryDockProjectScopeWhere,
  resolveScopedVesselIds,
} from "@/lib/rbac/scopeRules";
import { notDeleted } from "@/lib/superintendent/helpers";
import { prisma } from "@/lib/prisma";

export const SUPERINTENDENT_EMPLOYEE_COOKIE = "superintendent_employee_id";
/** Durable session active dry-dock project for Tech Superintendent navigation. */
export const SUPERINTENDENT_ACTIVE_PROJECT_COOKIE = "superintendent_active_project_id";

export const ACTIVE_PROJECT_COOKIE_MAX_AGE = 60 * 60 * 24 * 90;

/** undefined = unrestricted (platform admin); [] = no vessels; string[] = assigned vessels */
export async function getScopedVesselIds(): Promise<string[] | undefined> {
  const jar = await cookies();
  const employeeId = jar.get(SUPERINTENDENT_EMPLOYEE_COOKIE)?.value?.trim();

  if (employeeId) {
    const assignments = await prisma.employeeVessel.findMany({
      where: {
        employeeId,
        signOffDate: null,
        employee: { ...notDeleted, status: "active" },
        vessel: { ...notDeleted, status: "active" },
      },
      select: { vesselId: true },
    });
    return assignments.map((a) => a.vesselId);
  }

  const userId = await getSessionUserId();
  if (!userId) return [];

  const scope = await buildUserScope(userId);
  return resolveScopedVesselIds(scope);
}

export function vesselScopeWhere(
  vesselIds: string[] | undefined,
): Prisma.VesselWhereInput {
  if (vesselIds === undefined) return {};
  if (vesselIds.length === 0) return { id: { in: [] } };
  return { id: { in: vesselIds } };
}

export function dryDockProjectScopeWhere(
  vesselIds: string[] | undefined,
): Prisma.DryDockProjectWhereInput {
  return rbacDryDockProjectScopeWhere(vesselIds);
}

export async function assertDryDockProjectInScope(
  dryDockProjectId: string,
): Promise<{ ok: true; vesselId: string } | { ok: false; response: NextResponse }> {
  const userId = await getSessionUserId();
  const vesselIds = await getScopedVesselIds();

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

  if (vesselIds !== undefined && !vesselIds.includes(project.vesselId)) {
    if (userId) {
      const scope = await buildUserScope(userId);
      if (project.projectId && scope.projectIds.includes(project.projectId)) {
        return { ok: true, vesselId: project.vesselId };
      }
    }
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden — vessel not in your scope" }, { status: 403 }),
    };
  }

  return { ok: true, vesselId: project.vesselId };
}

export async function assertVesselInScope(
  vesselId: string,
): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
  const vesselIds = await getScopedVesselIds();
  if (vesselIds === undefined) return { ok: true };
  if (!vesselIds.includes(vesselId)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden — vessel not in your scope" }, { status: 403 }),
    };
  }
  return { ok: true };
}

export function emptyPaginated(page: number, limit: number) {
  return { items: [], total: 0, page, limit, totalPages: 0 };
}

/** Cookie-stored active dry dock project id, or null when unscoped. */
export async function getActiveDryDockProjectId(): Promise<string | null> {
  const jar = await cookies();
  const id = jar.get(SUPERINTENDENT_ACTIVE_PROJECT_COOKIE)?.value?.trim();
  return id || null;
}

export type ActiveDryDockProjectSummary = {
  id: string;
  name: string;
  referenceCode: string | null;
  vessel: { id: string; name: string; code: string };
};

/** Resolve active project from cookie if it still exists and is in vessel scope. */
export async function resolveActiveDryDockProject(): Promise<ActiveDryDockProjectSummary | null> {
  const id = await getActiveDryDockProjectId();
  if (!id) return null;

  const vesselIds = await getScopedVesselIds();
  const project = await prisma.dryDockProject.findFirst({
    where: {
      id,
      ...notDeleted,
      archivedAt: null,
      ...dryDockProjectScopeWhere(vesselIds),
    },
    select: {
      id: true,
      name: true,
      referenceCode: true,
      vessel: { select: { id: true, name: true, code: true } },
    },
  });
  return project;
}
