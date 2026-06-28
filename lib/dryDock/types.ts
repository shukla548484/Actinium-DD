export interface VendorDryDockQuote {
  vendorName: string;
  fileName: string;
  /** Days explicitly stated by the shipyard (header / summary), not from line-item qty. */
  dryDockDays: number | null;
  daysSource: string | null;
  dailyRatePerDay: number | null;
  rateSource: string | null;
  rateLineLabel: string | null;
  /** dryDockDays × dailyRatePerDay when both are known. */
  calculatedTotal: number | null;
  /** Total on the dry-dock hire line item, if present. */
  quotedTotal: number | null;
  warnings: string[];
}

export interface DryDockComparison {
  vendors: string[];
  byVendor: Record<string, VendorDryDockQuote>;
}
