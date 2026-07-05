import type { MtilDynamicTemplateDef } from "../../types";
import { buildTemplateId } from "../../standards";

const DEPT = "AUX" as const;
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

function ae(seq: number, key: string, label: string, overrides: Partial<MtilDynamicTemplateDef> = {}): MtilDynamicTemplateDef {
  return {
    key,
    templateId: buildTemplateId(DEPT, "AE", seq),
    label,
    autoFill: AUTO_FILL,
    photoSlots: PHOTOS,
    requiredAttachments: ATTACHMENTS,
    requiredReports: REPORTS,
    approvalWorkflow: APPROVAL,
    ...overrides,
  };
}

function blr(seq: number, key: string, label: string, overrides: Partial<MtilDynamicTemplateDef> = {}): MtilDynamicTemplateDef {
  return {
    key,
    templateId: buildTemplateId(DEPT, "BLR", seq),
    label,
    autoFill: AUTO_FILL,
    photoSlots: PHOTOS,
    requiredAttachments: ATTACHMENTS,
    requiredReports: REPORTS,
    approvalWorkflow: APPROVAL,
    ...overrides,
  };
}

/** Phase 2 — 25 catalog + supplemental auxiliary machinery templates. */
export const PHASE2_TEMPLATE_CATALOG: MtilDynamicTemplateDef[] = [
  ae(1, "ae_unit_overhaul", "Auxiliary Engine Unit Overhaul", { checklistRefs: ["AE_UNIT_OVERHAUL"], qaQcRequired: true, permitRequired: true }),
  ae(2, "ae_cyl_head_overhaul", "AE Cylinder Head Overhaul", { checklistRefs: ["AE_CYL_HEAD"], qaQcRequired: true }),
  ae(3, "ae_piston_overhaul", "AE Piston Overhaul", { checklistRefs: ["AE_PISTON"], measurementRefs: ["AE_CYL_WEAR"] }),
  ae(4, "ae_fuel_injector_overhaul", "AE Fuel Injector Overhaul", { checklistRefs: ["AE_FUEL_INJ"], measurementRefs: ["AE_FUEL_PRESS"] }),
  ae(5, "ae_turbo_overhaul", "AE Turbocharger Overhaul", { checklistRefs: ["AE_TURBO"], measurementRefs: ["AE_TURBO_RPM"] }),
  ae(6, "ae_governor_cal", "AE Governor Calibration", { checklistRefs: ["AE_GOVERNOR"], measurementRefs: ["AE_GOVERNOR_RESP"] }),
  ae(7, "ae_alternator_inspect", "Alternator Inspection", { checklistRefs: ["AE_ALTERNATOR"], measurementRefs: ["AE_ALT_INSULATION"] }),
  ae(8, "ae_emergency_gen_survey", "Emergency Generator Survey", { checklistRefs: ["AE_EMERGENCY_GEN"], classHoldPoint: true, qaQcRequired: true }),
  ae(9, "ae_starting_system", "AE Starting System Service", { checklistRefs: ["AE_STARTING"], measurementRefs: ["AE_START_AIR"] }),
  ae(10, "ae_lube_system", "AE Lubrication System Service", { checklistRefs: ["AE_LO_SYS"], measurementRefs: ["AE_LO_PRESS"] }),
  ae(11, "ae_cooling_system", "AE Cooling System Service", { checklistRefs: ["AE_COOL_SYS"], measurementRefs: ["AE_JCW_TEMP"] }),
  ae(12, "ae_fuel_system", "AE Fuel System Service", { checklistRefs: ["AE_FUEL_SYS"], measurementRefs: ["AE_FUEL_PRESS"] }),
  ae(13, "ae_load_test", "AE Load Test", { checklistRefs: ["AE_LOAD_TEST"], classHoldPoint: true, photoSlots: ["before", "after", "report"] }),
  ae(14, "ae_performance_test", "AE Performance Test", { checklistRefs: ["AE_PERF_TEST"], photoSlots: ["before", "after", "report"] }),
  ae(15, "ae_safety_trip_test", "AE Safety Trip Test", { checklistRefs: ["AE_SAFETY_TEST"], classHoldPoint: true }),
  ae(16, "pur_separator_overhaul", "Purifier Separator Overhaul", { checklistRefs: ["PUR_SEPARATOR"], qaQcRequired: true }),
  ae(17, "pur_feed_system", "Purifier Feed System Service", { checklistRefs: ["PUR_FEED"] }),
  ae(18, "pur_control_test", "Purifier Control Test", { checklistRefs: ["PUR_CONTROL"] }),
  ae(19, "compr_air_overhaul", "Air Compressor Overhaul", { checklistRefs: ["COMPR_AIR"], measurementRefs: ["AE_START_AIR"] }),
  ae(20, "compr_ref_service", "Refrigeration Compressor Service", { checklistRefs: ["COMPR_REF"], measurementRefs: ["REF_SUCTION_PRESS"] }),
  ae(21, "compr_control_test", "Compressor Control Test", { checklistRefs: ["COMPR_CONTROL"] }),
  ae(22, "compr_safety_test", "Compressor Safety Test", { checklistRefs: ["COMPR_SAFETY"], classHoldPoint: true }),
  ae(23, "he_exchanger_service", "Heat Exchanger Service", { checklistRefs: ["HE_EXCHANGER"], measurementRefs: ["HE_PRESS_DROP"] }),
  ae(24, "fwg_service", "Fresh Water Generator Service", { checklistRefs: ["FWG_SERVICE"], measurementRefs: ["FWG_SALINITY"] }),
  ae(25, "fwg_production_test", "FWG Production Test", { checklistRefs: ["FWG_PRODUCTION"], measurementRefs: ["FWG_SALINITY", "FWG_FLOW"] }),
];

