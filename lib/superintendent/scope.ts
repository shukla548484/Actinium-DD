import { cookies } from "next/headers";
import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { notDeleted } from "@/lib/superintendent/helpers";
import { prisma } from "@/lib/prisma";

export const SUPERINTENDENT_EMPLOYEE_COOKIE = "superintendent_employee_id";

/** undefined = office mode (all vessels); [] = no assignments; string[] = scoped vessels */
export async function getScopedVesselIds(): Promise<string[] | undefined> {
  const jar = await cookies();
  const employeeId = jar.get(SUPERINTENDENT_EMPLOYEE_COOKIE)?.value?.trim();
  if (!employeeId) return undefined;

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
  if (vesselIds === undefined) return {};
  if (vesselIds.length === 0) return { vesselId: { in: [] } };
  return { vesselId: { in: vesselIds } };
}

export async function assertDryDockProjectInScope(
  dryDockProjectId: string,
): Promise<{ ok: true; vesselId: string } | { ok: false; response: NextResponse }> {
  const vesselIds = await getScopedVesselIds();
  const project = await prisma.dryDockProject.findFirst({
    where: { id: dryDockProjectId, ...notDeleted },
    select: { vesselId: true },
  });
  if (!project) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Dry dock project not found" }, { status: 404 }),
    };
  }
  if (vesselIds !== undefined && !vesselIds.includes(project.vesselId)) {
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
