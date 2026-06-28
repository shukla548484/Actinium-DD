import Fuse from "fuse.js";
import { HULL_ZONES, PREP_SERVICES } from "@/lib/hull/constants";
import type {
  HullComparisonRow,
  HullPaintComparison,
  HullPrepLineItem,
  VendorHullPaintQuote,
} from "@/lib/hull/types";

function rowKey(zoneId: string, serviceId: string): string {
  return `${zoneId}::${serviceId}`;
}

export function buildHullPaintComparison(
  quotes: VendorHullPaintQuote[],
): HullPaintComparison {
  const vendors = quotes.map((q) => q.vendorName);
  const rowMap = new Map<string, HullComparisonRow>();

  for (const quote of quotes) {
    for (const item of quote.lineItems) {
      const key = rowKey(item.zoneId, item.serviceId);
      if (!rowMap.has(key)) {
        rowMap.set(key, {
          zoneId: item.zoneId,
          zoneName: item.zoneName,
          serviceId: item.serviceId,
          serviceName: item.serviceName,
          areaByVendor: Object.fromEntries(vendors.map((v) => [v, null])),
          byVendor: Object.fromEntries(
            vendors.map((v) => [
              v,
              {
                unitRatePerSqm: null,
                calculatedTotal: null,
                quotedTotal: null,
                originalLabel: null,
                matchScore: 1,
              },
            ]),
          ),
        });
      }

      const row = rowMap.get(key)!;
      row.areaByVendor[quote.vendorName] = item.areaSqm;
      row.byVendor[quote.vendorName] = {
        unitRatePerSqm: item.unitRatePerSqm,
        calculatedTotal: item.calculatedTotal,
        quotedTotal: item.quotedTotal ?? item.calculatedTotal,
        originalLabel: item.originalLabel,
        matchScore: 1,
      };
    }
  }

  const zoneOrder = HULL_ZONES.map((z) => z.id);
  const serviceOrder = PREP_SERVICES.map((s) => s.id);

  const rows = [...rowMap.values()].sort((a, b) => {
    const zi = zoneOrder.indexOf(a.zoneId) - zoneOrder.indexOf(b.zoneId);
    if (zi !== 0) return zi;
    return serviceOrder.indexOf(a.serviceId) - serviceOrder.indexOf(b.serviceId);
  });

  const zoneSummaries = HULL_ZONES.filter((z) =>
    quotes.some((q) => q.zoneAreas.some((a) => a.zoneId === z.id)),
  ).map((z) => ({
    zoneId: z.id,
    zoneName: z.name,
    areaByVendor: Object.fromEntries(
      vendors.map((v) => {
        const quote = quotes.find((q) => q.vendorName === v);
        const area = quote?.zoneAreas.find((a) => a.zoneId === z.id)?.areaSqm ?? null;
        return [v, area];
      }),
    ),
  }));

  return { vendors, rows, zoneSummaries };
}

/** Try to fuzzy-link unmatched hull lines across vendors (different wording). */
export function fuzzyMergeHullItems(
  items: HullPrepLineItem[],
  threshold = 0.6,
): HullPrepLineItem[] {
  const fuse = new Fuse(
    PREP_SERVICES.map((s) => ({ ...s, search: s.name.toLowerCase() })),
    { keys: ["name", "aliases", "search"], threshold: 1 - threshold },
  );

  return items.map((item) => {
    if (item.serviceId !== "hull-preparation") return item;
    const hit = fuse.search(item.originalLabel.toLowerCase())[0];
    if (hit && hit.score != null && 1 - hit.score >= threshold) {
      return { ...item, serviceId: hit.item.id, serviceName: hit.item.name };
    }
    return item;
  });
}
