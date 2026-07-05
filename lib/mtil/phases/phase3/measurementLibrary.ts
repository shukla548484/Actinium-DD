import type { MtilMeasurementRef } from "../../types";
import { buildMeasurementId } from "../../standards";

const DEPT = "PVP" as const;
const SYS = "PMP" as const;

function mea(seq: number, def: Omit<MtilMeasurementRef, "measurementId">): MtilMeasurementRef {
  return { ...def, measurementId: buildMeasurementId(DEPT, SYS, seq) };
}

export const MTIL_PHASE3_MEASUREMENTS: Record<string, MtilMeasurementRef> = {
  PMP_VIBRATION: mea(1, { code: "PMP_VIBRATION", label: "Pump vibration", unit: "mm/s", max: 4.5, tolerance: "≤ 4.5 mm/s RMS" }),
  PMP_BEAR_CLEAR: mea(2, { code: "PMP_BEAR_CLEAR", label: "Bearing clearance", unit: "mm", tolerance: "Maker limit" }),
  PMP_ALIGN_OFFSET: mea(3, { code: "PMP_ALIGN_OFFSET", label: "Alignment offset", unit: "mm", max: 0.05, tolerance: "≤ 0.05 mm" }),
  PMP_FLOW: mea(4, { code: "PMP_FLOW", label: "Pump flow rate", unit: "m³/h", tolerance: "Design flow ±5%" }),
  PMP_HEAD: mea(5, { code: "PMP_HEAD", label: "Pump total head", unit: "m", tolerance: "Design head ±5%" }),
  PMP_NPSH: mea(6, { code: "PMP_NPSH", label: "NPSH available", unit: "m", tolerance: "> NPSH required" }),
  PMP_SEAL_LEAK: mea(7, { code: "PMP_SEAL_LEAK", label: "Seal leak rate", unit: "drops/min", max: 5 }),
  VAL_SET_PRESS: mea(8, { code: "VAL_SET_PRESS", label: "Valve set pressure", unit: "bar", tolerance: "± 3% of set point" }),
  VAL_STROKE: mea(9, { code: "VAL_STROKE", label: "Control valve stroke", unit: "%", tolerance: "0–100% linear" }),
  PIPE_STEAM_TEMP: mea(10, { code: "PIPE_STEAM_TEMP", label: "Steam line surface temp", unit: "°C", max: 60, tolerance: "Insulation limit" }),
  PIPE_WALL_THICK: mea(11, { code: "PIPE_WALL_THICK", label: "Pipe wall thickness", unit: "mm", tolerance: "≥ min allowable" }),
  PIPE_TEST_PRESS: mea(12, { code: "PIPE_TEST_PRESS", label: "Hydro test pressure", unit: "bar", tolerance: "1.5× design pressure" }),
};

export function listPhase3Measurements(): MtilMeasurementRef[] {
  return Object.values(MTIL_PHASE3_MEASUREMENTS);
}

export function getPhase3MeasurementCount(): number {
  return Object.keys(MTIL_PHASE3_MEASUREMENTS).length;
}
