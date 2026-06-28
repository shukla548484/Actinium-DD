import type { DdProjectModuleId } from "./projectModules";
import { resolveModuleMeta } from "./projectModules";

/** Build superintendent list URL scoped to a dry dock project. */
export function projectScopedHref(
  moduleId: DdProjectModuleId,
  dryDockProjectId: string,
): string {
  const meta = resolveModuleMeta(moduleId);
  const base = meta.href ?? `/superintendent/projects/${dryDockProjectId}`;
  if (!meta.href) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}dryDockProjectId=${encodeURIComponent(dryDockProjectId)}`;
}

export function projectPlanningHref(dryDockProjectId: string, section: "checklist" | "milestones" | "risks") {
  return `/superintendent/planning/${section}?dryDockProjectId=${encodeURIComponent(dryDockProjectId)}`;
}

export function projectMonitoringHref(dryDockProjectId: string, section: "daily-reports" | "delays") {
  return `/superintendent/monitoring/${section}?dryDockProjectId=${encodeURIComponent(dryDockProjectId)}`;
}

export function projectBudgetHref(dryDockProjectId: string, section?: "variations") {
  if (section) {
    return `/superintendent/budget/variations?dryDockProjectId=${encodeURIComponent(dryDockProjectId)}`;
  }
  return `/superintendent/budget?dryDockProjectId=${encodeURIComponent(dryDockProjectId)}`;
}

export function projectInProjectHref(
  dryDockProjectId: string,
  section:
    | "scope"
    | "timeline"
    | "workshops"
    | "documents"
    | "rfq"
    | "closeout"
    | "permits"
    | "procurement"
    | "inspections"
    | "sea-trial"
    | "shipyard"
    | "reports"
    | "resources"
    | "inputs/vessel"
    | "inputs/vessel-portal"
    | "inputs/superintendent"
    | "inputs/workshop"
    | "inputs/procurement"
    | "inputs/closeout"
    | "inputs/review"
    | "inputs/readiness",
) {
  return `/superintendent/projects/${dryDockProjectId}/${section}`;
}

export function projectVesselInputsHref(dryDockProjectId: string) {
  return projectInProjectHref(dryDockProjectId, "inputs/vessel");
}

export function projectInputReviewHref(dryDockProjectId: string) {
  return projectInProjectHref(dryDockProjectId, "inputs/review");
}

export function projectPreDockReadinessHref(dryDockProjectId: string) {
  return projectInProjectHref(dryDockProjectId, "inputs/readiness");
}

export function projectSuperintendentInputsHref(dryDockProjectId: string) {
  return projectInProjectHref(dryDockProjectId, "inputs/superintendent");
}

export function projectWorkshopInputsHref(dryDockProjectId: string) {
  return projectInProjectHref(dryDockProjectId, "inputs/workshop");
}

export function projectProcurementInputsHref(dryDockProjectId: string) {
  return projectInProjectHref(dryDockProjectId, "inputs/procurement");
}

export function projectCloseoutInputsHref(dryDockProjectId: string) {
  return projectInProjectHref(dryDockProjectId, "inputs/closeout");
}

export function projectVesselPortalHref(dryDockProjectId: string) {
  return projectInProjectHref(dryDockProjectId, "inputs/vessel-portal");
}

/** Related-record links scoped to a dry dock project. */
export function projectRelatedLinks(dryDockProjectId: string) {
  return [
    { label: "Checklist", href: projectPlanningHref(dryDockProjectId, "checklist") },
    { label: "Milestones", href: projectPlanningHref(dryDockProjectId, "milestones") },
    { label: "Risks", href: projectPlanningHref(dryDockProjectId, "risks") },
    { label: "Variations", href: projectBudgetHref(dryDockProjectId, "variations") },
    { label: "Daily reports", href: projectMonitoringHref(dryDockProjectId, "daily-reports") },
    { label: "Delays", href: projectMonitoringHref(dryDockProjectId, "delays") },
    { label: "Survey", href: projectScopedHref("survey", dryDockProjectId) },
    { label: "Spares", href: projectScopedHref("spares", dryDockProjectId) },
    { label: "Approvals", href: projectScopedHref("approvals", dryDockProjectId) },
  ] as const;
}
