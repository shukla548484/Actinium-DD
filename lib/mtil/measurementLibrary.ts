import type { MtilMeasurementRef } from "./types";
import { buildMeasurementId } from "./standards";
import { MTIL_PHASE2_MEASUREMENTS } from "./phases/phase2/measurementLibrary";
import { MTIL_PHASE3_MEASUREMENTS } from "./phases/phase3/measurementLibrary";

const DEPT = "ENG" as const;
const SYS = "ME" as const;

function mea(seq: number, def: Omit<MtilMeasurementRef, "measurementId">): MtilMeasurementRef {
  return { ...def, measurementId: buildMeasurementId(DEPT, SYS, seq) };
}

/** Phase 1 — Main Propulsion measurement library with tolerance database. */
export const MTIL_PHASE1_MEASUREMENTS: Record<string, MtilMeasurementRef> = {
  ME_CYL_LINER_WEAR: mea(1, {
    code: "ME_CYL_LINER_WEAR",
    label: "Cylinder liner wear (max)",
    unit: "mm",
    max: 0.8,
    tolerance: "≤ 0.80 mm (maker limit)",
    required: true,
  }),
  ME_CYL_LINER_OVAL: mea(2, {
    code: "ME_CYL_LINER_OVAL",
    label: "Cylinder liner ovality",
    unit: "mm",
    max: 0.15,
    tolerance: "≤ 0.15 mm",
  }),
  ME_PISTON_CROWN_TEMP: mea(3, {
    code: "ME_PISTON_CROWN_TEMP",
    label: "Piston crown temperature",
    unit: "°C",
    max: 450,
    tolerance: "Per maker curve",
  }),
  ME_EXH_GAS_TEMP: mea(4, {
    code: "ME_EXH_GAS_TEMP",
    label: "Exhaust gas temperature (cylinder)",
    unit: "°C",
    max: 450,
    tolerance: "± 20 °C vs baseline",
  }),
  ME_SCAV_AIR_PRESS: mea(5, {
    code: "ME_SCAV_AIR_PRESS",
    label: "Scavenge air pressure",
    unit: "bar",
    min: 0.2,
    tolerance: "Per load diagram",
  }),
  ME_FUEL_INJ_PRESS: mea(6, {
    code: "ME_FUEL_INJ_PRESS",
    label: "Fuel injection pressure",
    unit: "bar",
    tolerance: "Maker setting ± 3%",
  }),
  ME_LO_PRESS: mea(7, {
    code: "ME_LO_PRESS",
    label: "Main LO pressure",
    unit: "bar",
    min: 2.5,
    tolerance: "≥ 2.5 bar at rated RPM",
  }),
  ME_JCW_TEMP_IN: mea(8, {
    code: "ME_JCW_TEMP_IN",
    label: "JCW inlet temperature",
    unit: "°C",
    max: 85,
    tolerance: "≤ 85 °C",
  }),
  ME_JCW_TEMP_OUT: mea(9, {
    code: "ME_JCW_TEMP_OUT",
    label: "JCW outlet temperature",
    unit: "°C",
    max: 90,
    tolerance: "≤ 90 °C",
  }),
  ME_TURBO_RPM: mea(10, {
    code: "ME_TURBO_RPM",
    label: "Turbocharger RPM",
    unit: "rpm",
    tolerance: "Within maker range at MCR",
  }),
  ME_TURBO_EXH_TEMP: mea(11, {
    code: "ME_TURBO_EXH_TEMP",
    label: "Turbocharger exhaust inlet temp",
    unit: "°C",
    max: 550,
    tolerance: "≤ 550 °C",
  }),
  ME_START_AIR_PRESS: mea(12, {
    code: "ME_START_AIR_PRESS",
    label: "Starting air pressure",
    unit: "bar",
    min: 25,
    tolerance: "≥ 25 bar",
  }),
  ME_CRANK_DEFLECT_A: mea(13, {
    code: "ME_CRANK_DEFLECT_A",
    label: "Crankshaft deflection (A position)",
    unit: "mm",
    tolerance: "Within maker limits",
    required: true,
  }),
  ME_CRANK_DEFLECT_B: mea(14, {
    code: "ME_CRANK_DEFLECT_B",
    label: "Crankshaft deflection (B position)",
    unit: "mm",
    tolerance: "Within maker limits",
    required: true,
  }),
  ME_MAIN_BRG_CLEARANCE: mea(15, {
    code: "ME_MAIN_BRG_CLEARANCE",
    label: "Main bearing clearance",
    unit: "mm",
    tolerance: "Maker limit",
    required: true,
  }),
  ME_CRANKPIN_CLEARANCE: mea(16, {
    code: "ME_CRANKPIN_CLEARANCE",
    label: "Crankpin bearing clearance",
    unit: "mm",
    tolerance: "Maker limit",
    required: true,
  }),
  ME_CROSSHEAD_CLEARANCE: mea(17, {
    code: "ME_CROSSHEAD_CLEARANCE",
    label: "Crosshead bearing clearance",
    unit: "mm",
    tolerance: "Maker limit",
  }),
  ME_THRUST_CLEARANCE: mea(18, {
    code: "ME_THRUST_CLEARANCE",
    label: "Thrust block clearance",
    unit: "mm",
    tolerance: "Maker limit",
    required: true,
  }),
  ME_INTER_BEARING_TEMP: mea(19, {
    code: "ME_INTER_BEARING_TEMP",
    label: "Intermediate bearing temperature",
    unit: "°C",
    max: 65,
    tolerance: "≤ 65 °C",
  }),
  ME_INTER_BRG_CLEARANCE: mea(20, {
    code: "ME_INTER_BRG_CLEARANCE",
    label: "Intermediate bearing clearance",
    unit: "mm",
    tolerance: "Maker limit",
  }),
  ME_SHAFT_ALIGNMENT: mea(21, {
    code: "ME_SHAFT_ALIGNMENT",
    label: "Shaft alignment offset",
    unit: "mm",
    max: 0.05,
    tolerance: "≤ 0.05 mm",
    required: true,
  }),
  ME_STERN_TUBE_OIL: mea(22, {
    code: "ME_STERN_TUBE_OIL",
    label: "Stern tube LO consumption (24h)",
    unit: "L",
    max: 10,
    tolerance: "≤ 10 L/24h",
  }),
  ME_STERN_BRG_CLEARANCE: mea(23, {
    code: "ME_STERN_BRG_CLEARANCE",
    label: "Stern bearing clearance",
    unit: "mm",
    tolerance: "Maker / class limit",
  }),
  ME_STERN_SEAL_CHAMBER: mea(24, {
    code: "ME_STERN_SEAL_CHAMBER",
    label: "Stern seal chamber pressure",
    unit: "bar",
    tolerance: "Maker operating range",
  }),
  ME_GOVERNOR_RESPONSE: mea(25, {
    code: "ME_GOVERNOR_RESPONSE",
    label: "Governor response time",
    unit: "sec",
    max: 3,
    tolerance: "≤ 3 sec",
  }),
  ME_OVERSPEED_TRIP: mea(26, {
    code: "ME_OVERSPEED_TRIP",
    label: "Overspeed trip setpoint",
    unit: "rpm",
    tolerance: "110% MCR ± 1%",
    required: true,
  }),
  ME_MANEUVER_TIME: mea(27, {
    code: "ME_MANEUVER_TIME",
    label: "Maneuvering system response",
    unit: "sec",
    max: 5,
    tolerance: "≤ 5 sec",
  }),
};

export function resolveMeasurements(codes: string[]): MtilMeasurementRef[] {
  const all = { ...MTIL_PHASE1_MEASUREMENTS, ...MTIL_PHASE2_MEASUREMENTS, ...MTIL_PHASE3_MEASUREMENTS };
  return codes.map((c) => all[c]).filter(Boolean);
}

export function listPhase1Measurements(): MtilMeasurementRef[] {
  return Object.values(MTIL_PHASE1_MEASUREMENTS);
}

export function getPhase1MeasurementCount(): number {
  return Object.keys(MTIL_PHASE1_MEASUREMENTS).length;
}

export function listPhase2Measurements(): MtilMeasurementRef[] {
  return Object.values(MTIL_PHASE2_MEASUREMENTS);
}

export function getPhase2MeasurementCount(): number {
  return Object.keys(MTIL_PHASE2_MEASUREMENTS).length;
}

export function listPhase3Measurements(): MtilMeasurementRef[] {
  return Object.values(MTIL_PHASE3_MEASUREMENTS);
}

export function getPhase3MeasurementCount(): number {
  return Object.keys(MTIL_PHASE3_MEASUREMENTS).length;
}
