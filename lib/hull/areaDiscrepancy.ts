/**
 * Target 3: Paint Consultants formula + estimated badge — enhanced UX
 *
 * Compare sheet-provided areas against calculated areas, flag discrepancies,
 * and let user choose which to use.
 */

import { calculateHullAreas, type CalculatedHullAreas, type VesselParticulars } from "@/lib/hull/calculateAreas";
import type { HullZoneArea } from "@/lib/hull/types";

export interface AreaDiscrepancy {
  zoneId: string;
  zoneName: string;
  sheetArea: number | null;
  estimatedArea: number | null;
  percentDiff: number | null;
  recommendation: "use-sheet" | "use-estimated" | "verify" | "no-data";
  message: string;
}

const DISCREPANCY_THRESHOLD = 0.2;

export function analyzeAreaDiscrepancies(
  sheetAreas: HullZoneArea[],
  particulars: VesselParticulars,
): AreaDiscrepancy[] {
  const calculated = calculateHullAreas(particulars);
  if (!calculated) return [];

  const zoneMapping: Record<string, number | undefined> = {
    topside: calculated.topside,
    "flat-bottom": calculated.flatBottom,
    "boot-top": calculated.boottop,
    "vertical-bottom": calculated.sideBottom,
  };

  if (calculated.sideBottomAndBoottop != null) {
    if (!zoneMapping["boot-top"] && !zoneMapping["vertical-bottom"]) {
      zoneMapping["side-bottom-boottop"] = calculated.sideBottomAndBoottop;
    }
  }

  const results: AreaDiscrepancy[] = [];

  for (const [zoneId, estimatedArea] of Object.entries(zoneMapping)) {
    if (estimatedArea == null) continue;

    const sheet = sheetAreas.find((z) => z.zoneId === zoneId);
    const sheetArea = sheet?.areaSqm ?? null;

    if (sheetArea == null) {
      results.push({
        zoneId,
        zoneName: sheet?.zoneName ?? zoneId,
        sheetArea: null,
        estimatedArea,
        percentDiff: null,
        recommendation: "use-estimated",
        message: `No area in sheet — using estimated ${estimatedArea} m²`,
      });
      continue;
    }

    const diff = Math.abs(sheetArea - estimatedArea) / estimatedArea;

    const zoneName = sheet?.zoneName ?? zoneId;

    if (diff <= DISCREPANCY_THRESHOLD) {
      results.push({
        zoneId,
        zoneName,
        sheetArea,
        estimatedArea,
        percentDiff: Math.round(diff * 100),
        recommendation: "use-sheet",
        message: `Sheet area (${sheetArea} m²) matches estimate (${estimatedArea} m²) within ${Math.round(diff * 100)}%`,
      });
    } else if (diff > DISCREPANCY_THRESHOLD && diff <= 0.5) {
      results.push({
        zoneId,
        zoneName,
        sheetArea,
        estimatedArea,
        percentDiff: Math.round(diff * 100),
        recommendation: "verify",
        message: `Sheet area (${sheetArea} m²) differs from estimate (${estimatedArea} m²) by ${Math.round(diff * 100)}% — verify with shell expansion plan`,
      });
    } else {
      results.push({
        zoneId,
        zoneName,
        sheetArea,
        estimatedArea,
        percentDiff: Math.round(diff * 100),
        recommendation: "verify",
        message: `Large discrepancy: sheet ${sheetArea} m² vs estimated ${estimatedArea} m² (${Math.round(diff * 100)}% off) — likely different zone definition or vessel-specific shape`,
      });
    }
  }

  return results;
}

export function formatFormulaBreakdown(
  particulars: VesselParticulars,
  calculated: CalculatedHullAreas,
): string[] {
  const lines: string[] = [];
  const { loa, lbp, breadth, depth, draught, lll } = particulars;

  lines.push(`Topside = (Depth − Draught) × (2×LOA + Breadth)`);
  lines.push(`        = (${depth} − ${draught}) × (2×${loa} + ${breadth})`);
  lines.push(`        = ${calculated.topside} m²`);
  lines.push("");

  if (calculated.boottop != null && lll != null) {
    lines.push(`Boot Top = (2 × LBP × 1.14) × (Draught − LLL)`);
    lines.push(`         = (2 × ${lbp} × 1.14) × (${draught} − ${lll})`);
    lines.push(`         = ${calculated.boottop} m²`);
    lines.push("");
    lines.push(`Side Bottom = (2 × LBP × 1.14) × LLL`);
    lines.push(`            = (2 × ${lbp} × 1.14) × ${lll}`);
    lines.push(`            = ${calculated.sideBottom} m²`);
  } else {
    lines.push(`Side Bottom & Boottop = (2 × LBP × 1.14) × Draught`);
    lines.push(`                      = (2 × ${lbp} × 1.14) × ${draught}`);
    lines.push(`                      = ${calculated.sideBottomAndBoottop} m²`);
    lines.push("");
    lines.push(`(Add LLL to split into Boot Top and Side Bottom separately)`);
  }

  lines.push("");
  lines.push(`Flat Bottom = LBP × Breadth × Hull Factor`);
  lines.push(`            = ${lbp} × ${breadth} × ${calculated.hullFactor}`);
  lines.push(`            = ${calculated.flatBottom} m²`);

  return lines;
}
