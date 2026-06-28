import { NextResponse } from "next/server";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import {
  dryDockProjectScopeWhere,
  getScopedVesselIds,
  vesselScopeWhere,
} from "@/lib/superintendent/scope";
import { notDeleted } from "@/lib/superintendent/helpers";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const vesselIds = await getScopedVesselIds();
  const vesselWhere = { ...notDeleted, status: "active" as const, ...vesselScopeWhere(vesselIds) };
  const projectWhere = { ...notDeleted, ...dryDockProjectScopeWhere(vesselIds) };
  const childProjectFilter = vesselIds
    ? { dryDockProject: { ...notDeleted, vesselId: { in: vesselIds } } }
    : {};

  const [
    vesselCount,
    projectCounts,
    activeJobs,
    pendingApprovals,
    openRisks,
    openDelays,
    upcomingMilestones,
  ] = await Promise.all([
    prisma.vessel.count({ where: vesselWhere }),
    prisma.dryDockProject.groupBy({
      by: ["status"],
      where: projectWhere,
      _count: { _all: true },
    }),
    prisma.ddJob.count({
      where: {
        ...notDeleted,
        status: { in: ["planned", "in_progress", "pending_approval"] },
        ...childProjectFilter,
      },
    }),
    prisma.ddApprovalRequest.count({
      where: { ...notDeleted, status: "pending", ...childProjectFilter },
    }),
    prisma.ddRiskItem.count({
      where: { ...notDeleted, status: "open", ...childProjectFilter },
    }),
    prisma.ddDelayItem.count({
      where: { ...notDeleted, status: "open", ...childProjectFilter },
    }),
    prisma.ddMilestone.count({
      where: {
        ...notDeleted,
        status: { not: "completed" },
        plannedDate: { gte: new Date() },
        ...childProjectFilter,
      },
    }),
  ]);

  const projectsByStatus = Object.fromEntries(
    projectCounts.map((row) => [row.status, row._count._all]),
  );

  return NextResponse.json({
    stats: {
      vesselCount,
      projectsByStatus,
      activeJobs,
      pendingApprovals,
      openRisks,
      openDelays,
      upcomingMilestones,
      scoped: vesselIds != null,
    },
  });
}
