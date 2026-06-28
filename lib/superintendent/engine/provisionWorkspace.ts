import type { DryDockProjectType } from "@prisma/client";
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

/**
 * Seeds jobs, checklist, milestones, survey items, and budget lines
 * from the project type template. Called once when a project is created.
 */
export async function provisionDryDockProjectWorkspace(input: ProvisionInput): Promise<void> {
  const template = getProjectTemplate(input.projectType);
  const start = input.plannedStart ?? new Date();

  await prisma.$transaction(async (tx) => {
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

    for (const [index, item] of template.checklist.entries()) {
      await tx.ddChecklistItem.create({
        data: {
          dryDockProjectId: input.dryDockProjectId,
          title: item.title,
          category: item.category ?? null,
          sortOrder: index,
        },
      });
    }

    const milestoneIds: string[] = [];
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

    for (const [index, line] of template.budgetCategories.entries()) {
      await tx.ddBudgetLine.create({
        data: {
          dryDockProjectId: input.dryDockProjectId,
          category: line.category,
          description: line.description ?? null,
          budgetAmount: 0,
          sortOrder: index,
        },
      });
    }

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

    for (const [index, item] of template.documents.entries()) {
      await tx.ddChecklistItem.create({
        data: {
          dryDockProjectId: input.dryDockProjectId,
          title: item.title,
          category: "Documents",
          sortOrder: 1000 + index,
        },
      });
    }

    for (const [index, item] of template.rfqSteps.entries()) {
      await tx.ddChecklistItem.create({
        data: {
          dryDockProjectId: input.dryDockProjectId,
          title: item.title,
          category: "RFQ",
          sortOrder: 2000 + index,
        },
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
