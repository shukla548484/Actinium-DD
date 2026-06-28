import type { HullPaintComparison } from "@/lib/hull/types";

export type PaintingZoneAreas = {
  flatBottom?: number | null;
  verticalBottom?: number | null;
  bootTop?: number | null;
  topside?: number | null;
  dftRequirement?: string | null;
  paintScheme?: string | null;
  antifoulingType?: string | null;
};

export function extractPaintingAreas(values: Record<string, unknown>): PaintingZoneAreas {
  const num = (key: string) => {
    const v = values[key];
    if (v == null || v === "") return null;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    flatBottom: num("flatBottomArea"),
    verticalBottom: num("verticalBottomArea"),
    bootTop: num("bootTopArea"),
    topside: num("topsideArea"),
    dftRequirement: values.dftRequirement != null ? String(values.dftRequirement) : null,
    paintScheme: values.currentPaintScheme != null ? String(values.currentPaintScheme) : null,
    antifoulingType: values.antifoulingType != null ? String(values.antifoulingType) : null,
  };
}

export function paintingAreasTotal(areas: PaintingZoneAreas): number | null {
  const parts = [areas.flatBottom, areas.verticalBottom, areas.bootTop, areas.topside].filter(
    (v): v is number => v != null && Number.isFinite(v),
  );
  if (parts.length === 0) return null;
  return parts.reduce((a, b) => a + b, 0);
}

/** Build hull-paint-style zone rows from structured painting input (for compare / export). */
export function paintingAreasToHullZones(areas: PaintingZoneAreas) {
  const zones: { zone: string; areaM2: number }[] = [];
  if (areas.flatBottom != null) zones.push({ zone: "Flat Bottom", areaM2: areas.flatBottom });
  if (areas.verticalBottom != null) zones.push({ zone: "Vertical Bottom", areaM2: areas.verticalBottom });
  if (areas.bootTop != null) zones.push({ zone: "Boot Top", areaM2: areas.bootTop });
  if (areas.topside != null) zones.push({ zone: "Topside", areaM2: areas.topside });
  return zones;
}

export function hullCompareHint(areas: PaintingZoneAreas): string | null {
  const total = paintingAreasTotal(areas);
  if (total == null) {
    return "Enter zone areas (m²) to feed the hull paint comparison module.";
  }
  return `${total.toLocaleString()} m² total across ${paintingAreasToHullZones(areas).length} zones — ready for yard quote comparison.`;
}

/** Compare entered areas against estimated areas from a hull paint comparison snapshot. */
export function comparePaintingToEstimate(
  areas: PaintingZoneAreas,
  comparison: HullPaintComparison | null,
): { zone: string; entered: number | null; estimated: number | null; deltaPct: number | null }[] {
  if (!comparison) return [];
  const estimateByZone = new Map<string, number>();
  for (const zs of comparison.zoneSummaries) {
    const firstArea = Object.values(zs.areaByVendor).find((v) => v != null);
    if (firstArea != null) estimateByZone.set(zs.zoneName.toLowerCase(), firstArea);
  }

  const pairs: { key: keyof PaintingZoneAreas; zone: string }[] = [
    { key: "flatBottom", zone: "flat bottom" },
    { key: "verticalBottom", zone: "vertical bottom" },
    { key: "bootTop", zone: "boot top" },
    { key: "topside", zone: "topside" },
  ];

  return pairs.map(({ key, zone }) => {
    const entered = areas[key] as number | null | undefined ?? null;
    const estimated = estimateByZone.get(zone) ?? null;
    const deltaPct =
      entered != null && estimated != null && estimated > 0
        ? Math.round(((entered - estimated) / estimated) * 100)
        : null;
    return { zone, entered, estimated, deltaPct };
  });
}
