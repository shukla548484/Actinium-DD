import type { DryDockProjectStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createDryDockProject } from "@/lib/db/superintendent/projects";
import { notDeleted } from "@/lib/db/superintendent/pagination";

type DuplicateOptions = {
  name?: string;
  copyScope?: boolean;
  status?: DryDockProjectStatus;
};

export async function duplicateDryDockProject(
  sourceId: string,
  options: DuplicateOptions = {},
) {
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

  if (!source) return null;

  const copyScope = options.copyScope !== false;
  const name = options.name?.trim() || `${source.name} (Copy)`;

  const created = await createDryDockProject({
    vesselId: source.vesselId,
    projectId: null,
    name,
    projectType: source.projectType,
    priority: source.priority,
    status: options.status ?? "draft",
    plannedStart: source.plannedStart,
    plannedEnd: source.plannedEnd,
    selectedYard: source.selectedYard,
    shipyardCountry: source.shipyardCountry,
    dockType: source.dockType,
    currency: source.currency,
    budgetTotal: source.budgetTotal,
    approvedBudget: source.approvedBudget,
    contingencyBudget: source.contingencyBudget,
    classSociety: source.classSociety,
    surveyType: source.surveyType,
    mainScope: source.mainScope,
    dockingReason: source.dockingReason,
    notes: source.notes,
    provisionWorkspace: false,
  });

  if (!copyScope) {
    return created;
  }

  await prisma.$transaction([
    ...source.jobs.map((job, index) =>
      prisma.ddJob.create({
        data: {
          dryDockProjectId: created.id,
          jobCode: job.jobCode,
          title: job.title,
          category: job.category,
          description: job.description,
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
          dryDockProjectId: created.id,
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
          dryDockProjectId: created.id,
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
          dryDockProjectId: created.id,
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
          dryDockProjectId: created.id,
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
          dryDockProjectId: created.id,
          approvalType: item.approvalType,
          title: item.title,
          description: item.description,
          amount: item.amount,
          status: "pending",
        },
      }),
    ),
    prisma.dryDockProject.update({
      where: { id: created.id },
      data: {
        templateVersion: source.templateVersion,
        workspaceProvisionedAt: new Date(),
      },
    }),
  ]);

  return created;
}

export async function setDryDockProjectStatus(id: string, status: DryDockProjectStatus) {
  const row = await prisma.dryDockProject.update({
    where: { id },
    data: { status },
    include: { vessel: { select: { name: true } } },
  });
  return row;
}
