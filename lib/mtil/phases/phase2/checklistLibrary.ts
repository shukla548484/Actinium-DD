import type { MtilChecklistItem } from "../../types";
import { buildInspectionId } from "../../standards";

const DEPT = "AUX" as const;
const SYS = "AE" as const;
let seq = 100;

function ins(label: string, opts: Partial<MtilChecklistItem> = {}): MtilChecklistItem {
  seq += 1;
  return { code: `CL-AE-${seq}`, inspectionId: buildInspectionId(DEPT, SYS, seq), label, ...opts };
}

function set(key: string, items: MtilChecklistItem[]): [string, MtilChecklistItem[]] {
  return [key, items];
}

export const MTIL_PHASE2_CHECKLISTS: Record<string, MtilChecklistItem[]> = Object.fromEntries([
  set("AE_UNIT_OVERHAUL", [ins("LOTO verified", { holdPoint: true }), ins("Maker procedure followed"), ins("Trial run completed")]),
  set("AE_CYL_HEAD", [ins("Cylinder head removed safely"), ins("Valves serviced"), ins("Pressure test OK")]),
  set("AE_PISTON", [ins("Ring clearances measured"), ins("Crown condition checked")]),
  set("AE_FUEL_INJ", [ins("Opening pressure tested"), ins("Spray pattern OK")]),
  set("AE_TURBO", [ins("Rotor condition checked"), ins("Bearings renewed as required")]),
  set("AE_GOVERNOR", [ins("Governor calibrated"), ins("Droop test OK")]),
  set("AE_ALTERNATOR", [ins("Insulation test recorded"), ins("Bearing condition checked")]),
  set("AE_EMERGENCY_GEN", [ins("Auto start tested", { classRequired: true }), ins("Load test completed", { holdPoint: true })]),
  set("AE_STARTING", [ins("Starting air pressure OK"), ins("Starting motor serviced")]),
  set("AE_LO_SYS", [ins("LO pressure and temp normal"), ins("Filters cleaned/replaced")]),
  set("AE_COOL_SYS", [ins("JCW temps normal"), ins("Cooler cleaned")]),
  set("AE_FUEL_SYS", [ins("Filters serviced"), ins("Injection equipment tested")]),
  set("AE_LOAD_TEST", [ins("Load test per maker", { classRequired: true }), ins("Parameters recorded", { holdPoint: true })]),
  set("AE_PERF_TEST", [ins("Performance parameters recorded"), ins("Report attached")]),
  set("AE_SAFETY_TEST", [ins("Safety trips tested", { classRequired: true, holdPoint: true })]),
  set("PUR_SEPARATOR", [ins("Bowl opened and cleaned"), ins("Disc stack inspected"), ins("Water seal OK")]),
  set("PUR_FEED", [ins("Feed rate adjusted"), ins("Heater operational")]),
  set("PUR_CONTROL", [ins("Alarms tested"), ins("Auto desludge verified")]),
  set("COMPR_AIR", [ins("Compressor valves serviced"), ins("Safety valves tested")]),
  set("COMPR_REF", [ins("Leak test completed"), ins("Oil level checked")]),
  set("COMPR_CONTROL", [ins("Control system tested"), ins("Alarms verified")]),
  set("COMPR_SAFETY", [ins("Safety valves and trips tested", { holdPoint: true })]),
  set("HE_EXCHANGER", [ins("Plates cleaned"), ins("Gaskets renewed"), ins("Pressure test OK")]),
  set("FWG_SERVICE", [ins("Plates cleaned"), ins("Ejector serviced"), ins("Salinometer calibrated")]),
  set("FWG_PRODUCTION", [ins("Production rate verified"), ins("Salinity within limit", { holdPoint: true })]),
  set("BLR_BURNER", [ins("Burner dismantled and cleaned"), ins("Ignition tested")]),
  set("BLR_TUBES", [ins("Tube condition surveyed", { classRequired: true }), ins("Plugging recorded")]),
  set("BLR_SV_TEST", [ins("Safety valves tested and sealed", { classRequired: true, holdPoint: true })]),
  set("BLR_HYDRO", [ins("Hydro test completed", { classRequired: true, holdPoint: true })]),
  set("BLR_FEED", [ins("Feed pumps tested"), ins("Level controls verified")]),
  set("BLR_CONTROL", [ins("Combustion control tested"), ins("Flame safeguard verified")]),
  set("BLR_GENERAL", [ins("General inspection completed"), ins("Refractory condition checked")]),
  set("STEER_GEAR", [ins("Rudder movement tested", { classRequired: true }), ins("Clearances measured", { holdPoint: true })]),
  set("STEER_HYD", [ins("Hydraulic oil sampled"), ins("Pump performance checked")]),
  set("STEER_ALARM", [ins("Steering failure alarm tested", { classRequired: true })]),
]);

export function listPhase2ChecklistItems(): MtilChecklistItem[] {
  return Object.values(MTIL_PHASE2_CHECKLISTS).flat();
}

export function getPhase2ChecklistItemCount(): number {
  return listPhase2ChecklistItems().length;
}