export const PHASE2_SUPPLEMENTAL_TEMPLATES: MtilDynamicTemplateDef[] = [
  blr(1, "blr_burner_overhaul", "Boiler Burner Overhaul", { checklistRefs: ["BLR_BURNER"], qaQcRequired: true, permitRequired: true }),
  blr(2, "blr_tube_survey", "Boiler Tube Survey", { checklistRefs: ["BLR_TUBES"], classHoldPoint: true, qaQcRequired: true }),
  blr(3, "blr_safety_valve_test", "Boiler Safety Valve Test", { checklistRefs: ["BLR_SV_TEST"], classHoldPoint: true }),
  blr(4, "blr_hydro_test", "Boiler Hydrostatic Test", { checklistRefs: ["BLR_HYDRO"], classHoldPoint: true, qaQcRequired: true }),
  blr(5, "blr_feed_system", "Boiler Feed System Service", { checklistRefs: ["BLR_FEED"], measurementRefs: ["BLR_STEAM_PRESS"] }),
  blr(6, "blr_control_test", "Boiler Control System Test", { checklistRefs: ["BLR_CONTROL"] }),
  blr(7, "blr_general_service", "Boiler General Service", { checklistRefs: ["BLR_GENERAL"] }),
  ae(26, "steer_gear_survey", "Steering Gear Survey", { checklistRefs: ["STEER_GEAR"], classHoldPoint: true, qaQcRequired: true }),
  ae(27, "steer_hydraulic_service", "Steering Hydraulic Service", { checklistRefs: ["STEER_HYD"], measurementRefs: ["STEER_HYD_PRESS"] }),
  ae(28, "steer_alarm_test", "Steering Alarm Test", { checklistRefs: ["STEER_ALARM"], classHoldPoint: true }),
  ae(29, "ae_general_inspect", "AE General Inspection", { photoSlots: ["before", "after"] }),
];

export function getPhase2TemplateCatalog(): MtilDynamicTemplateDef[] {
  return PHASE2_TEMPLATE_CATALOG;
}

export function getAllPhase2Templates(): MtilDynamicTemplateDef[] {
  return [...PHASE2_TEMPLATE_CATALOG, ...PHASE2_SUPPLEMENTAL_TEMPLATES];
}

export function getPhase2TemplateByKey(key: string): MtilDynamicTemplateDef | null {
  return getAllPhase2Templates().find((t) => t.key === key) ?? null;
}
