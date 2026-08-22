import type { DdProjectModuleId } from "./projectModules";
import { resolveModuleMeta } from "./projectModules";
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

/** Horizontal workspace tabs (excludes overview — that is the Dashboard item). */
export const WORKSPACE_NAV_MODULE_IDS: DdProjectModuleId[] = [
  "scope",
  "jobs",
  "budget",
  "timeline",
  "workshops",
  "survey",
  "permits",
  "procurement",
  "inspections",
  "approvals",
  "daily_progress",
  "rfq",
  "documents",
  "shipyard",
  "sea_trial",
  "resources",
  "closeout",
  "reports",
];

export function workspaceModuleHref(id: DdProjectModuleId, projectId: string): string {
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

export function buildWorkspaceModuleCard(
  id: DdProjectModuleId,
  projectId: string,
  count: number | null = null,
): WorkspaceModuleCard {
  const meta = resolveModuleMeta(id);
  return {
    id,
    label: meta.label,
    description: meta.description,
    href: workspaceModuleHref(id, projectId),
    count,
  };
}

/** Nav modules when the workspace API is unavailable — never collapse to input-role tabs. */
export function fallbackWorkspaceNavModules(projectId: string): WorkspaceModuleCard[] {
  return WORKSPACE_NAV_MODULE_IDS.map((id) => buildWorkspaceModuleCard(id, projectId));
}
