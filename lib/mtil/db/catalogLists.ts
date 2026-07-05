import type { JobCatalogListType } from "@prisma/client";
import { MTIL_PROJECT_TYPES, MTIL_VESSEL_TYPES } from "@/lib/mtil/standards";

export type CatalogListSeedRow = {
  listType: JobCatalogListType;
  value: string;
  label: string;
  sortOrder: number;
};

const DEPARTMENTS = [
  { value: "engine", label: "Engine" },
  { value: "deck", label: "Deck" },
  { value: "electrical", label: "Electrical" },
  { value: "hull", label: "Hull" },
  { value: "safety", label: "Safety" },
  { value: "cargo", label: "Cargo" },
  { value: "accommodation", label: "Accommodation" },
];

const WORKSHOPS = [
  { value: "machinery", label: "Machinery Workshop" },
  { value: "pipe", label: "Pipe Workshop" },
  { value: "steel", label: "Steel Workshop" },
  { value: "hull", label: "Hull Workshop" },
  { value: "paint", label: "Paint Workshop" },
  { value: "electrical", label: "Electrical Workshop" },
  { value: "deck", label: "Deck Workshop" },
  { value: "safety", label: "Safety Workshop" },
  { value: "qa_qc", label: "QA/QC" },
];

const RISK_LEVELS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

const ATTACHMENT_TYPES = [
  { value: "photo", label: "Photo" },
  { value: "report", label: "Report" },
  { value: "certificate", label: "Certificate" },
  { value: "drawing", label: "Drawing" },
  { value: "video", label: "Video" },
  { value: "manual", label: "Manual" },
];

const JOB_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "reviewed", label: "Reviewed" },
  { value: "approved", label: "Approved" },
  { value: "rfq", label: "RFQ" },
  { value: "awarded", label: "Awarded" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "closed", label: "Closed" },
  { value: "cancelled", label: "Cancelled" },
];

const USER_ROLES = [
  { value: "chief_engineer", label: "Chief Engineer" },
  { value: "master", label: "Master" },
  { value: "superintendent", label: "Technical Superintendent" },
  { value: "technical_manager", label: "Technical Manager" },
  { value: "shipyard_planner", label: "Shipyard Planner" },
  { value: "machinery_supervisor", label: "Machinery Supervisor" },
  { value: "class_surveyor", label: "Class Surveyor" },
];

function listRows(
  listType: JobCatalogListType,
  items: Array<{ value: string; label: string }>,
): CatalogListSeedRow[] {
  return items.map((item, i) => ({
    listType,
    value: item.value,
    label: item.label,
    sortOrder: i + 1,
  }));
}

/** Tab 10 — Lists sheet seed rows aligned with lib/jobs/catalogSchema.ts */
export function buildCatalogListItems(): CatalogListSeedRow[] {
  return [
    ...listRows(
      "project_types",
      MTIL_PROJECT_TYPES.map((p) => ({
        value: p.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
        label: p,
      })),
    ),
    ...listRows(
      "vessel_types",
      MTIL_VESSEL_TYPES.map((v) => ({
        value: v.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
        label: v,
      })),
    ),
    ...listRows("departments", DEPARTMENTS),
    ...listRows("workshops", WORKSHOPS),
    ...listRows("risk_levels", RISK_LEVELS),
    ...listRows("attachment_types", ATTACHMENT_TYPES),
    ...listRows("job_statuses", JOB_STATUSES),
    ...listRows("user_roles", USER_ROLES),
  ];
}

export function getCatalogListItemCount(): number {
  return buildCatalogListItems().length;
}
