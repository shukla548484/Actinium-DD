import type { CalcParams, CalcRule, SpecLine } from "@/lib/tender/types";
import type { DurationContext } from "@/lib/tender/calculate";

/** Owner-defined quantity (connections, units, m², etc.) — yards do not edit this. */
export function resolveScopeQuantity(spec: SpecLine): number | null {
  if (spec.calcRule === "per_m2") {
    return spec.scopeAreaM2 ?? spec.defaultQty ?? spec.calcParams.defaultQty ?? null;
  }
  return (
    spec.defaultQty ??
    spec.calcParams.defaultQty ??
    spec.calcParams.defaultConnections ??
    null
  );
}

/** Owner-defined days override for this line; falls back to project duration. */
export function resolveScopeDays(
  spec: SpecLine,
  duration: DurationContext,
): number | null {
  if (spec.scopeDays != null) return spec.scopeDays;

  const field = spec.calcParams.daysField ?? defaultDaysField(spec.calcRule);
  switch (field) {
    case "dry_dock_days":
      return duration.dryDockDays;
    case "cpr_days":
      return duration.cprDays;
    case "shipyard_days":
      return duration.shipyardDays;
    case "connection_days":
      return duration.connectionDays;
    case "total_service":
    default:
      return duration.totalServiceDays;
  }
}

function defaultDaysField(rule: CalcRule): CalcParams["daysField"] {
  switch (rule) {
    case "per_day":
      return "dry_dock_days";
    case "connection_daily":
      return "connection_days";
    default:
      return "total_service";
  }
}

export function scopeSummary(
  spec: SpecLine,
  duration: DurationContext,
): {
  quantity: number | null;
  days: number | null;
  areaM2: number | null;
  unit: string | null;
} {
  return {
    quantity: resolveScopeQuantity(spec),
    days: needsDays(spec.calcRule) ? resolveScopeDays(spec, duration) : null,
    areaM2: spec.calcRule === "per_m2" ? resolveScopeQuantity(spec) : spec.scopeAreaM2,
    unit: spec.unit,
  };
}

function needsDays(rule: CalcRule): boolean {
  return [
    "per_day",
    "unit_qty_days",
    "watch",
    "connection_daily",
  ].includes(rule);
}

export function applyDiscount(
  gross: number | null,
  discountPct: number | null,
  maxDiscountPct?: number | null,
): { grossTotal: number | null; netTotal: number | null } {
  if (gross == null) return { grossTotal: null, netTotal: null };
  let pct = discountPct ?? 0;
  if (maxDiscountPct != null) pct = Math.min(pct, maxDiscountPct);
  pct = Math.max(0, Math.min(pct, 100));
  const netTotal = Math.round(gross * (1 - pct / 100) * 100) / 100;
  return { grossTotal: gross, netTotal };
}

export function applyQuoteCommercials(
  lineNetSum: number,
  globalDiscountPct: number | null,
  taxPct: number | null,
): { grossTotal: number; netTotal: number } {
  let net = lineNetSum;
  const globalDisc = globalDiscountPct ?? 0;
  if (globalDisc > 0) {
    net = Math.round(net * (1 - globalDisc / 100) * 100) / 100;
  }
  const tax = taxPct ?? 0;
  if (tax > 0) {
    net = Math.round(net * (1 + tax / 100) * 100) / 100;
  }
  return { grossTotal: lineNetSum, netTotal: net };
}
