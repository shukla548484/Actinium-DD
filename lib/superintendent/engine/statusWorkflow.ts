import type { DryDockProjectStatus } from "@prisma/client";
import type { DdProjectModuleId } from "./projectModules";

/** Primary lifecycle path — side states (on_hold, cancelled, reopened) apply at any stage. */
export const DD_STATUS_LIFECYCLE: DryDockProjectStatus[] = [
  "draft",
  "planning",
  "budgeting",
  "rfq_issued",
  "quote_evaluation",
  "approved",
  "mobilization",
  "docking",
  "execution",
  "sea_trial",
  "final_inspection",
  "completed",
  "closed",
  "archived",
];

export const DD_STATUS_SIDE_STATES: DryDockProjectStatus[] = [
  "on_hold",
  "cancelled",
  "reopened",
];

/** Legacy statuses kept for backward compatibility during migration. */
export const DD_STATUS_LEGACY: DryDockProjectStatus[] = [
  "tendering",
  "awarded",
  "in_progress",
];

export const DD_STATUS_LABELS: Record<DryDockProjectStatus, string> = {
  draft: "Draft",
  planning: "Planning",
  budgeting: "Budgeting",
  rfq_issued: "RFQ Issued",
  quote_evaluation: "Quote Evaluation",
  tendering: "Tendering",
  approved: "Approved",
  mobilization: "Mobilization",
  awarded: "Awarded",
  docking: "Docking",
  in_progress: "In Progress",
  execution: "Execution",
  sea_trial: "Sea Trial",
  final_inspection: "Final Inspection",
  completed: "Completed",
  closed: "Closed",
  archived: "Archived",
  on_hold: "On Hold",
  cancelled: "Cancelled",
  reopened: "Reopened",
};

/** Allowed forward transitions from each status (excluding side states). */
export const DD_STATUS_TRANSITIONS: Partial<Record<DryDockProjectStatus, DryDockProjectStatus[]>> = {
  draft: ["planning", "cancelled"],
  planning: ["budgeting", "on_hold", "cancelled"],
  budgeting: ["rfq_issued", "on_hold", "cancelled"],
  rfq_issued: ["quote_evaluation", "tendering", "on_hold", "cancelled"],
  quote_evaluation: ["approved", "on_hold", "cancelled"],
  tendering: ["quote_evaluation", "awarded", "approved", "on_hold", "cancelled"],
  approved: ["mobilization", "awarded", "on_hold", "cancelled"],
  awarded: ["mobilization", "in_progress", "execution", "on_hold", "cancelled"],
  mobilization: ["docking", "on_hold", "cancelled"],
  docking: ["execution", "in_progress", "on_hold", "cancelled"],
  in_progress: ["execution", "sea_trial", "on_hold", "cancelled"],
  execution: ["sea_trial", "on_hold", "cancelled"],
  sea_trial: ["final_inspection", "on_hold", "cancelled"],
  final_inspection: ["completed", "on_hold", "cancelled"],
  completed: ["closed", "reopened"],
  closed: ["archived", "reopened"],
  archived: ["reopened"],
  on_hold: ["reopened", "planning", "budgeting", "execution", "cancelled"],
  cancelled: ["reopened"],
  reopened: ["planning", "budgeting", "execution"],
};

export function getAllowedTransitions(from: DryDockProjectStatus) {
  const allowed = DD_STATUS_TRANSITIONS[from] ?? [];
  return {
    forward: allowed.filter((s) => DD_STATUS_LIFECYCLE.includes(s)),
    side: allowed.filter((s) => DD_STATUS_SIDE_STATES.includes(s)),
    legacy: allowed.filter((s) => DD_STATUS_LEGACY.includes(s)),
    all: allowed,
  };
}

export function canTransitionStatus(
  from: DryDockProjectStatus,
  to: DryDockProjectStatus,
): boolean {
  if (from === to) return true;
  const allowed = DD_STATUS_TRANSITIONS[from];
  return allowed?.includes(to) ?? false;
}

export function getStatusLabel(status: DryDockProjectStatus): string {
  return DD_STATUS_LABELS[status] ?? status;
}

/** Statuses shown on create form (early lifecycle only). */
export const DD_CREATE_STATUS_OPTIONS: DryDockProjectStatus[] = [
  "draft",
  "planning",
  "budgeting",
];
