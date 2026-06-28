import { enumSelectItems } from "@/lib/ui/labeledSelect";

export const JOB_CATEGORIES = [
  "docking",
  "hull",
  "painting",
  "steel",
  "ME",
  "AE",
  "boiler",
  "pumps",
  "piping",
  "electrical",
  "navigation",
  "safety",
  "deck",
  "cargo",
  "tanks",
  "miscellaneous",
] as const;

export type JobCategory = (typeof JOB_CATEGORIES)[number];

export const APPROVAL_TYPES = [
  "budget",
  "variation",
  "job_change",
  "scope_change",
  "extension",
  "class_deviation",
  "other",
] as const;

export type ApprovalType = (typeof APPROVAL_TYPES)[number];

export const SURVEY_TYPES = [
  "class_survey",
  "statutory",
  "special_survey",
  "intermediate_survey",
  "annual_survey",
  "underwater_inspection",
  "thickness_measurement",
  "machinery_survey",
  "boiler_survey",
  "other",
] as const;

export type SurveyType = (typeof SURVEY_TYPES)[number];

export const JOB_CATEGORY_ITEMS = enumSelectItems(JOB_CATEGORIES);
export const APPROVAL_TYPE_ITEMS = enumSelectItems(APPROVAL_TYPES);
export const SURVEY_TYPE_ITEMS = enumSelectItems(SURVEY_TYPES);

export const JOB_PRIORITY_ITEMS = enumSelectItems(["low", "medium", "high", "critical"] as const);
export const JOB_STATUS_ITEMS = enumSelectItems([
  "planned",
  "in_progress",
  "pending_approval",
  "completed",
  "closed",
] as const);

export const RISK_LEVEL_ITEMS = enumSelectItems(["low", "medium", "high", "critical"] as const);

export const DD_PROJECT_STATUS_ITEMS = enumSelectItems([
  "draft",
  "planning",
  "budgeting",
  "rfq_issued",
  "quote_evaluation",
  "tendering",
  "approved",
  "mobilization",
  "awarded",
  "docking",
  "in_progress",
  "execution",
  "sea_trial",
  "final_inspection",
  "completed",
  "closed",
  "archived",
  "on_hold",
  "cancelled",
  "reopened",
] as const);

export const DD_PROJECT_CREATE_STATUS_ITEMS = enumSelectItems([
  "draft",
  "planning",
  "budgeting",
] as const);

export const DD_PROJECT_PRIORITY_ITEMS = enumSelectItems(["low", "medium", "high", "critical"] as const);

export const APPROVAL_STATUS_ITEMS = enumSelectItems(["pending", "approved", "rejected"] as const);
export const SPARES_STATUS_ITEMS = enumSelectItems([
  "required",
  "ordered",
  "in_transit",
  "on_board",
  "cancelled",
] as const);
export const SURVEY_STATUS_ITEMS = enumSelectItems([
  "pending",
  "scheduled",
  "in_progress",
  "completed",
  "deferred",
] as const);

export const VESSEL_JOB_SOURCE_ITEMS = enumSelectItems([
  "vessel",
  "pms",
  "class",
  "superintendent",
  "defect_report",
] as const);

export const VESSEL_JOB_STATUS_ITEMS = enumSelectItems([
  "draft",
  "submitted",
  "approved",
  "integrated",
  "rejected",
  "carry_forward",
] as const);
