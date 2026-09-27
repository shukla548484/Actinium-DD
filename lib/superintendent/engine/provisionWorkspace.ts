import type { DryDockProjectType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getProjectTemplate } from "./projectTemplates";

type ProvisionInput = {
  dryDockProjectId: string;
  projectType: DryDockProjectType;
  plannedStart?: Date | null;
};

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function checklistTitleKey(title: string): string {
  return title.trim().toLowerCase();
}

async function createChecklistIfMissing(
  tx: Prisma.TransactionClient,
  input: {
    dryDockProjectId: string;
    title: string;
    category: string | null;
    sortOrder: number;
    existingTitles: Set<string>;
  },
): Promise<void> {
  const key = checklistTitleKey(input.title);
  if (input.existingTitles.has(key)) return;
  await tx.ddChecklistItem.create({
    data: {
      dryDockProjectId: input.dryDockProjectId,
      title: input.title,
      category: input.category,
      sortOrder: input.sortOrder,
    },
  });
  input.existingTitles.add(key);
}

/**
 * Seeds jobs, checklist, milestones, survey items, and budget lines
 * from the project type template. Idempotent: skips when the workspace
 * was already provisioned, and never inserts checklist titles that already exist.
 */
export async function provisionDryDockProjectWorkspace(input: ProvisionInput): Promise<void> {
  const project = await prisma.dryDockProject.findFirst({
    where: { id: input.dryDockProjectId, deletedAt: null },
    select: { workspaceProvisionedAt: true },
  });
  if (!project) return;
  if (project.workspaceProvisionedAt) return;

  const template = getProjectTemplate(input.projectType);
  const start = input.plannedStart ?? new Date();

  await prisma.$transaction(async (tx) => {
    // Re-check inside the transaction to avoid concurrent double-provision.
    const locked = await tx.dryDockProject.findFirst({
      where: { id: input.dryDockProjectId, deletedAt: null },
      select: { workspaceProvisionedAt: true },
    });
    if (!locked || locked.workspaceProvisionedAt) return;

    const existingChecklist = await tx.ddChecklistItem.findMany({
      where: { dryDockProjectId: input.dryDockProjectId, deletedAt: null },
      select: { title: true },
    });
    const existingTitles = new Set(
      existingChecklist.map((row) => checklistTitleKey(row.title)),
    );

    const existingJobCount = await tx.ddJob.count({
      where: { dryDockProjectId: input.dryDockProjectId, deletedAt: null },
    });
    if (existingJobCount === 0) {
      for (const [index, job] of template.jobs.entries()) {
        await tx.ddJob.create({
          data: {
            dryDockProjectId: input.dryDockProjectId,
            title: job.title,
            category: job.category,
            description: job.workshop ? `Workshop: ${job.workshop}` : null,
            workshop: job.workshop ?? null,
            priority: job.priority ?? "medium",
            status: "planned",
            sortOrder: index,
          },
        });
      }
    }

    for (const [index, item] of template.checklist.entries()) {
      await createChecklistIfMissing(tx, {
        dryDockProjectId: input.dryDockProjectId,
        title: item.title,
        category: item.category ?? null,
        sortOrder: index,
        existingTitles,
      });
    }

    const existingMilestoneCount = await tx.ddMilestone.count({
      where: { dryDockProjectId: input.dryDockProjectId, deletedAt: null },
    });
    const milestoneIds: string[] = [];
    if (existingMilestoneCount === 0) {
      for (const [index, ms] of template.milestones.entries()) {
        const created = await tx.ddMilestone.create({
          data: {
            dryDockProjectId: input.dryDockProjectId,
            title: ms.title,
            plannedDate:
              ms.offsetDaysFromStart != null ? addDays(start, ms.offsetDaysFromStart) : null,
            baselineDate:
              ms.offsetDaysFromStart != null ? addDays(start, ms.offsetDaysFromStart) : null,
            status: "planned",
            sortOrder: index,
          },
        });
        milestoneIds.push(created.id);
      }

      for (const [index, ms] of template.milestones.entries()) {
        if (ms.dependsOnIndex == null) continue;
        const depId = milestoneIds[ms.dependsOnIndex];
        if (!depId) continue;
        await tx.ddMilestone.update({
          where: { id: milestoneIds[index]! },
          data: { dependsOnMilestoneId: depId },
        });
      }
    }

    const existingSurveyCount = await tx.ddSurveyItem.count({
      where: { dryDockProjectId: input.dryDockProjectId, deletedAt: null },
    });
    if (existingSurveyCount === 0) {
      for (const item of template.surveyItems) {
        await tx.ddSurveyItem.create({
          data: {
            dryDockProjectId: input.dryDockProjectId,
            surveyType: item.surveyType,
            title: item.title,
            status: "pending",
          },
        });
      }
    }

    const existingBudgetCount = await tx.ddBudgetLine.count({
      where: { dryDockProjectId: input.dryDockProjectId, deletedAt: null },
    });
    if (existingBudgetCount === 0) {
      for (const [index, line] of template.budgetCategories.entries()) {
        await tx.ddBudgetLine.create({
          data: {
            dryDockProjectId: input.dryDockProjectId,
            category: line.category,
            description: line.description ?? null,
            currency: "USD",
            exchangeRateLocalPerUsd: 1,
            budgetAmount: 0,
            budgetAmountUsd: 0,
            sortOrder: index,
          },
        });
      }
    }

    const existingApprovalCount = await tx.ddApprovalRequest.count({
      where: { dryDockProjectId: input.dryDockProjectId, deletedAt: null },
    });
    if (existingApprovalCount === 0) {
      for (const item of template.approvals) {
        await tx.ddApprovalRequest.create({
          data: {
            dryDockProjectId: input.dryDockProjectId,
            approvalType: item.approvalType,
            title: item.title,
            description: item.description ?? null,
            status: "pending",
          },
        });
      }
    }

    for (const [index, item] of template.documents.entries()) {
      await createChecklistIfMissing(tx, {
        dryDockProjectId: input.dryDockProjectId,
        title: item.title,
        category: "Documents",
        sortOrder: 1000 + index,
        existingTitles,
      });
    }

    for (const [index, item] of template.rfqSteps.entries()) {
      await createChecklistIfMissing(tx, {
        dryDockProjectId: input.dryDockProjectId,
        title: item.title,
        category: "RFQ",
        sortOrder: 2000 + index,
        existingTitles,
      });
    }

    await tx.dryDockProject.update({
      where: { id: input.dryDockProjectId },
      data: {
        templateVersion: template.version,
        workspaceProvisionedAt: new Date(),
        surveyType: template.defaultSurveyType ?? undefined,
        dockingReason: template.defaultDockingReason ?? undefined,
      },
    });
  });
}
