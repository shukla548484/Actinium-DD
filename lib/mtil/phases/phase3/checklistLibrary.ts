import type { MtilChecklistItem } from "../../types";
import { buildInspectionId } from "../../standards";

const DEPT = "PVP" as const;
const SYS = "PMP" as const;
let seq = 200;

function ins(label: string, opts: Partial<MtilChecklistItem> = {}): MtilChecklistItem {
  seq += 1;
  return { code: `CL-PMP-${seq}`, inspectionId: buildInspectionId(DEPT, SYS, seq), label, ...opts };
}

function set(key: string, items: MtilChecklistItem[]): [string, MtilChecklistItem[]] {
  return [key, items];
}

export const MTIL_PHASE3_CHECKLISTS: Record<string, MtilChecklistItem[]> = Object.fromEntries([
  set("PMP_CENT_OVERHAUL", [ins("LOTO verified", { holdPoint: true }), ins("Impeller and casing inspected"), ins("Trial run completed")]),
  set("PMP_IMPELLER", [ins("Impeller wear measured"), ins("Cavitation damage checked"), ins("Balancing verified")]),
  set("PMP_SEAL", [ins("Seal faces inspected"), ins("Seal flush operational"), ins("Leak test OK")]),
  set("PMP_BEARING", [ins("Bearing clearance measured"), ins("Lubrication verified")]),
  set("PMP_ALIGNMENT", [ins("Laser alignment performed"), ins("Coupling condition checked")]),
  set("PMP_PERF", [ins("Flow and head recorded"), ins("NPSH verified"), ins("Performance curve compared")]),
  set("PMP_GEAR", [ins("Gear teeth inspected"), ins("Clearances measured"), ins("Trial run OK")]),
  set("PMP_SCREW", [ins("Rotor clearances checked"), ins("Timing verified"), ins("Trial run OK")]),
  set("PMP_FIRE_SURVEY", [ins("Fire pump surveyed", { classRequired: true }), ins("Relief valve tested"), ins("Emergency start verified", { holdPoint: true })]),
  set("PMP_FIRE_TEST", [ins("Emergency fire pump started", { classRequired: true }), ins("Two hydrants discharged simultaneously", { holdPoint: true })]),
  set("PMP_BALLAST", [ins("Ballast pump overhauled"), ins("Stripping system tested"), ins("Eductor operational")]),
  set("PMP_BILGE", [ins("Bilge pump overhauled"), ins("High level alarm tested")]),
  set("PMP_STRIPPING", [ins("Stripping rate verified"), ins("Non-return valve checked")]),
  set("VAL_GLOBE", [ins("Valve dismantled and cleaned"), ins("Seat and disc lapped"), ins("Leak test OK")]),
  set("VAL_GATE", [ins("Gate and seat inspected"), ins("Stem packing renewed"), ins("Operation verified")]),
  set("VAL_BFLY", [ins("Disc and seat inspected"), ins("Actuator operational"), ins("Leak test OK")]),
  set("VAL_RELIEF", [ins("Set pressure recorded"), ins("Reseating verified"), ins("Tag updated")]),
  set("VAL_SAFETY", [ins("Safety valve tested and sealed", { classRequired: true, holdPoint: true })]),
  set("VAL_CHECK", [ins("Disc and seat inspected"), ins("Non-return function verified")]),
  set("VAL_CONTROL", [ins("Valve stroke tested"), ins("Actuator serviced"), ins("Positioner calibrated")]),
  set("PIPE_STEAM", [ins("Pipe wall thickness measured"), ins("Insulation condition checked"), ins("Supports verified")]),
  set("PIPE_FUEL", [ins("Pipe integrity surveyed"), ins("Flanges and gaskets checked"), ins("Leak test completed")]),
  set("PIPE_LO", [ins("Pipe condition surveyed"), ins("Flanges inspected"), ins("Supports verified")]),
  set("PIPE_SW", [ins("Corrosion surveyed"), ins("Anodes checked"), ins("Sea chest inspected")]),
  set("PIPE_HYDRO", [ins("Hydro test completed", { classRequired: true, holdPoint: true }), ins("Test certificate attached")]),
  set("PMP_MOTOR", [ins("Motor insulation tested"), ins("Coupling inspected"), ins("Alignment checked")]),
  set("VAL_GREASE", [ins("Valve greased"), ins("Operation verified")]),
  set("PIPE_FLANGE", [ins("Flange faces inspected"), ins("Gaskets renewed as required"), ins("Bolt torque verified")]),
  set("PMP_CAVITATION", [ins("Cavitation noise checked"), ins("NPSH margin verified"), ins("Suction conditions reviewed")]),
]);

export function listPhase3ChecklistItems(): MtilChecklistItem[] {
  return Object.values(MTIL_PHASE3_CHECKLISTS).flat();
}

export function getPhase3ChecklistItemCount(): number {
  return listPhase3ChecklistItems().length;
}
