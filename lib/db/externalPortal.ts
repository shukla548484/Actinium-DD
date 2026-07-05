import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/db/superintendent/pagination";

export async function getExternalVendorQuotes(
  userEmail: string,
  yardInviteIds?: string[],
) {
  const email = userEmail.trim().toLowerCase();
  const invites = await prisma.yardInvite.findMany({
    where: {
      ...notDeleted,
      contactEmail: { equals: email, mode: "insensitive" },
      ...(yardInviteIds?.length ? { id: { in: yardInviteIds } } : {}),
    },
    include: {
      project: { select: { id: true, name: true, status: true } },
      quoteMeta: { select: { quoteNetTotal: true, currency: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  return invites.map((inv) => ({
    inviteId: inv.id,
    projectId: inv.projectId,
    projectName: inv.project.name,
    projectStatus: inv.project.status,
    yardName: inv.yardName,
    status: inv.status,
    submittedAt: inv.submittedAt?.toISOString() ?? null,
    quoteTotal: inv.quoteMeta?.quoteNetTotal ?? null,
    currency: inv.quoteMeta?.currency ?? null,
    token: inv.token,
  }));
}

export async function getExternalOversightProjects(roleCode: string | null) {
  const isClassOrFlag = roleCode === "CLASS" || roleCode === "FLAG";
  const isOwner = roleCode === "OWNER" || roleCode === "OWNER_SUPDT";

  if (!isClassOrFlag && !isOwner && roleCode !== "AUDITOR") {
    return [];
  }

  const projects = await prisma.dryDockProject.findMany({
    where: {
      ...notDeleted,
      status: { notIn: ["cancelled", "closed"] },
    },
    select: {
      id: true,
      referenceCode: true,
      name: true,
      status: true,
      plannedStart: true,
      plannedEnd: true,
      vessel: { select: { name: true, code: true } },
    },
    orderBy: { plannedStart: "asc" },
    take: 30,
  });

  return projects.map((p) => ({
    id: p.id,
    code: p.referenceCode,
    name: p.name,
    status: p.status,
    vesselName: p.vessel.name,
    vesselCode: p.vessel.code,
    plannedStart: p.plannedStart?.toISOString() ?? null,
    plannedEnd: p.plannedEnd?.toISOString() ?? null,
  }));
}

export async function getExternalServiceReports(roleCode: string | null) {
  if (roleCode !== "MAKER" && roleCode !== "SERVICE_VENDOR" && roleCode !== "VENDOR") {
    return [];
  }

  const jobs = await prisma.workshopJob.findMany({
    where: {
      status: { in: ["in_progress", "awaiting_material", "blocked"] },
      classHoldPoint: true,
    },
    select: {
      id: true,
      jobCode: true,
      jobTitle: true,
      workshopSlug: true,
      status: true,
      progressPct: true,
      yardWorkProject: {
        select: {
          project: { select: { name: true } },
        },
      },
    },
    take: 25,
    orderBy: { updatedAt: "desc" },
  });

  return jobs.map((j) => ({
    id: j.id,
    jobCode: j.jobCode,
    jobTitle: j.jobTitle,
    workshopSlug: j.workshopSlug,
    status: j.status,
    progressPct: j.progressPct,
    projectName: j.yardWorkProject.project.name,
  }));
}
