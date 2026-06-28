import {
  DEFAULT_SHIFT_HOURS,
  HOURS_PER_DAY,
} from "@/lib/yardServices/constants";
import type { VesselDuration } from "@/lib/yardServices/types";

/** Persons needed to cover 24 hours when each works one shift. */
export function personsFor24HourCoverage(shiftHours: number): number {
  if (shiftHours <= 0) return 3;
  return Math.ceil(HOURS_PER_DAY / shiftHours);
}

/** Daily cost = rate per person per shift × persons per day (e.g. 80 × 3 = 240). */
export function dailyWatchCost(
  ratePerPersonPerDay: number,
  shiftHours = DEFAULT_SHIFT_HOURS,
): number {
  return ratePerPersonPerDay * personsFor24HourCoverage(shiftHours);
}

export function totalServiceDays(
  shipyardDays: number | null,
  dryDockDays: number | null,
): number | null {
  if (shipyardDays != null && dryDockDays != null) {
    return shipyardDays + dryDockDays;
  }
  if (shipyardDays != null) return shipyardDays;
  if (dryDockDays != null) return dryDockDays;
  return null;
}

export function connectionDays(
  cprDays: number | null,
  shipyardDays: number | null,
  totalService: number | null,
): number | null {
  if (cprDays != null) return cprDays;
  if (shipyardDays != null) return shipyardDays;
  return totalService;
}

export function buildVesselDuration(
  shipyardDays: number | null,
  shipyardDaysSource: string | null,
  dryDockDays: number | null,
  dryDockDaysSource: string | null,
  cprDays: number | null = null,
  cprDaysSource: string | null = null,
): VesselDuration {
  const totalService = totalServiceDays(shipyardDays, dryDockDays);
  return {
    shipyardDays,
    shipyardDaysSource,
    dryDockDays,
    dryDockDaysSource,
    cprDays,
    cprDaysSource,
    totalServiceDays: totalService,
    connectionDays: connectionDays(cprDays, shipyardDays, totalService),
  };
}

export function calculateWatchServiceTotal(
  ratePerPersonPerDay: number,
  serviceDays: number,
  shiftHours = DEFAULT_SHIFT_HOURS,
): number {
  return (
    Math.round(dailyWatchCost(ratePerPersonPerDay, shiftHours) * serviceDays * 100) /
    100
  );
}

/** Units billed = max(quoted qty, minimum), defaulting each to 1 when missing. */
export function effectiveUnits(
  quotedQuantity: number | null | undefined,
  minimumUnits: number | null | undefined,
): number {
  const qty = quotedQuantity != null && quotedQuantity > 0 ? quotedQuantity : 1;
  const min = minimumUnits != null && minimumUnits > 0 ? minimumUnits : 1;
  return Math.max(qty, min);
}

/** Daily cost = rate per unit per day × effective units. */
export function dailyEquipmentCost(
  ratePerUnitPerDay: number,
  units: number,
): number {
  return ratePerUnitPerDay * units;
}

export function calculateEquipmentServiceTotal(
  ratePerUnitPerDay: number,
  units: number,
  serviceDays: number,
): number {
  return (
    Math.round(dailyEquipmentCost(ratePerUnitPerDay, units) * serviceDays * 100) /
    100
  );
}

export function calculateConnectionDailyTotal(
  ratePerConnectionPerDay: number,
  connectionCount: number,
  serviceDays: number,
): number {
  return (
    Math.round(ratePerConnectionPerDay * connectionCount * serviceDays * 100) / 100
  );
}

export function calculateConnectDisconnectTotal(
  rateConnectDisconnect: number,
  connectionCount: number,
  multiplier: number,
): number {
  return Math.round(rateConnectDisconnect * connectionCount * multiplier * 100) / 100;
}

export function calculateConnectionServiceTotal(
  ratePerConnectionPerDay: number | null,
  rateConnectDisconnect: number | null,
  connectionCount: number,
  serviceDays: number | null,
  connectDisconnectMultiplier: number,
): number | null {
  let total = 0;
  let hasPart = false;

  if (
    ratePerConnectionPerDay != null &&
    serviceDays != null &&
    serviceDays > 0 &&
    connectionCount > 0
  ) {
    total += calculateConnectionDailyTotal(
      ratePerConnectionPerDay,
      connectionCount,
      serviceDays,
    );
    hasPart = true;
  }

  if (rateConnectDisconnect != null && connectionCount > 0) {
    total += calculateConnectDisconnectTotal(
      rateConnectDisconnect,
      connectionCount,
      connectDisconnectMultiplier,
    );
    hasPart = true;
  }

  return hasPart ? Math.round(total * 100) / 100 : null;
}

export function sumNullable(values: (number | null | undefined)[]): number | null {
  const nums = values.filter((v): v is number => v != null && !Number.isNaN(v));
  if (nums.length === 0) return null;
  return Math.round(nums.reduce((a, b) => a + b, 0) * 100) / 100;
}
