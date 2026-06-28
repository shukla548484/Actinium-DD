export type HullFactorType =
  | "bulker-tanker-dw-over-100k"
  | "bulker-tanker-dw-40k-100k"
  | "bulker-tanker-dw-under-40k"
  | "motorship";

export interface VesselParticulars {
  loa?: number;
  lbp?: number;
  breadth?: number;
  depth?: number;
  draught?: number;
  /** Light load line — enables separate Boottop vs Side Bottom split */
  lll?: number;
  hullFactorType?: HullFactorType;
  deadweight?: number;
  source?: string;
}

export interface CalculatedHullAreas {
  topside: number;
  /** Combined side bottom + boottop (when LLL not set) */
  sideBottomAndBoottop?: number;
  flatBottom: number;
  boottop?: number;
  sideBottom?: number;
  hullFactor: number;
  method: "paint-consultants";
  disclaimer: string;
}

export const HULL_FACTOR_VALUES: Record<HullFactorType, number> = {
  "bulker-tanker-dw-over-100k": 0.92,
  "bulker-tanker-dw-40k-100k": 0.85,
  "bulker-tanker-dw-under-40k": 0.72,
  motorship: 0.67,
};

export const HULL_FACTOR_LABELS: Record<HullFactorType, string> = {
  "bulker-tanker-dw-over-100k": "Bulkers / Tankers — DW > 100,000 t",
  "bulker-tanker-dw-40k-100k": "Bulkers / Tankers — 40,000 t < DW < 100,000 t",
  "bulker-tanker-dw-under-40k": "Bulkers / Tankers — DW < 40,000 t",
  motorship: "Motorships",
};

export const PAINT_CALCULATOR_DISCLAIMER =
  "Approximate areas per Paint Consultants formula (paint-consultants.com). " +
  "Accurate figures require the vessel shell expansion plan. " +
  "Intended for bulk carriers, tankers, and Ro-Ro. Topside may be understated if " +
  "superstructure or bulwarks are included in topside scope.";

export function inferHullFactorFromDeadweight(dw?: number): HullFactorType | undefined {
  if (dw == null || dw <= 0) return undefined;
  if (dw > 100_000) return "bulker-tanker-dw-over-100k";
  if (dw > 40_000) return "bulker-tanker-dw-40k-100k";
  return "bulker-tanker-dw-under-40k";
}

/**
 * Paint Consultants hull area formulas (http://www.paint-consultants.com Area Calculator).
 *
 * TOPSIDE           = (DEPTH − DRAUGHT) × (2×LOA + BREADTH)
 * SIDE BTM & BOOT   = (2×LBP×1.14) × DRAUGHT          — combined when LLL omitted
 * FLAT BOTTOM       = LBP × BREADTH × hullFactor
 * BOOTTOP           = (2×LBP×1.14) × (DRAUGHT − LLL)   — when LLL provided
 * SIDE BOTTOM       = (2×LBP×1.14) × LLL               — when LLL provided
 */
export function calculateHullAreas(
  particulars: VesselParticulars,
): CalculatedHullAreas | null {
  const { loa, lbp, breadth, depth, draught, lll } = particulars;
  if (!loa || !lbp || !breadth || !depth || draught == null) return null;

  const factorType =
    particulars.hullFactorType ?? inferHullFactorFromDeadweight(particulars.deadweight);
  const hullFactor = factorType ? HULL_FACTOR_VALUES[factorType] : 0.85;

  const topside = Math.round((depth - draught) * (2 * loa + breadth));
  const sideBottomAndBoottop = Math.round(2 * lbp * 1.14 * draught);
  const flatBottom = Math.round(lbp * breadth * hullFactor);

  const result: CalculatedHullAreas = {
    topside,
    flatBottom,
    hullFactor,
    method: "paint-consultants",
    disclaimer: PAINT_CALCULATOR_DISCLAIMER,
  };

  if (lll != null && lll > 0 && lll < draught) {
    result.boottop = Math.round(2 * lbp * 1.14 * (draught - lll));
    result.sideBottom = Math.round(2 * lbp * 1.14 * lll);
  } else {
    result.sideBottomAndBoottop = sideBottomAndBoottop;
  }

  return result;
}

/** Map calculated zones to our canonical hull zone IDs */
export function calculatedAreasToZoneMap(
  areas: CalculatedHullAreas,
): Record<string, number> {
  const map: Record<string, number> = {
    topside: areas.topside,
    "flat-bottom": areas.flatBottom,
  };

  if (areas.boottop != null) map["boot-top"] = areas.boottop;
  if (areas.sideBottom != null) map["vertical-bottom"] = areas.sideBottom;

  if (areas.sideBottomAndBoottop != null && areas.boottop == null) {
    map["side-bottom-boottop-combined"] = areas.sideBottomAndBoottop;
  }

  return map;
}
