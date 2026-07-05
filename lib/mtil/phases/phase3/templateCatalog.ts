import type { MtilDynamicTemplateDef } from "../../types";
import { buildTemplateId } from "../../standards";

const DEPT = "PVP" as const;
const SYS = "PMP" as const;
const AUTO_FILL: MtilDynamicTemplateDef["autoFill"] = [
  "vessel.name",
  "vessel.imo",
  "machinery.runningHours",
  "machinery.lastOverhaul",
  "machinery.maker",
  "machinery.model",
];
const PHOTOS: MtilDynamicTemplateDef["photoSlots"] = ["before", "during", "after"];
const ATTACHMENTS = ["work_permit", "risk_assessment", "maker_procedure"];
const REPORTS = ["completion_report"];
const APPROVAL = ["crew_submit", "ce_review", "master_review", "superintendent_approve"];

function pmp(seq: number, key: string, label: string, overrides: Partial<MtilDynamicTemplateDef> = {}): MtilDynamicTemplateDef {
  return {
    key,
    templateId: buildTemplateId(DEPT, SYS, seq),
    label,
    autoFill: AUTO_FILL,
    photoSlots: PHOTOS,
    requiredAttachments: ATTACHMENTS,
    requiredReports: REPORTS,
    approvalWorkflow: APPROVAL,
    ...overrides,
  };
}

/** Phase 3 — 25 catalog + supplemental pumps/valves/piping templates. */
export const PHASE3_TEMPLATE_CATALOG: MtilDynamicTemplateDef[] = [
  pmp(1, "pmp_cent_overhaul", "Centrifugal Pump Overhaul", { checklistRefs: ["PMP_CENT_OVERHAUL"], qaQcRequired: true, permitRequired: true }),
  pmp(2, "pmp_impeller_inspect", "Pump Impeller Inspection", { checklistRefs: ["PMP_IMPELLER"], measurementRefs: ["PMP_VIBRATION"] }),
  pmp(3, "pmp_seal_renewal", "Mechanical Seal Renewal", { checklistRefs: ["PMP_SEAL"], measurementRefs: ["PMP_SEAL_LEAK"] }),
  pmp(4, "pmp_bearing_inspect", "Pump Bearing Inspection", { checklistRefs: ["PMP_BEARING"], measurementRefs: ["PMP_BEAR_CLEAR"] }),
  pmp(5, "pmp_alignment", "Pump-Motor Alignment", { checklistRefs: ["PMP_ALIGNMENT"], measurementRefs: ["PMP_ALIGN_OFFSET"] }),
  pmp(6, "pmp_npsh_test", "Pump Performance / NPSH Test", { checklistRefs: ["PMP_PERF"], measurementRefs: ["PMP_FLOW", "PMP_HEAD", "PMP_NPSH"] }),
  pmp(7, "pmp_gear_overhaul", "Gear Pump Overhaul", { checklistRefs: ["PMP_GEAR"], qaQcRequired: true }),
  pmp(8, "pmp_screw_overhaul", "Screw Pump Overhaul", { checklistRefs: ["PMP_SCREW"], qaQcRequired: true }),
  pmp(9, "pmp_fire_pump_survey", "Fire Pump Survey", { checklistRefs: ["PMP_FIRE_SURVEY"], classHoldPoint: true, qaQcRequired: true }),
  pmp(10, "pmp_emergency_fire_test", "Emergency Fire Pump Test", { checklistRefs: ["PMP_FIRE_TEST"], classHoldPoint: true }),
  pmp(11, "pmp_ballast_overhaul", "Ballast Pump Overhaul", { checklistRefs: ["PMP_BALLAST"], qaQcRequired: true }),
  pmp(12, "pmp_bilge_overhaul", "Bilge Pump Overhaul", { checklistRefs: ["PMP_BILGE"] }),
  pmp(13, "pmp_stripping", "Stripping Pump Service", { checklistRefs: ["PMP_STRIPPING"], measurementRefs: ["PMP_FLOW"] }),
  pmp(14, "valve_globe_overhaul", "Globe Valve Overhaul", { checklistRefs: ["VAL_GLOBE"], qaQcRequired: true }),
  pmp(15, "valve_gate_overhaul", "Gate Valve Overhaul", { checklistRefs: ["VAL_GATE"], qaQcRequired: true }),
  pmp(16, "valve_butterfly_service", "Butterfly Valve Service", { checklistRefs: ["VAL_BFLY"] }),
  pmp(17, "valve_relief_test", "Relief Valve Test", { checklistRefs: ["VAL_RELIEF"], measurementRefs: ["VAL_SET_PRESS"] }),
  pmp(18, "valve_safety_test", "Safety Valve Test", { checklistRefs: ["VAL_SAFETY"], classHoldPoint: true, measurementRefs: ["VAL_SET_PRESS"] }),
  pmp(19, "valve_check_inspect", "Check Valve Inspection", { checklistRefs: ["VAL_CHECK"] }),
  pmp(20, "valve_control_overhaul", "Control Valve Overhaul", { checklistRefs: ["VAL_CONTROL"], measurementRefs: ["VAL_STROKE"] }),
  pmp(21, "pipe_steam_survey", "Steam Piping Survey", { checklistRefs: ["PIPE_STEAM"], measurementRefs: ["PIPE_STEAM_TEMP"] }),
  pmp(22, "pipe_fuel_survey", "Fuel Oil Piping Survey", { checklistRefs: ["PIPE_FUEL"], permitRequired: true }),
  pmp(23, "pipe_lo_survey", "LO Piping Survey", { checklistRefs: ["PIPE_LO"] }),
  pmp(24, "pipe_sw_survey", "Sea Water Piping Survey", { checklistRefs: ["PIPE_SW"], measurementRefs: ["PIPE_WALL_THICK"] }),
  pmp(25, "pipe_hydro_test", "Piping Hydrostatic Test", { checklistRefs: ["PIPE_HYDRO"], classHoldPoint: true, qaQcRequired: true, measurementRefs: ["PIPE_TEST_PRESS"] }),
];

