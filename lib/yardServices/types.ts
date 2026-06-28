export interface VesselDuration {
  /** Days at shipyard (excluding or including dry dock — taken as stated in the sheet). */
  shipyardDays: number | null;
  shipyardDaysSource: string | null;
  /** Days in dry dock — from header / summary only, not line-item qty. */
  dryDockDays: number | null;
  dryDockDaysSource: string | null;
  /** CPR / common repair period — preferred for connection daily charges. */
  cprDays: number | null;
  cprDaysSource: string | null;
  /** shipyardDays + dryDockDays when at least one is known. */
  totalServiceDays: number | null;
  /** cprDays → shipyardDays → totalServiceDays for utility connections. */
  connectionDays: number | null;
}

export interface WatchServiceLine {
  serviceId: string;
  serviceName: string;
  ratePerPersonPerDay: number | null;
  shiftHours: number;
  personsPerDay: number;
  dailyCost: number | null;
  serviceDays: number | null;
  calculatedTotal: number | null;
  quotedTotal: number | null;
  originalLabel: string;
  sheetName: string;
  rowIndex: number;
}

export interface TemporaryEquipmentLine {
  serviceId: string;
  serviceName: string;
  ratePerUnitPerDay: number | null;
  quotedQuantity: number | null;
  minimumUnits: number | null;
  /** max(quotedQuantity, minimumUnits) — at least 1 when neither is stated. */
  effectiveUnits: number | null;
  serviceDays: number | null;
  dailyCost: number | null;
  calculatedTotal: number | null;
  quotedTotal: number | null;
  originalLabel: string;
  sheetName: string;
  rowIndex: number;
}

export interface ConnectionServiceLine {
  serviceId: string;
  serviceName: string;
  connectionCount: number;
  ratePerConnectionPerDay: number | null;
  rateConnectDisconnect: number | null;
  connectDisconnectMultiplier: number;
  serviceDays: number | null;
  dailyTotal: number | null;
  connectDisconnectTotal: number | null;
  calculatedTotal: number | null;
  quotedTotal: number | null;
  originalLabel: string;
  sheetName: string;
  rowIndex: number;
}

export interface VendorYardServicesQuote {
  vendorName: string;
  fileName: string;
  duration: VesselDuration;
  watchServices: WatchServiceLine[];
  temporaryEquipment: TemporaryEquipmentLine[];
  connectionServices: ConnectionServiceLine[];
  watchGrandTotal: number | null;
  equipmentGrandTotal: number | null;
  connectionGrandTotal: number | null;
  /** watch + equipment + connections */
  grandTotal: number | null;
  warnings: string[];
}

export interface YardServicesComparisonRow {
  serviceId: string;
  serviceName: string;
  kind: "watch" | "equipment" | "connection";
  connectDisconnectMultiplier?: number;
  byVendor: Record<
    string,
    {
      rate: number | null;
      shiftHours?: number;
      personsPerDay?: number;
      quotedQuantity?: number | null;
      minimumUnits?: number | null;
      effectiveUnits?: number | null;
      rateConnectDisconnect?: number | null;
      connectDisconnectTotal?: number | null;
      connectDisconnectMultiplier?: number;
      dailyCost: number | null;
      serviceDays: number | null;
      calculatedTotal: number | null;
      quotedTotal: number | null;
      originalLabel: string | null;
    }
  >;
}

export interface YardServicesComparison {
  vendors: string[];
  durationByVendor: Record<string, VesselDuration>;
  rows: YardServicesComparisonRow[];
  totalsByVendor: Record<
    string,
    {
      watchGrandTotal: number | null;
      equipmentGrandTotal: number | null;
      connectionGrandTotal: number | null;
      grandTotal: number | null;
    }
  >;
}
