import type { MtilChecklistItem } from "./types";
import { buildInspectionId } from "./standards";
import { MTIL_PHASE2_CHECKLISTS } from "./phases/phase2/checklistLibrary";
import { MTIL_PHASE3_CHECKLISTS } from "./phases/phase3/checklistLibrary";

const DEPT = "ENG" as const;
const SYS = "ME" as const;

let insSeq = 0;
function ins(label: string, opts: Partial<MtilChecklistItem> = {}): MtilChecklistItem {
  insSeq += 1;
  return {
    code: `CL-${String(insSeq).padStart(3, "0")}`,
    inspectionId: buildInspectionId(DEPT, SYS, insSeq),
    label,
    ...opts,
  };
}

function set(key: string, items: MtilChecklistItem[]): [string, MtilChecklistItem[]] {
  return [key, items];
}

/** Phase 1 — inspection checklist library (aligned to 25-template catalog). */
export const MTIL_PHASE1_CHECKLISTS: Record<string, MtilChecklistItem[]> = Object.fromEntries([
  set("ME_UNIT_OVERHAUL", [
    ins("Permit to work and LOTO verified", { holdPoint: true, qaQcRequired: true }),
    ins("Maker manual procedure followed"),
    ins("Running hours recorded before opening"),
    ins("Torque values and clearances recorded"),
    ins("Trial run and parameter check", { holdPoint: true }),
  ]),
  set("ME_CYL_HEAD_OVERHAUL", [
    ins("Fuel and starting air isolated", { holdPoint: true }),
    ins("Cylinder head lifted with approved rigging"),
    ins("Exhaust valve and fuel valve serviced"),
    ins("Head gasket and seals renewed"),
    ins("Pressure test completed", { classRequired: true }),
  ]),
  set("ME_EXH_VALVE_OVERHAUL", [
    ins("Valve spindle and seat inspected"),
    ins("Actuator linkage checked"),
    ins("Valve rotator / margin verified"),
    ins("Reassembled and leak tested"),
  ]),
  set("ME_PISTON_OVERHAUL", [
    ins("Piston rings and crown inspected", { classRequired: true }),
    ins("Ring groove clearance measured"),
    ins("Piston skirt condition photographed"),
    ins("Reassembled per maker torque"),
  ]),
  set("ME_FUEL_PUMP_OVERHAUL", [
    ins("Pump elements and barrels inspected"),
    ins("Plunger and barrel clearance checked"),
    ins("Timing and index marks verified"),
    ins("Injection pressure tested"),
  ]),
  set("ME_FUEL_INJECTOR_OVERHAUL", [
    ins("Nozzle tip and needle inspected"),
    ins("Opening pressure tested"),
    ins("Spray pattern verified"),
    ins("Heat shield and seals renewed"),
  ]),
  set("ME_TURBO_OVERHAUL", [
    ins("Rotor balance and blade condition checked"),
    ins("Bearings and seals renewed"),
    ins("Casing and silencer cleaned"),
    ins("Trial run parameters within limits", { holdPoint: true }),
  ]),
  set("ME_CRANK_DEFLECTION", [
    ins("Crankcase opened and secured", { holdPoint: true }),
    ins("Deflection readings at A and B positions", { classRequired: true }),
    ins("Readings compared to baseline"),
    ins("Deflection report attached", { holdPoint: true }),
  ]),
  set("ME_MAIN_BEARING", [
    ins("Bearing shells inspected", { classRequired: true }),
    ins("Clearance measured with lead wire / gauge"),
    ins("Oil grooves and condition checked"),
    ins("Reassembled and oil pressure verified"),
  ]),
  set("ME_CRANKPIN_BEARING", [
    ins("Connecting rod bearing inspected", { classRequired: true }),
    ins("Crankpin clearance measured"),
    ins("Shell condition photographed"),
  ]),
  set("ME_CROSSHEAD_BEARING", [
    ins("Crosshead bearing clearance measured"),
    ins("Sliding surfaces inspected"),
    ins("Lubrication grooves clear"),
  ]),
  set("ME_THRUST_BLOCK", [
    ins("Thrust pad condition inspected", { classRequired: true }),
    ins("Axial clearance measured", { holdPoint: true }),
    ins("Oil supply verified"),
  ]),
  set("ME_INTER_SHAFT_BEARING", [
    ins("Shaft line locked and secured", { holdPoint: true }),
    ins("Bearing temperature and clearance measured", { classRequired: true }),
    ins("Oil flow verified"),
  ]),
  set("ME_INTER_SHAFT_ALIGN", [
    ins("Alignment readings taken fore/aft", { classRequired: true }),
    ins("Sag and gap within limits"),
    ins("Alignment report attached", { holdPoint: true }),
  ]),
  set("ME_STERN_BEARING", [
    ins("Stern tube oil sample taken"),
    ins("Bearing clearance measured", { classRequired: true }),
    ins("Propeller shaft condition checked"),
  ]),
  set("ME_STERN_SEAL_RENEWAL", [
    ins("Seal chamber drained and secured", { holdPoint: true }),
    ins("Seal rings renewed per maker"),
    ins("Chamber pressure tested after renewal"),
  ]),
  set("ME_MANEUVERING_5YR", [
    ins("5-year service interval confirmed", { classRequired: true }),
    ins("All mandatory items completed per maker"),
    ins("Class attendance arranged if required", { holdPoint: true }),
  ]),
  set("ME_PNEUMATIC_5YR", [
    ins("Control air dryer and filters serviced"),
    ins("Valve actuators tested"),
    ins("Low pressure alarm tested", { classRequired: true }),
  ]),
  set("ME_START_AIR_VALVE", [
    ins("Starting valve dismantled and cleaned"),
    ins("Springs and seats inspected"),
    ins("Leak test completed"),
  ]),
  set("ME_GOVERNOR_CAL", [
    ins("Calibration certificate available"),
    ins("Speed droop and response tested"),
    ins("Load limiter verified"),
  ]),
  set("ME_REMOTE_CONTROL", [
    ins("Remote stations tested from ECR and bridge", { classRequired: true }),
    ins("Emergency local control verified"),
    ins("Alarm and indication checked"),
  ]),
  set("ME_EMERGENCY_STOP", [
    ins("Emergency stop tested from all stations", { classRequired: true, holdPoint: true }),
    ins("Fuel rack / shutoff confirmed"),
  ]),
  set("ME_OVERSPEED_TRIP", [
    ins("Overspeed trip tested", { classRequired: true, holdPoint: true }),
    ins("Trip setpoint recorded"),
  ]),
  set("ME_PERFORMANCE_TEST", [
    ins("Performance log before test recorded"),
    ins("Load points tested per maker curve"),
    ins("Fuel consumption and exhaust temps recorded"),
    ins("Performance report attached", { holdPoint: true }),
  ]),
  set("ME_SEA_TRIAL", [
    ins("Sea trial checklist completed", { classRequired: true }),
    ins("Maneuvering and astern tested"),
    ins("Vibration and bearing temps normal"),
    ins("Sea trial report signed", { holdPoint: true, qaQcRequired: true }),
  ]),
  // Supplemental checklists
  set("ME_CYLINDER_SURVEY", [
    ins("Isolate fuel and starting air", { holdPoint: true }),
    ins("Record running hours before opening"),
    ins("Measure liner wear all positions", { classRequired: true }),
    ins("Photograph liner condition (before/after)"),
    ins("Reassemble and pressure test", { holdPoint: true }),
  ]),
  set("ME_OVERHAUL_STANDARD", [
    ins("Permit to work and LOTO verified", { holdPoint: true }),
    ins("Maker manual procedure followed"),
    ins("Torque values recorded"),
    ins("Trial run and parameter check"),
  ]),
  set("ME_INSTRUMENT_TEST", [
    ins("Calibration certificate available"),
    ins("Test results within maker limits"),
    ins("Alarm and trip tested", { classRequired: true }),
  ]),
  set("ME_5YR_SERVICE", [
    ins("5-year service interval confirmed", { classRequired: true }),
    ins("All mandatory items completed per maker"),
    ins("Class attendance arranged if required", { holdPoint: true }),
  ]),
  set("SHAFT_SURVEY", [
    ins("Shaft line locked and secured", { holdPoint: true }),
    ins("Bearing clearances measured", { classRequired: true }),
    ins("Alignment report attached"),
  ]),
  set("ME_SAFETY_TEST", [
    ins("Emergency stop tested from all stations", { classRequired: true }),
    ins("Overspeed trip tested", { classRequired: true, holdPoint: true }),
  ]),
]);

export function resolveChecklist(refKey: string): MtilChecklistItem[] {
  return MTIL_PHASE1_CHECKLISTS[refKey] ?? MTIL_PHASE2_CHECKLISTS[refKey] ?? MTIL_PHASE3_CHECKLISTS[refKey] ?? [];
}

export function listPhase1ChecklistItems(): MtilChecklistItem[] {
  return Object.values(MTIL_PHASE1_CHECKLISTS).flat();
}

export function getPhase1ChecklistItemCount(): number {
  return listPhase1ChecklistItems().length;
}

export { MTIL_PHASE2_CHECKLISTS } from "./phases/phase2/checklistLibrary";
export { MTIL_PHASE3_CHECKLISTS } from "./phases/phase3/checklistLibrary";

export function listPhase2ChecklistItems(): MtilChecklistItem[] {
  return Object.values(MTIL_PHASE2_CHECKLISTS).flat();
}

export function getPhase2ChecklistItemCount(): number {
  return listPhase2ChecklistItems().length;
}

export function listPhase3ChecklistItems(): MtilChecklistItem[] {
  return Object.values(MTIL_PHASE3_CHECKLISTS).flat();
}

export function getPhase3ChecklistItemCount(): number {
  return listPhase3ChecklistItems().length;
}
