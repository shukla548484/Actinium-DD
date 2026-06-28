import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/db/superintendent/pagination";

function resolveWorkshop(job: { workshop: string | null; description: string | null }): string {
  if (job.workshop?.trim()) return job.workshop.trim();
  if (job.description?.startsWith("Workshop:")) {
    return job.description.replace(/^Workshop:\s*/, "").trim() || "General";
  }
  return "General";
}

export async function getProjectTimeline(dryDockProjectId: string) {
  const project = await prisma.dryDockProject.findFirst({
    where: { id: dryDockProjectId, ...notDeleted },
    select: {
      id: true,
      name: true,
      plannedStart: true,
      plannedEnd: true,
      actualStart: true,
      actualEnd: true,
      expectedSailing: true,
      baselineLockedAt: true,
      milestones: {
        where: notDeleted,
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          title: true,
          plannedDate: true,
          baselineDate: true,
          actualDate: true,
          status: true,
          dependsOnMilestoneId: true,
          dependsOnMilestone: { select: { id: true, title: true } },
        },
      },
    },
  });

  if (!project) return null;

  return {
    ...project,
    plannedStart: project.plannedStart?.toISOString() ?? null,
    plannedEnd: project.plannedEnd?.toISOString() ?? null,
    actualStart: project.actualStart?.toISOString() ?? null,
    actualEnd: project.actualEnd?.toISOString() ?? null,
    expectedSailing: project.expectedSailing?.toISOString() ?? null,
    baselineLockedAt: project.baselineLockedAt?.toISOString() ?? null,
    milestones: project.milestones.map((m) => ({
      id: m.id,
      title: m.title,
      plannedDate: m.plannedDate?.toISOString() ?? null,
      baselineDate: m.baselineDate?.toISOString() ?? null,
      actualDate: m.actualDate?.toISOString() ?? null,
      status: m.status,
      dependsOnMilestoneId: m.dependsOnMilestoneId,
      dependsOnTitle: m.dependsOnMilestone?.title ?? null,
    })),
  };
}

export async function getProjectChecklistModule(
  dryDockProjectId: string,
  categories: string[],
) {
  const items = await prisma.ddChecklistItem.findMany({
    where: {
      dryDockProjectId,
      ...notDeleted,
      category: { in: categories },
    },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      category: true,
      isCompleted: true,
      dueDate: true,
      notes: true,
      _count: { select: { attachments: true } },
    },
  });

  const completed = items.filter((i) => i.isCompleted).length;

  return {
    items: items.map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category,
      isCompleted: item.isCompleted,
      dueDate: item.dueDate?.toISOString() ?? null,
      notes: item.notes,
      attachmentCount: item._count.attachments,
    })),
    total: items.length,
    completed,
  };
}

export async function getProjectShipyardSummary(dryDockProjectId: string) {
  const project = await prisma.dryDockProject.findFirst({
    where: { id: dryDockProjectId, ...notDeleted },
    select: {
      selectedYard: true,
      shipyardCountry: true,
      status: true,
      lastShipyardSyncAt: true,
      tenderProject: { select: { id: true, name: true } },
      _count: {
        select: {
          jobs: true,
          delays: true,
          dailyReports: true,
        },
      },
    },
  });

  if (!project) return null;

  const inProgressJobs = await prisma.ddJob.count({
    where: {
      dryDockProjectId,
      ...notDeleted,
      status: "in_progress",
    },
  });

  return {
    selectedYard: project.selectedYard,
    shipyardCountry: project.shipyardCountry,
    status: project.status,
    lastShipyardSyncAt: project.lastShipyardSyncAt?.toISOString() ?? null,
    tenderProject: project.tenderProject,
    counts: {
      totalJobs: project._count.jobs,
      inProgressJobs,
      delays: project._count.delays,
      dailyReports: project._count.dailyReports,
    },
  };
}