export const PHASE3_SUPPLEMENTAL_TEMPLATES: MtilDynamicTemplateDef[] = [
  pmp(26, "pmp_general_inspect", "Pump General Inspection", { photoSlots: ["before", "after"] }),
  pmp(27, "valve_general_inspect", "Valve General Inspection", { photoSlots: ["before", "after"] }),
  pmp(28, "pipe_general_inspect", "Piping General Inspection", { photoSlots: ["before", "after"] }),
  pmp(29, "pmp_motor_coupling", "Pump Motor & Coupling Service", { checklistRefs: ["PMP_MOTOR"], measurementRefs: ["PMP_VIBRATION"] }),
  pmp(30, "valve_grease_service", "Valve Greasing Service", { checklistRefs: ["VAL_GREASE"] }),
  pmp(31, "pipe_flange_inspect", "Flange & Gasket Inspection", { checklistRefs: ["PIPE_FLANGE"] }),
  pmp(32, "pmp_cavitation_test", "Pump Cavitation Test", { checklistRefs: ["PMP_CAVITATION"], measurementRefs: ["PMP_NPSH", "PMP_VIBRATION"] }),
];

export function getPhase3TemplateCatalog(): MtilDynamicTemplateDef[] {
  return PHASE3_TEMPLATE_CATALOG;
}

export function getAllPhase3Templates(): MtilDynamicTemplateDef[] {
  return [...PHASE3_TEMPLATE_CATALOG, ...PHASE3_SUPPLEMENTAL_TEMPLATES];
}

export function getPhase3TemplateByKey(key: string): MtilDynamicTemplateDef | null {
  return getAllPhase3Templates().find((t) => t.key === key) ?? null;
}
