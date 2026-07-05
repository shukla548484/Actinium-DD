/** MTIL v0.2 / Master Code Standard v1.0 — Excel / PostgreSQL import ready. */

export const MTIL_ENGINE_VERSION = "0.2.0";

/** Active production track — normalized engineering database (replaces R0.x phase expansion). */
export {
  MTIL_V2_ENGINE_VERSION,
  MTIL_V2_LIBRARY_VERSION,
  MTIL_V2_DATABASE_TARGETS,
} from "./v2/standards";

export {
  MASTER_ENTITY_CODES,
  EXTENDED_ENTITY_CODES,
  MASTER_EQUIPMENT_SYSTEM_CODES,
  MASTER_CODE_ENTITY_CATALOG,
  MASTER_CODE_STANDARD_VERSION,
  buildMasterCode,
  buildStandardJobId,
  buildDynamicTemplateId,
  buildMeasurementSetId,
  buildInspectionSetId,
  buildScopeOfWorkId,
  buildWorkflowId,
  buildSpareMapId,
  buildRfqMappingId,
  normalizeMasterId,
  parseMasterCode,
  isCanonicalMasterId,
  measurementSetIdForTemplateId,
  inspectionSetIdForTemplateId,
  scopeOfWorkIdForTemplateId,
  workflowIdForTemplateId,
} from "./masterCodeStandard";

export type MtilDeptCode = "ENG" | "AUX" | "PVP" | "DKC" | "HUL" | "ELC" | "SAF";

export type MtilSystemCode =
  | "ME"
  | "AE"
  | "BLR"
  | "PMP"
  | "DKM"
  | "HUL"
  | "ELC"
  | "SAF";

export const MTIL_VESSEL_TYPES = [
  "Bulk Carrier",
  "Tanker",
  "Oil Tanker",
  "Product Tanker",
  "Chemical Tanker",
  "Container",
  "Container Ship",
  "General Cargo",
  "MPP",
  "Ro-Ro",
  "LNG Carrier",
  "LPG Carrier",
  "Offshore Support",
  "Passenger",
  "All Types",
] as const;

export type MtilVesselType = (typeof MTIL_VESSEL_TYPES)[number];

export const MTIL_PROJECT_TYPES = [
  "Special Survey",
  "Intermediate Survey",
  "Damage Repair",
  "Occasional Repair",
  "Underwater Survey",
  "New Installation",
  "Emergency Docking",
  "Lay-up / Reactivation",
  "Conversion / Modification",
  "Warranty Repair",
] as const;

export type MtilProjectType = (typeof MTIL_PROJECT_TYPES)[number];

export const MTIL_APPROVAL_WORKFLOWS = [
  "crew_submit",
  "ce_review",
  "master_review",
  "superintendent_approve",
  "class_witness",
] as const;

export type MtilApprovalWorkflow = (typeof MTIL_APPROVAL_WORKFLOWS)[number];

function padSeq(seq: number, width = 4): string {
  return String(seq).padStart(width, "0");
}

/** @deprecated Prefer buildStandardJobId(system, subsystem, seq) for V2.0+ libraries. */
export function buildJobId(dept: MtilDeptCode, system: MtilSystemCode, seq: number): string {
  return `JOBS-${dept}-${system}-${padSeq(seq)}`;
}

/** @deprecated Prefer buildDynamicTemplateId(system, subsystem, seq) for V2.0+ libraries. */
export function buildTemplateId(dept: MtilDeptCode, system: MtilSystemCode, seq: number): string {
  return `TMPL-${dept}-${system}-${padSeq(seq)}`;
}

export function buildInspectionId(dept: MtilDeptCode, system: MtilSystemCode, seq: number): string {
  return `INSP-${dept}-${system}-${padSeq(seq)}`;
}

export function buildMeasurementId(dept: MtilDeptCode, system: MtilSystemCode, seq: number): string {
  return `MEAS-${dept}-${system}-${padSeq(seq)}`;
}

export function buildRfqId(dept: MtilDeptCode, system: MtilSystemCode, seq: number): string {
  return `RFQM-${dept}-${system}-${padSeq(seq)}`;
}

export function buildBudgetCode(dept: MtilDeptCode, seq: number): string {
  return `BUD-DD-${dept}-${padSeq(seq)}`;
}

/** Legacy internal code — retained for stable DB keys and generator sequencing. */
export function buildMtilJobCode(input: {
  phase: number;
  systemCode: string;
  componentCode: string;
  action: string;
  sequence: number;
}): string {
  const seq = String(input.sequence).padStart(3, "0");
  return `MTIL-P${input.phase}-${input.systemCode}-${input.componentCode}-${input.action}-${seq}`.toUpperCase();
}

export function buildCostCode(input: {
  phase: number;
  workshop: string;
  systemCode: string;
}): string {
  const ws = input.workshop.slice(0, 3).toUpperCase();
  return `DD-P${input.phase}-${ws}-${input.systemCode}`.toUpperCase();
}
