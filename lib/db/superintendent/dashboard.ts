import { prisma } from "@/lib/prisma";
import { notDeleted, parsePageLimit } from "@/lib/db/superintendent/pagination";
import type { DashboardStatsDto, ListQuery } from "@/lib/superintendent/types";

async function resolveVesselScope(query: ListQuery = {}): Promise<string[] | undefined> {
  let vesselIds = query.vesselIds;

  if (query.employeeId) {
    const assignments = await prisma.employeeVessel.findMany({
      where: { employeeId: query.employeeId },
      select: { vesselId: true },
    });
    const assignedIds = assignments.map((a) => a.vesselId);
    vesselIds = vesselIds ? vesselIds.filter((id) => assignedIds.includes(id)) : assignedIds;
  }

  if (query.vesselId) {
    vesselIds = vesselIds ? vesselIds.filter((id) => id === query.vesselId) : [query.vesselId];
  }

  return vesselIds;
}

export async function getDashboardStats(query: ListQuery = {}): Promise<DashboardStatsDto> {
  const vesselIds = await resolveVesselScope(query);

  const vesselWhere = {
    ...notDeleted,
    ...(vesselIds?.length ? { id: { in: vesselIds } } : {}),
  };

  const projectWhere = {
    ...notDeleted,
    ...(vesselIds?.length ? { vesselId: { in: vesselIds } } : {}),
  };

  const [
    vesselCount,
    projectCount,
    activeProjectCount,
    jobCount,
    pendingApprovalCount,
    openRiskCount,
    openDelayCount,
    pendingSurveyCount,
    pendingSparesCount,
  ] = await Promise.all([
    prisma.vessel.count({ where: vesselWhere }),
    prisma.dryDockProject.count({ where: projectWhere }),
    prisma.dryDockProject.count({
      where: {
        ...projectWhere,
        status: { in: ["planning", "tendering", "awarded", "in_progress"] },
      },
    }),
    prisma.ddJob.count({
      where: {
        ...notDeleted,
        dryDockProject: projectWhere,
      },
    }),
    prisma.ddApprovalRequest.count({
      where: {
        ...notDeleted,
        status: "pending",
        dryDockProject: projectWhere,
      },
    }),
    prisma.ddRiskItem.count({
      where: {
        ...notDeleted,
        status: "open",
        dryDockProject: projectWhere,
      },
    }),
    prisma.ddDelayItem.count({
      where: {
        ...notDeleted,
        status: "open",
        dryDockProject: projectWhere,
      },
    }),
    prisma.ddSurveyItem.count({
      where: {
        ...notDeleted,
        status: { in: ["pending", "in_progress"] },
        dryDockProject: projectWhere,
      },
    }),
    prisma.ddSparesItem.count({
      where: {
        ...notDeleted,
        status: { in: ["required", "ordered", "pending"] },
        dryDockProject: projectWhere,
      },
    }),
  ]);

  return {
    vesselCount,
    projectCount,
    activeProjectCount,
    jobCount,
    openDefectCount: 0,
    pendingApprovalCount,
    openRiskCount,
    openDelayCount,
    pendingSurveyCount,
    pendingSparesCount,
  };
}

export { resolveVesselScope };
