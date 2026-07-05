import type { DryDockProjectType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/db/superintendent/pagination";
import { getEnabledModules } from "./projectTemplates";
import { resolveModuleMeta } from "./projectModules";
import type { DdProjectModuleId } from "./projectModules";
import { getVesselScopeIntegrationStats } from "@/lib/db/superintendent/vesselJobs";
import {
  projectBudgetHref,
  projectMonitoringHref,
  projectScopedHref,
} from "./workspaceLinks";

export type WorkspaceModuleCard = {
  id: DdProjectModuleId;
  label: string;
  description: string;
  href: string;
  count: number | null;
};

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
  };
  scopePreview: { title: string; workshop: string | null; category: string }[];
};

function moduleHref(id: DdProjectModuleId, projectId: string): string {
  const inProject: Partial<Record<DdProjectModuleId, string>> = {
    overview: `/superintendent/projects/${projectId}`,
    scope: `/superintendent/projects/${projectId}/scope`,
    jobs: `/superintendent/projects/${projectId}/scope`,
    timeline: `/superintendent/projects/${projectId}/timeline`,
    workshops: `/superintendent/projects/${projectId}/workshops`,
    documents: `/superintendent/projects/${projectId}/documents`,
    rfq: `/superintendent/projects/${projectId}/rfq`,
    closeout: `/superintendent/projects/${projectId}/closeout`,
    permits: `/superintendent/projects/${projectId}/permits`,
    procurement: `/superintendent/projects/${projectId}/procurement`,
    inspections: `/superintendent/projects/${projectId}/inspections`,
    sea_trial: `/superintendent/projects/${projectId}/sea-trial`,
    shipyard: `/superintendent/projects/${projectId}/shipyard`,
    reports: `/superintendent/projects/${projectId}/reports`,
    resources: `/superintendent/projects/${projectId}/resources`,
    budget: projectBudgetHref(projectId),
    variations: projectBudgetHref(projectId, "variations"),
    survey: projectScopedHref("survey", projectId),
    approvals: projectScopedHref("approvals", projectId),
    daily_progress: projectMonitoringHref(projectId, "daily-reports"),
    delays: projectMonitoringHref(projectId, "delays"),
  };
  if (inProject[id]) return inProject[id]!;
  return projectScopedHref(id, projectId);
}

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

  const [documentRequirements, rfqSteps, scopeJobs, workshopGroups, vesselScopeStats] =
    await Promise.all([
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

  const counts = {
    jobs: project._count.jobs,
    checklistItems: project._count.checklistItems,
    milestones: project._count.milestones,
    budgetLines: project._count.budgetLines,
    surveyItems: project._count.surveyItems,
    approvals: project._count.approvals,
  };

  const enabled = getEnabledModules(project.projectType);

  const modules: WorkspaceModuleCard[] = enabled.map((id) => {
    const meta = resolveModuleMeta(id);
    return {
      id,
      label: meta.label,
      description: meta.description,
      href: moduleHref(id, dryDockProjectId),
      count: moduleCount(id, counts),
    };
  });

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
