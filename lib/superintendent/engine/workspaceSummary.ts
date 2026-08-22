import type { DryDockProjectType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/db/superintendent/pagination";
import { getEnabledModules } from "./projectTemplates";
import type { DdProjectModuleId } from "./projectModules";
import { getVesselScopeIntegrationStats } from "@/lib/db/superintendent/vesselJobs";
import { buildWorkspaceModuleCard, type WorkspaceModuleCard } from "./workspaceNav";

export type { WorkspaceModuleCard };

export type WorkspaceWorkshop = {
  name: string;
  jobCount: number;
};

export type ProjectWorkspaceSummary = {
  dryDockProjectId: string;
  projectType: DryDockProjectType;
  templateVersion: string;
  workspaceProvisionedAt: string | null;
  modules: WorkspaceModuleCard[];
  workshops: WorkspaceWorkshop[];
  kpis: {
    jobs: number;
    checklistItems: number;
    milestones: number;
    budgetLines: number;
    surveyItems: number;
    approvals: number;
    documentRequirements: number;
    rfqSteps: number;
    progressPct: number | null;
    vesselJobsIntegrated: number;
    vesselJobsAutoImported: number;
    vesselJobsPendingBank: number;
    importedDefects: number;
  };
  scopePreview: { title: string; workshop: string | null; category: string }[];
};

function moduleCount(
  id: DdProjectModuleId,
  counts: Record<string, number>,
): number | null {
  const map: Partial<Record<DdProjectModuleId, string>> = {
    scope: "jobs",
    jobs: "jobs",
    budget: "budgetLines",
    survey: "surveyItems",
    approvals: "approvals",
    timeline: "milestones",
  };
  const key = map[id];
  return key ? (counts[key] ?? 0) : null;
}

async function countImportedDefects(dryDockProjectId: string): Promise<number> {
  try {
    const defectDelegate = (
      prisma as typeof prisma & {
        ddProjectDefect?: { count: (args: { where: object }) => Promise<number> };
      }
    ).ddProjectDefect;
    if (typeof defectDelegate?.count !== "function") return 0;
    return await defectDelegate.count({
      where: { dryDockProjectId, ...notDeleted },
    });
  } catch {
    return 0;
  }
}

export async function getProjectWorkspaceSummary(
  dryDockProjectId: string,
): Promise<ProjectWorkspaceSummary | null> {
  const project = await prisma.dryDockProject.findFirst({
    where: { id: dryDockProjectId, ...notDeleted },
    select: {
      id: true,
      projectType: true,
      templateVersion: true,
      workspaceProvisionedAt: true,
      progressPct: true,
      _count: {
        select: {
          jobs: true,
          checklistItems: true,
          milestones: true,
          budgetLines: true,
          surveyItems: true,
          approvals: true,
        },
      },
    },
  });

  if (!project) return null;

  const counts = {
    jobs: project._count.jobs,
    checklistItems: project._count.checklistItems,
    milestones: project._count.milestones,
    budgetLines: project._count.budgetLines,
    surveyItems: project._count.surveyItems,
    approvals: project._count.approvals,
  };

  const enabled = getEnabledModules(project.projectType);
  const modules: WorkspaceModuleCard[] = enabled.map((id) =>
    buildWorkspaceModuleCard(id, dryDockProjectId, moduleCount(id, counts)),
  );

  let documentRequirements = 0;
  let rfqSteps = 0;
  let scopeJobs: {
    title: string;
    category: string;
    description: string | null;
    workshop: string | null;
  }[] = [];
  let workshopGroups: { workshop: string | null; _count: { _all: number } }[] = [];
  let vesselScopeStats: Awaited<ReturnType<typeof getVesselScopeIntegrationStats>> = null;

  try {
    [documentRequirements, rfqSteps, scopeJobs, workshopGroups, vesselScopeStats] = await Promise.all([
      prisma.ddChecklistItem.count({
        where: { dryDockProjectId, category: "Documents", ...notDeleted },
      }),
      prisma.ddChecklistItem.count({
        where: { dryDockProjectId, category: "RFQ", ...notDeleted },
      }),
      prisma.ddJob.findMany({
        where: { dryDockProjectId, ...notDeleted },
        orderBy: { sortOrder: "asc" },
        take: 8,
        select: { title: true, category: true, description: true, workshop: true },
      }),
      prisma.ddJob.groupBy({
        by: ["workshop"],
        where: { dryDockProjectId, ...notDeleted, workshop: { not: null } },
        _count: { _all: true },
      }),
      getVesselScopeIntegrationStats(dryDockProjectId),
    ]);
  } catch {
    // KPI extras failed — still return modules so the workspace shell stays visible.
  }

  const importedDefects = await countImportedDefects(dryDockProjectId);

  const workshops: WorkspaceWorkshop[] = workshopGroups
    .map((g) => ({
      name: g.workshop?.trim() || "General",
      jobCount: g._count._all,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    dryDockProjectId: project.id,
    projectType: project.projectType,
    templateVersion: project.templateVersion,
    workspaceProvisionedAt: project.workspaceProvisionedAt?.toISOString() ?? null,
    modules,
    workshops,
    kpis: {
      ...counts,
      documentRequirements,
      rfqSteps,
      progressPct: project.progressPct,
      vesselJobsIntegrated: vesselScopeStats?.integratedTotal ?? 0,
      vesselJobsAutoImported: vesselScopeStats?.autoImportedAtProvision ?? 0,
      vesselJobsPendingBank: vesselScopeStats?.pendingInBank ?? 0,
      importedDefects,
    },
    scopePreview: scopeJobs.map((j) => ({
      title: j.title,
      category: j.category,
      workshop: j.workshop?.trim() || (j.description?.startsWith("Workshop:")
        ? j.description.replace(/^Workshop:\s*/, "")
        : null),
    })),
  };
}
