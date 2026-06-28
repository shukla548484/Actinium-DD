import type {
  CalculatedHullAreas,
  VesselParticulars,
} from "@/lib/hull/calculateAreas";

export interface HullZoneDefinition {
  id: string;
  name: string;
  aliases: string[];
}

export interface PrepServiceDefinition {
  id: string;
  name: string;
  aliases: string[];
}

export interface HullZoneArea {
  zoneId: string;
  zoneName: string;
  areaSqm: number;
  /** Where the area was found, e.g. "Sheet1 row 8" */
  source: string;
  /** true when area comes from Paint Consultants formula */
  estimated?: boolean;
}

export interface HullPrepLineItem {
  zoneId: string;
  zoneName: string;
  serviceId: string;
  serviceName: string;
  areaSqm: number;
  unitRatePerSqm: number;
  calculatedTotal: number;
  quotedTotal?: number;
  originalLabel: string;
  sheetName: string;
  rowIndex: number;
}

export interface VendorHullPaintQuote {
  vendorName: string;
  fileName: string;
  zoneAreas: HullZoneArea[];
  lineItems: HullPrepLineItem[];
  vesselParticulars?: VesselParticulars;
  calculatedAreas?: CalculatedHullAreas;
}

export interface HullComparisonRow {
  zoneId: string;
  zoneName: string;
  serviceId: string;
  serviceName: string;
  areaByVendor: Record<string, number | null>;
  byVendor: Record<
    string,
    {
      unitRatePerSqm: number | null;
      calculatedTotal: number | null;
      quotedTotal: number | null;
      originalLabel: string | null;
      matchScore: number;
    }
  >;
}

export interface HullPaintComparison {
  vendors: string[];
  rows: HullComparisonRow[];
  zoneSummaries: {
    zoneId: string;
    zoneName: string;
    areaByVendor: Record<string, number | null>;
  }[];
}

export type { CalculatedHullAreas, VesselParticulars };
