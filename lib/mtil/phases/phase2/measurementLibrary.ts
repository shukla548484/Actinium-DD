import type { MtilMeasurementRef } from "../../types";
import { buildMeasurementId } from "../../standards";

const DEPT = "AUX" as const;

function mea(system: "AE" | "BLR", seq: number, def: Omit<MtilMeasurementRef, "measurementId">): MtilMeasurementRef {
  return { ...def, measurementId: buildMeasurementId(DEPT, system, seq) };
}

export const MTIL_PHASE2_MEASUREMENTS: Record<string, MtilMeasurementRef> = {
  AE_CYL_WEAR: mea("AE", 1, { code: "AE_CYL_WEAR", label: "AE cylinder liner wear", unit: "mm", max: 0.6, tolerance: "≤ 0.60 mm" }),
  AE_FUEL_PRESS: mea("AE", 2, { code: "AE_FUEL_PRESS", label: "AE fuel pressure", unit: "bar", tolerance: "Maker setting" }),
  AE_TURBO_RPM: mea("AE", 3, { code: "AE_TURBO_RPM", label: "AE turbo RPM", unit: "rpm" }),
  AE_GOVERNOR_RESP: mea("AE", 4, { code: "AE_GOVERNOR_RESP", label: "AE governor response", unit: "sec", max: 3 }),
  AE_ALT_INSULATION: mea("AE", 5, { code: "AE_ALT_INSULATION", label: "Alternator insulation resistance", unit: "MΩ", min: 1 }),
  AE_START_AIR: mea("AE", 6, { code: "AE_START_AIR", label: "Starting air pressure", unit: "bar", min: 25 }),
  AE_LO_PRESS: mea("AE", 7, { code: "AE_LO_PRESS", label: "AE LO pressure", unit: "bar", min: 2 }),
  AE_JCW_TEMP: mea("AE", 8, { code: "AE_JCW_TEMP", label: "AE JCW outlet temp", unit: "°C", max: 85 }),
  REF_SUCTION_PRESS: mea("AE", 9, { code: "REF_SUCTION_PRESS", label: "Refrigeration suction pressure", unit: "bar" }),
  HE_PRESS_DROP: mea("AE", 10, { code: "HE_PRESS_DROP", label: "Heat exchanger pressure drop", unit: "bar" }),
  FWG_SALINITY: mea("AE", 11, { code: "FWG_SALINITY", label: "FWG product salinity", unit: "ppm", max: 10 }),
  FWG_FLOW: mea("AE", 12, { code: "FWG_FLOW", label: "FWG production flow", unit: "m³/day" }),
  STEER_HYD_PRESS: mea("AE", 13, { code: "STEER_HYD_PRESS", label: "Steering hydraulic pressure", unit: "bar" }),
  BLR_STEAM_PRESS: mea("BLR", 1, { code: "BLR_STEAM_PRESS", label: "Boiler steam pressure", unit: "bar", tolerance: "Design working pressure" }),
};

export function listPhase2Measurements(): MtilMeasurementRef[] {
  return Object.values(MTIL_PHASE2_MEASUREMENTS);
}

export function getPhase2MeasurementCount(): number {
  return Object.keys(MTIL_PHASE2_MEASUREMENTS).length;
}
