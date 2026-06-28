import type { VesselParticulars } from "@/lib/hull/calculateAreas";
import type { VendorHullPaintQuote } from "@/lib/hull/types";
import type { VendorDryDockQuote } from "@/lib/dryDock/types";
import type { VendorYardServicesQuote } from "@/lib/yardServices/types";
import type { VendorQuote } from "@/lib/types";

export type CompareTabId = "general" | "hull-paint" | "dry-dock" | "yard-services";

export interface CompareAppSnapshot {
  quotes: VendorQuote[];
  hullQuotes: VendorHullPaintQuote[];
  dryDockQuotes: VendorDryDockQuote[];
  yardQuotes: VendorYardServicesQuote[];
  activeTab: CompareTabId;
  threshold: number;
  extractedParticulars: VesselParticulars;
  vesselParticulars: VesselParticulars;
}

export const EMPTY_COMPARE_SNAPSHOT: CompareAppSnapshot = {
  quotes: [],
  hullQuotes: [],
  dryDockQuotes: [],
  yardQuotes: [],
  activeTab: "hull-paint",
  threshold: 0.55,
  extractedParticulars: {},
  vesselParticulars: { hullFactorType: "bulker-tanker-dw-40k-100k" },
};

export interface LocalProject {
  id: string;
  name: string;
  vesselName: string | null;
  snapshot: CompareAppSnapshot;
  createdAt: string;
  updatedAt: string;
}
