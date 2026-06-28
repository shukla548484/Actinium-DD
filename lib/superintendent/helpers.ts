import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  dryDockProjectScopeWhere,
  getScopedVesselIds,
} from "@/lib/superintendent/scope";

export const notDeleted = { deletedAt: null } as const;

export { emptyPaginated, getScopedVesselIds } from "@/lib/superintendent/scope";

export function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(1, Number(searchParams.get("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? 20)));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export function paginatedResult<T>(items: T[], total: number, page: number, limit: number) {
  return {
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

export async function scopedDryDockProjectWhere(
  extra: Prisma.DryDockProjectWhereInput = {},
): Promise<Prisma.DryDockProjectWhereInput> {
  const vesselIds = await getScopedVesselIds();
  return { ...notDeleted, ...dryDockProjectScopeWhere(vesselIds), ...extra };
}

export async function scopedChildWhere(
  dryDockProjectId?: string,
): Promise<
  | { ok: true; where: Prisma.DdJobWhereInput }
  | { ok: false; empty: ReturnType<typeof paginatedResult<never>> }
> {
  const vesselIds = await getScopedVesselIds();
  if (vesselIds?.length === 0) {
    return { ok: false, empty: paginatedResult([], 0, 1, 20) };
  }
  const where: Prisma.DdJobWhereInput = {
    ...notDeleted,
    ...(dryDockProjectId ? { dryDockProjectId } : {}),
    ...(vesselIds
      ? { dryDockProject: { ...notDeleted, vesselId: { in: vesselIds } } }
      : {}),
  };
  return { ok: true, where };
}

/** Generic child-entity scope filter (jobs, budget, checklist, …). */
export async function scopedProjectChildFilter(
  dryDockProjectId?: string,
): Promise<{ vesselIds: string[] | undefined; blocked: boolean }> {
  const vesselIds = await getScopedVesselIds();
  if (vesselIds?.length === 0) return { vesselIds, blocked: true };
  if (dryDockProjectId && vesselIds) {
    const project = await prisma.dryDockProject.findFirst({
      where: { id: dryDockProjectId, ...notDeleted },
      select: { vesselId: true },
    });
    if (!project || !vesselIds.includes(project.vesselId)) {
      return { vesselIds, blocked: true };
    }
  }
  return { vesselIds, blocked: false };
}

export async function findDryDockProject(id: string) {
  return prisma.dryDockProject.findFirst({
    where: { id, ...notDeleted },
  });
}

export async function findVessel(id: string) {
  return prisma.vessel.findFirst({
    where: { id, ...notDeleted },
  });
}