export async function getProjectWorkshops(dryDockProjectId: string) {
  const jobs = await prisma.ddJob.findMany({
    where: { dryDockProjectId, ...notDeleted },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      category: true,
      description: true,
      workshop: true,
      status: true,
      progressPct: true,
      priority: true,
    },
  });

  const workshops = new Map<
    string,
    {
      name: string;
      jobs: typeof jobs;
    }
  >();

  for (const job of jobs) {
    const workshop = resolveWorkshop(job);
    const group = workshops.get(workshop) ?? { name: workshop, jobs: [] };
    group.jobs.push(job);
    workshops.set(workshop, group);
  }

  return {
    workshops: [...workshops.values()].sort((a, b) => a.name.localeCompare(b.name)),
    totalJobs: jobs.length,
  };
}

export async function getProjectDocuments(dryDockProjectId: string) {
  const items = await prisma.ddChecklistItem.findMany({
    where: {
      dryDockProjectId,
      ...notDeleted,
      category: { in: ["Documents", "RFQ"] },
    },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    select: {
      id: true,
      title: true,
      category: true,
      isCompleted: true,
      dueDate: true,
      notes: true,
      _count: { select: { attachments: true } },
    },
  });

  return {
    documents: items.filter((i) => i.category === "Documents").map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category,
      isCompleted: item.isCompleted,
      dueDate: item.dueDate?.toISOString() ?? null,
      notes: item.notes,
      attachmentCount: item._count.attachments,
    })),
    rfqSteps: items.filter((i) => i.category === "RFQ").map((item) => ({
      id: item.id,
      title: item.title,
      category: item.category,
      isCompleted: item.isCompleted,
      dueDate: item.dueDate?.toISOString() ?? null,
      notes: item.notes,
      attachmentCount: item._count.attachments,
    })),
  };
}

export async function getProjectScopeJobs(dryDockProjectId: string) {
  return prisma.ddJob.findMany({
    where: { dryDockProjectId, ...notDeleted },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    select: {
      id: true,
      jobCode: true,
      title: true,
      category: true,
      description: true,
      workshop: true,
      status: true,
      priority: true,
      progressPct: true,
      budgetAmount: true,
    },
  });
}

export async function getProjectCloseout(dryDockProjectId: string) {
  const [incompleteJobs, pendingApprovals, incompleteChecklist, project] = await Promise.all([
    prisma.ddJob.count({
      where: {
        dryDockProjectId,
        ...notDeleted,
        status: { notIn: ["completed", "closed"] },
      },
    }),
    prisma.ddApprovalRequest.count({
      where: {
        dryDockProjectId,
        ...notDeleted,
        status: { in: ["pending"] },
      },
    }),
    prisma.ddChecklistItem.count({
      where: {
        dryDockProjectId,
        ...notDeleted,
        isCompleted: false,
        category: { notIn: ["Documents", "RFQ"] },
      },
    }),
    prisma.dryDockProject.findFirst({
      where: { id: dryDockProjectId, ...notDeleted },
      select: {
        status: true,
        tenderProject: { select: { id: true, name: true } },
      },
    }),
  ]);

  const outstandingItems = await prisma.ddChecklistItem.findMany({
    where: {
      dryDockProjectId,
      ...notDeleted,
      isCompleted: false,
      category: { notIn: ["Documents", "RFQ"] },
    },
    orderBy: { sortOrder: "asc" },
    take: 20,
    select: {
      id: true,
      title: true,
      category: true,
      dueDate: true,
    },
  });

  return {
    status: project?.status ?? null,
    tenderProject: project?.tenderProject ?? null,
    counts: {
      incompleteJobs,
      pendingApprovals,
      incompleteChecklist,
    },
    readyToClose:
      incompleteJobs === 0 && pendingApprovals === 0 && incompleteChecklist === 0,
    outstandingItems: outstandingItems.map((item) => ({
      ...item,
      dueDate: item.dueDate?.toISOString() ?? null,
    })),
  };
}
