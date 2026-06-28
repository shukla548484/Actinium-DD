import type { DryDockComparison, VendorDryDockQuote } from "@/lib/dryDock/types";

export function buildDryDockComparison(
  quotes: VendorDryDockQuote[],
): DryDockComparison {
  const vendors = quotes.map((q) => q.vendorName);
  const byVendor = Object.fromEntries(
    quotes.map((q) => [q.vendorName, q]),
  ) as Record<string, VendorDryDockQuote>;
  return { vendors, byVendor };
}
