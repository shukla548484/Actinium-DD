/**
 * Apply vessel-scoped RBAC to child-entity list queries (jobs, budget, checklist, …).
 */
import type { Prisma } from "@prisma/client";
import {
  assertDryDockProjectInScope,
  emptyPaginated,
  getScopedVesselIds,
} from "@/lib/superintendent/scope";
import { notDeleted, paginatedResult } from "@/lib/superintendent/helpers";
import { prisma } from "@/lib/prisma";

export async function guardChildListAccess(
  dryDockProjectId: string | undefined,
  page: number,
  limit: number,
): Promise<
  | { ok: true; projectFilter: Prisma.DryDockProjectWhereInput }
  | { ok: false; response: ReturnType<typeof paginatedResult<never>> }
> {
  const vesselIds = await getScopedVesselIds();
  if (vesselIds?.length === 0) {
    return { ok: false, response: emptyPaginated(page, limit) };
  }

  if (dryDockProjectId && vesselIds) {
    const project = await prisma.dryDockProject.findFirst({
      where: { id: dryDockProjectId, ...notDeleted },
      select: { vesselId: true },
    });
    if (!project || !vesselIds.includes(project.vesselId)) {
      return { ok: false, response: emptyPaginated(page, limit) };
    }
  }

  const projectFilter: Prisma.DryDockProjectWhereInput = vesselIds
    ? { ...notDeleted, vesselId: { in: vesselIds } }
    : {};

  return { ok: true, projectFilter };
}

export function buildChildEntityWhere(
  dryDockProjectId: string | undefined,
  projectFilter: Prisma.DryDockProjectWhereInput,
): { dryDockProjectId?: string; dryDockProject?: Prisma.DryDockProjectWhereInput } {
  const where: {
    dryDockProjectId?: string;
    dryDockProject?: Prisma.DryDockProjectWhereInput;
  } = {};
  if (dryDockProjectId) where.dryDockProjectId = dryDockProjectId;
  if (Object.keys(projectFilter).length > 0) where.dryDockProject = projectFilter;
  return where;
}

/** Guard GET/PATCH/DELETE on child records that belong to a dry dock project. */
export async function assertChildDryDockProjectInScope(
  dryDockProjectId: string,
): Promise<{ ok: true } | { ok: false; response: import("next/server").NextResponse }> {
  const access = await assertDryDockProjectInScope(dryDockProjectId);
  if (!access.ok) return access;
  return { ok: true };
}
