/**
 * Target 2: Hull zone + prep treatment intelligence
 *
 * Validates that surface preparation services make sense for each hull zone.
 * Flags outliers and illogical combinations.
 */

import { HULL_ZONES, PREP_SERVICES } from "@/lib/hull/constants";
import type { HullPrepLineItem } from "@/lib/hull/types";

export interface PrepValidation {
  item: HullPrepLineItem;
  severity: "ok" | "info" | "warning" | "error";
  message: string;
}

const ZONE_EXPECTED_PREP: Record<string, { typical: string[]; overkill: string[]; underkill: string[] }> = {
  "boot-top": {
    typical: ["spot-blasting", "sa1", "sa1.5", "freshwater-wash", "hp-wash", "air-drying"],
    overkill: ["sa2.5"],
    underkill: [],
  },
  "flat-bottom": {
    typical: ["sa2", "sa2.5", "hp-wash", "freshwater-wash", "air-drying", "spot-blasting"],
    overkill: [],
    underkill: ["sa1"],
  },
  "vertical-bottom": {
    typical: ["sa2", "sa2.5", "hp-wash", "freshwater-wash", "air-drying", "spot-blasting"],
    overkill: [],
    underkill: ["sa1"],
  },
  "vertical-side": {
    typical: ["spot-blasting", "sa1", "sa1.5", "sa2", "hp-wash", "freshwater-wash", "air-drying"],
    overkill: ["sa2.5"],
    underkill: [],
  },
  topside: {
    typical: ["spot-blasting", "sa1", "freshwater-wash", "hp-wash", "air-drying"],
    overkill: ["sa2", "sa2.5"],
    underkill: [],
  },
  "full-hull": {
    typical: ["hp-wash", "freshwater-wash", "air-drying"],
    overkill: [],
    underkill: [],
  },
};

const RATE_BENCHMARKS: Record<string, { low: number; high: number; unit: string }> = {
  "spot-blasting": { low: 8, high: 45, unit: "/m²" },
  sa1: { low: 10, high: 35, unit: "/m²" },
  "sa1.5": { low: 12, high: 40, unit: "/m²" },
  sa2: { low: 15, high: 55, unit: "/m²" },
  "sa2.5": { low: 20, high: 70, unit: "/m²" },
  "freshwater-wash": { low: 1, high: 8, unit: "/m²" },
  "hp-wash": { low: 2, high: 12, unit: "/m²" },
  "air-drying": { low: 1, high: 6, unit: "/m²" },
  "hull-preparation": { low: 5, high: 50, unit: "/m²" },
};

export function validatePrepChain(items: HullPrepLineItem[]): PrepValidation[] {
  const results: PrepValidation[] = [];

  for (const item of items) {
    const zoneRules = ZONE_EXPECTED_PREP[item.zoneId];

    if (zoneRules?.overkill.includes(item.serviceId)) {
      results.push({
        item,
        severity: "warning",
        message: `${item.serviceName} may be overkill for ${item.zoneName} — typically lighter prep is sufficient here`,
      });
    } else if (zoneRules?.underkill.includes(item.serviceId)) {
      results.push({
        item,
        severity: "warning",
        message: `${item.serviceName} may be insufficient for ${item.zoneName} — this zone is underwater and typically needs heavier prep`,
      });
    }

    const bench = RATE_BENCHMARKS[item.serviceId];
    if (bench) {
      if (item.unitRatePerSqm < bench.low * 0.5) {
        results.push({
          item,
          severity: "info",
          message: `Rate ${item.unitRatePerSqm.toFixed(2)}${bench.unit} is unusually low for ${item.serviceName} (typical ${bench.low}–${bench.high}${bench.unit})`,
        });
      } else if (item.unitRatePerSqm > bench.high * 1.5) {
        results.push({
          item,
          severity: "warning",
          message: `Rate ${item.unitRatePerSqm.toFixed(2)}${bench.unit} is very high for ${item.serviceName} (typical ${bench.low}–${bench.high}${bench.unit})`,
        });
      } else {
        results.push({
          item,
          severity: "ok",
          message: `Rate within typical range`,
        });
      }
    }
  }

  return results;
}

export function validateZoneCoverage(
  items: HullPrepLineItem[],
  zoneIds: string[],
): PrepValidation[] {
  const results: PrepValidation[] = [];
  const coveredZones = new Set(items.map((i) => i.zoneId));

  for (const zoneId of zoneIds) {
    if (!coveredZones.has(zoneId)) {
      const zone = HULL_ZONES.find((z) => z.id === zoneId);
      results.push({
        item: { zoneId, zoneName: zone?.name ?? zoneId } as HullPrepLineItem,
        severity: "warning",
        message: `No prep services quoted for ${zone?.name ?? zoneId} — this zone may have been missed by the vendor`,
      });
    }
  }

  const underwaterZones = ["flat-bottom", "vertical-bottom"];
  for (const zone of underwaterZones) {
    if (!coveredZones.has(zone)) continue;
    const zoneItems = items.filter((i) => i.zoneId === zone);
    const hasBlasting = zoneItems.some((i) =>
      ["sa2", "sa2.5", "spot-blasting"].includes(i.serviceId),
    );
    const hasWash = zoneItems.some((i) =>
      ["hp-wash", "freshwater-wash"].includes(i.serviceId),
    );

    if (!hasBlasting) {
      results.push({
        item: zoneItems[0],
        severity: "info",
        message: `No blasting/SA grade quoted for ${zoneItems[0].zoneName} — underwater zones typically need surface prep before painting`,
      });
    }
    if (!hasWash) {
      results.push({
        item: zoneItems[0],
        severity: "info",
        message: `No wash (HP or freshwater) quoted for ${zoneItems[0].zoneName} — washing before prep is standard practice`,
      });
    }
  }

  return results;
}

export function getOverallPrepScore(
  validations: PrepValidation[],
): { score: number; label: string; color: string } {
  const errors = validations.filter((v) => v.severity === "error").length;
  const warnings = validations.filter((v) => v.severity === "warning").length;
  const infos = validations.filter((v) => v.severity === "info").length;

  if (errors > 0) return { score: 30, label: "Issues found", color: "red" };
  if (warnings > 2) return { score: 55, label: "Review needed", color: "amber" };
  if (warnings > 0) return { score: 75, label: "Mostly OK", color: "yellow" };
  if (infos > 0) return { score: 90, label: "Good", color: "emerald" };
  return { score: 100, label: "Complete", color: "green" };
}
