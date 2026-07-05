import type { MtilDynamicTemplateDef } from "../../types";
import { buildTemplateId } from "../../standards";

const ME = "ENG" as const;
const SYS = "ME" as const;

const STANDARD_AUTO_FILL: MtilDynamicTemplateDef["autoFill"] = [
  "vessel.name",
  "vessel.imo",
  "machinery.runningHours",
  "machinery.lastOverhaul",
  "machinery.maker",
  "machinery.model",
];

const STANDARD_PHOTOS: MtilDynamicTemplateDef["photoSlots"] = ["before", "during", "after"];
const STANDARD_ATTACHMENTS = ["work_permit", "risk_assessment", "maker_procedure"];
const STANDARD_REPORTS = ["completion_report"];
const STANDARD_APPROVAL = ["crew_submit", "ce_review", "master_review", "superintendent_approve"];

function tpl(
  seq: number,
  key: string,
  label: string,
  overrides: Partial<MtilDynamicTemplateDef> = {},
): MtilDynamicTemplateDef {
  return {
    key,
    templateId: buildTemplateId(ME, SYS, seq),
    label,
    autoFill: STANDARD_AUTO_FILL,
    photoSlots: STANDARD_PHOTOS,
    requiredAttachments: STANDARD_ATTACHMENTS,
    requiredReports: STANDARD_REPORTS,
    approvalWorkflow: STANDARD_APPROVAL,
    ...overrides,
  };
}

