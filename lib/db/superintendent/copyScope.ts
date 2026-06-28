import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/db/superintendent/pagination";

async function softDeleteProjectScope(dryDockProjectId: string) {
  const now = new Date();
  await prisma.$transaction([
    prisma.ddJob.updateMany({ where: { dryDockProjectId, ...notDeleted }, data: { deletedAt: now } }),
    prisma.ddChecklistItem.updateMany({
      where: { dryDockProjectId, ...notDeleted },
      data: { deletedAt: now },
    }),
    prisma.ddMilestone.updateMany({
      where: { dryDockProjectId, ...notDeleted },
      data: { deletedAt: now },
    }),
    prisma.ddSurveyItem.updateMany({
      where: { dryDockProjectId, ...notDeleted },
      data: { deletedAt: now },
    }),
    prisma.ddBudgetLine.updateMany({
      where: { dryDockProjectId, ...notDeleted },
      data: { deletedAt: now },
    }),
    prisma.ddApprovalRequest.updateMany({
      where: { dryDockProjectId, ...notDeleted },
      data: { deletedAt: now },
    }),
  ]);
}

async function copyScopeEntities(sourceId: string, targetId: string) {
  const source = await prisma.dryDockProject.findFirst({
    where: { id: sourceId, ...notDeleted },
    include: {
      jobs: { where: notDeleted, orderBy: { sortOrder: "asc" } },
      checklistItems: { where: notDeleted, orderBy: { sortOrder: "asc" } },
      milestones: { where: notDeleted, orderBy: { sortOrder: "asc" } },
      surveyItems: { where: notDeleted },
      budgetLines: { where: notDeleted, orderBy: { sortOrder: "asc" } },
      approvals: { where: notDeleted },
    },
  });

  if (!source) return false;

  await prisma.$transaction([
    ...source.jobs.map((job, index) =>
      prisma.ddJob.create({
        data: {
          dryDockProjectId: targetId,
          jobCode: job.jobCode,
          title: job.title,
          category: job.category,
          description: job.description,
          workshop: job.workshop,
          priority: job.priority,
          status: "planned",
          progressPct: 0,
          budgetAmount: job.budgetAmount,
          quotedAmount: job.quotedAmount,
          responsibleParty: job.responsibleParty,
          sortOrder: index,
        },
      }),
    ),
    ...source.checklistItems.map((item, index) =>
      prisma.ddChecklistItem.create({
        data: {
          dryDockProjectId: targetId,
          title: item.title,
          category: item.category,
          isCompleted: false,
          dueDate: item.dueDate,
          assignedTo: item.assignedTo,
          notes: item.notes,
          sortOrder: index,
        },
      }),
    ),
    ...source.milestones.map((ms, index) =>
      prisma.ddMilestone.create({
        data: {
          dryDockProjectId: targetId,
          title: ms.title,
          plannedDate: ms.plannedDate,
          actualDate: null,
          status: "planned",
          notes: ms.notes,
          sortOrder: index,
        },
      }),
    ),
    ...source.surveyItems.map((item) =>
      prisma.ddSurveyItem.create({
        data: {
          dryDockProjectId: targetId,
          surveyType: item.surveyType,
          title: item.title,
          description: item.description,
          dueDate: item.dueDate,
          status: "pending",
          classReference: item.classReference,
        },
      }),
    ),
    ...source.budgetLines.map((line, index) =>
      prisma.ddBudgetLine.create({
        data: {
          dryDockProjectId: targetId,
          category: line.category,
          description: line.description,
          budgetAmount: line.budgetAmount,
          quotedAmount: line.quotedAmount,
          approvedAmount: line.approvedAmount,
          responsibleParty: line.responsibleParty,
          approvalStatus: "pending",
          sortOrder: index,
        },
      }),
    ),
    ...source.approvals.map((item) =>
      prisma.ddApprovalRequest.create({
        data: {
          dryDockProjectId: targetId,
          approvalType: item.approvalType,
          title: item.title,
          description: item.description,
          amount: item.amount,
          status: "pending",
        },
      }),
    ),
    prisma.dryDockProject.update({
      where: { id: targetId },
      data: {
        templateVersion: source.templateVersion,
        workspaceProvisionedAt: new Date(),
      },
    }),
  ]);

  return true;
}

/** Replace target project scope with a copy from a previous project. */
export async function copyProjectScopeTo(
  targetProjectId: string,
  sourceProjectId: string,
): Promise<boolean> {
  if (targetProjectId === sourceProjectId) return false;

  const [target, source] = await Promise.all([
    prisma.dryDockProject.findFirst({ where: { id: targetProjectId, ...notDeleted } }),
    prisma.dryDockProject.findFirst({ where: { id: sourceProjectId, ...notDeleted } }),
  ]);

  if (!target || !source) return false;

  await softDeleteProjectScope(targetProjectId);
  return copyScopeEntities(sourceProjectId, targetProjectId);
}

export async function listPreviousProjectsForVessel(
  vesselId: string,
  excludeProjectId?: string,
) {
  return prisma.dryDockProject.findMany({
    where: {
      vesselId,
      ...notDeleted,
      ...(excludeProjectId ? { id: { not: excludeProjectId } } : {}),
    },
    orderBy: { plannedStart: "desc" },
    take: 20,
    select: {
      id: true,
      name: true,
      referenceCode: true,
      projectType: true,
      status: true,
      plannedStart: true,
      plannedEnd: true,
    },
  });
}
