import {
  calculateHullAreas,
  calculatedAreasToZoneMap,
  type CalculatedHullAreas,
  type VesselParticulars,
} from "@/lib/hull/calculateAreas";
import { HULL_ZONES } from "@/lib/hull/constants";
import type { HullPrepLineItem, HullZoneArea, VendorHullPaintQuote } from "@/lib/hull/types";

const ZONE_NAMES: Record<string, string> = {
  topside: "Topside",
  "flat-bottom": "Flat Bottom",
  "boot-top": "Boot Top",
  "vertical-bottom": "Side Bottom",
  "side-bottom-boottop-combined": "Side Bottom & Boottop (combined)",
};

function zoneName(id: string): string {
  return HULL_ZONES.find((z) => z.id === id)?.name ?? ZONE_NAMES[id] ?? id;
}

/** Fill missing zone areas from Paint Consultants calculated areas. */
export function applyEstimatedAreas(
  quote: VendorHullPaintQuote,
  particulars: VesselParticulars,
): VendorHullPaintQuote {
  const calculated = calculateHullAreas(particulars);
  if (!calculated) return quote;

  const zoneMap = calculatedAreasToZoneMap(calculated);
  const existingIds = new Set(quote.zoneAreas.map((z) => z.zoneId));
  const zoneAreas = [...quote.zoneAreas];

  for (const [zoneId, areaSqm] of Object.entries(zoneMap)) {
    if (existingIds.has(zoneId)) continue;
    if (zoneId === "side-bottom-boottop-combined") {
      if (existingIds.has("boot-top") || existingIds.has("vertical-bottom")) continue;
    }

    zoneAreas.push({
      zoneId,
      zoneName: zoneName(zoneId),
      areaSqm,
      source: "Estimated (Paint Consultants formula)",
      estimated: true,
    });
    existingIds.add(zoneId);
  }

  const lineItems = quote.lineItems.map((item) => {
    if (item.areaSqm > 0) return item;
    const estimated = resolveAreaForLineItem(item, zoneAreas, calculated);
    if (estimated == null) return item;
    return {
      ...item,
      areaSqm: estimated,
      calculatedTotal: Math.round(estimated * item.unitRatePerSqm * 100) / 100,
    };
  });

  return {
    ...quote,
    zoneAreas,
    lineItems,
    vesselParticulars: particulars,
    calculatedAreas: calculated,
  };
}

function resolveAreaForLineItem(
  item: HullPrepLineItem,
  zoneAreas: HullZoneArea[],
  calculated: CalculatedHullAreas,
): number | undefined {
  const fromZone = zoneAreas.find((z) => z.zoneId === item.zoneId);
  if (fromZone) return fromZone.areaSqm;

  if (
    item.zoneId === "boot-top" ||
    item.zoneId === "vertical-bottom"
  ) {
    if (calculated.boottop != null && item.zoneId === "boot-top") {
      return calculated.boottop;
    }
    if (calculated.sideBottom != null && item.zoneId === "vertical-bottom") {
      return calculated.sideBottom;
    }
    if (calculated.sideBottomAndBoottop != null) {
      return calculated.sideBottomAndBoottop;
    }
  }

  return undefined;
}

export function mergeQuotesWithEstimates(
  quotes: VendorHullPaintQuote[],
  particulars: VesselParticulars,
): VendorHullPaintQuote[] {
  return quotes.map((q) => applyEstimatedAreas(q, particulars));
}
