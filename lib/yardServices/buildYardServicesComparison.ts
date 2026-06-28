import type {
  VendorYardServicesQuote,
  YardServicesComparison,
  YardServicesComparisonRow,
} from "@/lib/yardServices/types";
import {
  CONNECTION_SERVICES,
  TEMPORARY_EQUIPMENT_SERVICES,
  WATCH_SERVICES,
} from "@/lib/yardServices/constants";

export function buildYardServicesComparison(
  quotes: VendorYardServicesQuote[],
): YardServicesComparison {
  const vendors = quotes.map((q) => q.vendorName);
  const durationByVendor = Object.fromEntries(
    quotes.map((q) => [q.vendorName, q.duration]),
  );

  const totalsByVendor = Object.fromEntries(
    quotes.map((q) => [
      q.vendorName,
      {
        watchGrandTotal: q.watchGrandTotal,
        equipmentGrandTotal: q.equipmentGrandTotal,
        connectionGrandTotal: q.connectionGrandTotal,
        grandTotal: q.grandTotal,
      },
    ]),
  );

  const serviceDefs = [
    ...WATCH_SERVICES.map((s) => ({ ...s, kind: "watch" as const })),
    ...TEMPORARY_EQUIPMENT_SERVICES.map((s) => ({ ...s, kind: "equipment" as const })),
    ...CONNECTION_SERVICES.map((s) => ({
      id: s.id,
      name: s.name,
      kind: "connection" as const,
      connectDisconnectMultiplier: s.connectDisconnectMultiplier,
    })),
  ];

  const rows: YardServicesComparisonRow[] = serviceDefs.map((def) => {
    const byVendor: YardServicesComparisonRow["byVendor"] = {};

    for (const quote of quotes) {
      if (def.kind === "watch") {
        const line = quote.watchServices.find((l) => l.serviceId === def.id);
        byVendor[quote.vendorName] = {
          rate: line?.ratePerPersonPerDay ?? null,
          shiftHours: line?.shiftHours,
          personsPerDay: line?.personsPerDay,
          dailyCost: line?.dailyCost ?? null,
          serviceDays: line?.serviceDays ?? null,
          calculatedTotal: line?.calculatedTotal ?? null,
          quotedTotal: line?.quotedTotal ?? null,
          originalLabel: line?.originalLabel ?? null,
        };
      } else if (def.kind === "equipment") {
        const line = quote.temporaryEquipment.find((l) => l.serviceId === def.id);
        byVendor[quote.vendorName] = {
          rate: line?.ratePerUnitPerDay ?? null,
          quotedQuantity: line?.quotedQuantity ?? null,
          minimumUnits: line?.minimumUnits ?? null,
          effectiveUnits: line?.effectiveUnits ?? null,
          dailyCost: line?.dailyCost ?? null,
          serviceDays: line?.serviceDays ?? null,
          calculatedTotal: line?.calculatedTotal ?? null,
          quotedTotal: line?.quotedTotal ?? null,
          originalLabel: line?.originalLabel ?? null,
        };
      } else {
        const line = quote.connectionServices.find((l) => l.serviceId === def.id);
        byVendor[quote.vendorName] = {
          rate: line?.ratePerConnectionPerDay ?? null,
          effectiveUnits: line?.connectionCount ?? null,
          rateConnectDisconnect: line?.rateConnectDisconnect ?? null,
          connectDisconnectTotal: line?.connectDisconnectTotal ?? null,
          connectDisconnectMultiplier: line?.connectDisconnectMultiplier,
          dailyCost: line?.dailyTotal ?? null,
          serviceDays: line?.serviceDays ?? null,
          calculatedTotal: line?.calculatedTotal ?? null,
          quotedTotal: line?.quotedTotal ?? null,
          originalLabel: line?.originalLabel ?? null,
        };
      }
    }

    return {
      serviceId: def.id,
      serviceName: def.name,
      kind: def.kind,
      connectDisconnectMultiplier:
        def.kind === "connection" ? def.connectDisconnectMultiplier : undefined,
      byVendor,
    };
  });

  return { vendors, durationByVendor, rows, totalsByVendor };
}
