import {
  calculateConnectDisconnectTotal,
  calculateConnectionDailyTotal,
  calculateEquipmentServiceTotal,
  calculateWatchServiceTotal,
  connectionDays,
  dailyWatchCost,
  effectiveUnits,
  personsFor24HourCoverage,
  totalServiceDays,
} from "@/lib/yardServices/calculate";
import { resolveScopeDays, resolveScopeQuantity } from "@/lib/tender/resolveScope";
import type {
  CalcRule,
  Project,
  QuoteLine,
  QuoteMeta,
  SpecLine,
} from "@/lib/tender/types";

export interface DurationContext {
  shipyardDays: number | null;
  dryDockDays: number | null;
  cprDays: number | null;
  totalServiceDays: number | null;
  connectionDays: number | null;
}

export function buildDurationContext(
  project: Project,
  meta: QuoteMeta | null,
): DurationContext {
  const shipyardDays = meta?.shipyardDays ?? project.shipyardDays;
  const dryDockDays = meta?.dryDockDays ?? project.dryDockDays;
  const cprDays = meta?.cprDays ?? project.cprDays;
  const totalService = totalServiceDays(shipyardDays, dryDockDays);
  return {
    shipyardDays,
    dryDockDays,
    cprDays,
    totalServiceDays: totalService,
    connectionDays: connectionDays(cprDays, shipyardDays, totalService),
  };
}

export function calculateLineTotal(
  spec: SpecLine,
  line: Pick<QuoteLine, "unitRate" | "quantity" | "quotedTotal" | "pricingStatus">,
  duration: DurationContext,
): number | null {
  if (line.pricingStatus === "included" || line.pricingStatus === "na" || line.pricingStatus === "owner_supply") {
    return 0;
  }

  if (line.quotedTotal != null && line.unitRate == null) {
    return line.quotedTotal;
  }

  const rate = line.unitRate;
  if (rate == null) return line.quotedTotal;

  const params = spec.calcParams ?? {};
  const scopedQty = resolveScopeQuantity(spec);
  const qty = spec.ownerLocked
    ? scopedQty ?? 1
    : line.quantity ?? scopedQty ?? params.defaultQty ?? params.defaultConnections ?? 1;

  switch (spec.calcRule as CalcRule) {
    case "lump_sum":
      return Math.round(rate * 100) / 100;

    case "per_day": {
      const days = resolveScopeDays(spec, duration);
      if (days == null) return null;
      return Math.round(rate * days * 100) / 100;
    }

    case "unit_qty":
      return Math.round(rate * qty * 100) / 100;

    case "unit_qty_days": {
      const days = resolveScopeDays(spec, duration);
      if (days == null) return null;
      const units = effectiveUnits(qty, params.minimumUnits ?? null);
      return calculateEquipmentServiceTotal(rate, units, days);
    }

    case "watch": {
      const days = resolveScopeDays(spec, duration);
      if (days == null) return null;
      return calculateWatchServiceTotal(rate, days, params.shiftHours ?? 8);
    }

    case "connection_daily": {
      const days = resolveScopeDays(spec, duration);
      if (days == null) return null;
      const connections = qty || params.defaultConnections || 1;
      return calculateConnectionDailyTotal(rate, connections, days);
    }

    case "connect_disconnect": {
      const connections = qty || params.defaultConnections || 1;
      const mult = params.connectDisconnectMultiplier ?? 2;
      return calculateConnectDisconnectTotal(rate, connections, mult);
    }

    case "per_m2":
      return Math.round(rate * qty * 100) / 100;

    default:
      return line.quotedTotal;
  }
}

export function watchDailyPreview(
  ratePerPerson: number,
  shiftHours = 8,
): { personsPerDay: number; dailyCost: number } {
  const personsPerDay = personsFor24HourCoverage(shiftHours);
  return {
    personsPerDay,
    dailyCost: dailyWatchCost(ratePerPerson, shiftHours),
  };
}