/** Phase 1 — 25 planned Main Propulsion dynamic templates (MTIL v0.2 catalog). */
export const PHASE1_TEMPLATE_CATALOG: MtilDynamicTemplateDef[] = [
  tpl(1, "me_unit_overhaul", "Main Engine Unit Overhaul", {
    checklistRefs: ["ME_UNIT_OVERHAUL"],
    qaQcRequired: true,
    permitRequired: true,
    photoSlots: ["before", "during", "after", "defect"],
  }),
  tpl(2, "me_cyl_head_overhaul", "Cylinder Head Overhaul", {
    checklistRefs: ["ME_CYL_HEAD_OVERHAUL"],
    measurementRefs: ["ME_EXH_GAS_TEMP"],
    qaQcRequired: true,
    permitRequired: true,
  }),
  tpl(3, "me_exh_valve_overhaul", "Exhaust Valve Overhaul", {
    checklistRefs: ["ME_EXH_VALVE_OVERHAUL"],
    measurementRefs: ["ME_EXH_GAS_TEMP"],
    qaQcRequired: true,
  }),
  tpl(4, "me_piston_overhaul", "Piston Overhaul", {
    checklistRefs: ["ME_PISTON_OVERHAUL"],
    measurementRefs: ["ME_CYL_LINER_WEAR", "ME_CYL_LINER_OVAL", "ME_PISTON_CROWN_TEMP"],
    classHoldPoint: true,
    qaQcRequired: true,
  }),
  tpl(5, "me_fuel_pump_overhaul", "Fuel Pump Overhaul", {
    checklistRefs: ["ME_FUEL_PUMP_OVERHAUL"],
    measurementRefs: ["ME_FUEL_INJ_PRESS"],
    qaQcRequired: true,
  }),
  tpl(6, "me_fuel_injector_overhaul", "Fuel Injector Overhaul", {
    checklistRefs: ["ME_FUEL_INJECTOR_OVERHAUL"],
    measurementRefs: ["ME_FUEL_INJ_PRESS"],
  }),
  tpl(7, "me_turbo_overhaul", "Turbocharger Overhaul", {
    checklistRefs: ["ME_TURBO_OVERHAUL"],
    measurementRefs: ["ME_TURBO_RPM", "ME_TURBO_EXH_TEMP"],
    qaQcRequired: true,
  }),
  tpl(8, "me_crank_deflection", "Crankshaft Deflection Measurement", {
    checklistRefs: ["ME_CRANK_DEFLECTION"],
    measurementRefs: ["ME_CRANK_DEFLECT_A", "ME_CRANK_DEFLECT_B"],
    classHoldPoint: true,
    qaQcRequired: true,
    photoSlots: ["before", "during", "after", "report"],
  }),
  tpl(9, "me_main_bearing", "Main Bearing Inspection", {
    checklistRefs: ["ME_MAIN_BEARING"],
    measurementRefs: ["ME_MAIN_BRG_CLEARANCE"],
    classHoldPoint: true,
    qaQcRequired: true,
  }),
  tpl(10, "me_crankpin_bearing", "Crankpin Bearing Inspection", {
    checklistRefs: ["ME_CRANKPIN_BEARING"],
    measurementRefs: ["ME_CRANKPIN_CLEARANCE"],
    classHoldPoint: true,
    qaQcRequired: true,
  }),
  tpl(11, "me_crosshead_bearing", "Crosshead Bearing Inspection", {
    checklistRefs: ["ME_CROSSHEAD_BEARING"],
    measurementRefs: ["ME_CROSSHEAD_CLEARANCE"],
    qaQcRequired: true,
  }),
  tpl(12, "me_thrust_block", "Thrust Block Inspection", {
    checklistRefs: ["ME_THRUST_BLOCK"],
    measurementRefs: ["ME_THRUST_CLEARANCE"],
    classHoldPoint: true,
    qaQcRequired: true,
  }),
  tpl(13, "me_inter_shaft_bearing", "Intermediate Shaft Bearing Inspection", {
    checklistRefs: ["ME_INTER_SHAFT_BEARING"],
    measurementRefs: ["ME_INTER_BEARING_TEMP", "ME_INTER_BRG_CLEARANCE"],
    classHoldPoint: true,
    qaQcRequired: true,
  }),
  tpl(14, "me_inter_shaft_align", "Intermediate Shaft Alignment", {
    checklistRefs: ["ME_INTER_SHAFT_ALIGN"],
    measurementRefs: ["ME_SHAFT_ALIGNMENT"],
    classHoldPoint: true,
    qaQcRequired: true,
    photoSlots: ["before", "during", "after", "report"],
  }),
  tpl(15, "me_stern_bearing", "Stern Tube Bearing Inspection", {
    checklistRefs: ["ME_STERN_BEARING"],
    measurementRefs: ["ME_STERN_TUBE_OIL", "ME_STERN_BRG_CLEARANCE"],
    classHoldPoint: true,
    qaQcRequired: true,
  }),
  tpl(16, "me_stern_seal_renewal", "Stern Tube Seal Renewal", {
    checklistRefs: ["ME_STERN_SEAL_RENEWAL"],
    measurementRefs: ["ME_STERN_SEAL_CHAMBER"],
    classHoldPoint: true,
    qaQcRequired: true,
    permitRequired: true,
  }),
  tpl(17, "me_maneuvering_5yr", "Maneuvering System 5-Year Maintenance", {
    checklistRefs: ["ME_MANEUVERING_5YR"],
    measurementRefs: ["ME_MANEUVER_TIME"],
    classHoldPoint: true,
    photoSlots: ["before", "after", "report"],
  }),
  tpl(18, "me_pneumatic_5yr", "Pneumatic Control System 5-Year Maintenance", {
    checklistRefs: ["ME_PNEUMATIC_5YR"],
    classHoldPoint: true,
  }),
  tpl(19, "me_start_air_valve", "Starting Air Valve Overhaul", {
    checklistRefs: ["ME_START_AIR_VALVE"],
    measurementRefs: ["ME_START_AIR_PRESS"],
  }),
  tpl(20, "me_governor_cal", "Governor Calibration", {
    checklistRefs: ["ME_GOVERNOR_CAL"],
    measurementRefs: ["ME_GOVERNOR_RESPONSE"],
    qaQcRequired: true,
  }),
  tpl(21, "me_remote_control_test", "Remote Control System Test", {
    checklistRefs: ["ME_REMOTE_CONTROL"],
    classHoldPoint: true,
    photoSlots: ["before", "after", "report"],
  }),
  tpl(22, "me_emergency_stop", "Emergency Stop Test", {
    checklistRefs: ["ME_EMERGENCY_STOP"],
    classHoldPoint: true,
    photoSlots: ["before", "after", "report"],
  }),
  tpl(23, "me_overspeed_trip", "Overspeed Trip Test", {
    checklistRefs: ["ME_OVERSPEED_TRIP"],
    measurementRefs: ["ME_OVERSPEED_TRIP"],
    classHoldPoint: true,
    qaQcRequired: true,
    photoSlots: ["before", "after", "report"],
  }),
  tpl(24, "me_performance_test", "Main Engine Performance Test", {
    checklistRefs: ["ME_PERFORMANCE_TEST"],
    measurementRefs: [
      "ME_FUEL_INJ_PRESS",
      "ME_EXH_GAS_TEMP",
      "ME_SCAV_AIR_PRESS",
      "ME_LO_PRESS",
    ],
    classHoldPoint: true,
    photoSlots: ["before", "after", "report"],
    requiredReports: ["performance_report", "completion_report"],
  }),
  tpl(25, "me_sea_trial", "Sea Trial Verification", {
    checklistRefs: ["ME_SEA_TRIAL"],
    measurementRefs: ["ME_SHAFT_ALIGNMENT", "ME_MANEUVER_TIME"],
    classHoldPoint: true,
    qaQcRequired: true,
    photoSlots: ["before", "after", "report"],
    requiredReports: ["sea_trial_report", "completion_report"],
    approvalWorkflow: [...STANDARD_APPROVAL, "class_witness"],
  }),
];

/** Supplemental templates — reuse catalog layouts for matrix-generated jobs. */
export const PHASE1_SUPPLEMENTAL_TEMPLATES: MtilDynamicTemplateDef[] = [
  tpl(26, "me_cylinder_survey", "Cylinder Liner Survey", {
    checklistRefs: ["ME_CYLINDER_SURVEY"],
    measurementRefs: ["ME_CYL_LINER_WEAR", "ME_CYL_LINER_OVAL", "ME_EXH_GAS_TEMP"],
    classHoldPoint: true,
    qaQcRequired: true,
  }),
  tpl(27, "me_lube_system", "Lubrication System Service", {
    measurementRefs: ["ME_LO_PRESS"],
    checklistRefs: ["ME_OVERHAUL_STANDARD"],
  }),
  tpl(28, "me_cooling_system", "Cooling System Service", {
    measurementRefs: ["ME_JCW_TEMP_IN", "ME_JCW_TEMP_OUT"],
  }),
  tpl(29, "me_fuel_system", "Fuel System Service", {
    measurementRefs: ["ME_FUEL_INJ_PRESS"],
    checklistRefs: ["ME_FUEL_PUMP_OVERHAUL"],
  }),
  tpl(30, "me_general_inspect", "General Inspection", {
    photoSlots: ["before", "after"],
  }),
  tpl(31, "me_instrument_test", "Instrument Test & Calibration", {
    checklistRefs: ["ME_INSTRUMENT_TEST"],
    photoSlots: ["before", "after", "report"],
  }),
  tpl(32, "me_reversing", "Reversing System Service", {
    checklistRefs: ["ME_OVERHAUL_STANDARD"],
  }),
  tpl(33, "me_safety_test", "Safety Systems Test", {
    checklistRefs: ["ME_SAFETY_TEST"],
    classHoldPoint: true,
    photoSlots: ["before", "after", "report"],
  }),
];

export function getPhase1TemplateCatalog(): MtilDynamicTemplateDef[] {
  return PHASE1_TEMPLATE_CATALOG;
}

export function getAllPhase1Templates(): MtilDynamicTemplateDef[] {
  return [...PHASE1_TEMPLATE_CATALOG, ...PHASE1_SUPPLEMENTAL_TEMPLATES];
}

export function getPhase1TemplateByKey(key: string): MtilDynamicTemplateDef | null {
  return getAllPhase1Templates().find((t) => t.key === key) ?? null;
}
