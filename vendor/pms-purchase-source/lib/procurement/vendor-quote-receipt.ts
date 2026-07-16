/** Shared rules for when a vendor quote counts as "received" vs comparable on Bid Comparison. */

export type VendorQuoteLineForReceipt = {
  unitPrice?: unknown | null;
  totalPrice?: unknown | null;
};

export type VendorQuoteForReceipt = {
  status: string;
  quotedItems?: VendorQuoteLineForReceipt[] | null;
};

export type VendorQuoteForDedup = VendorQuoteForReceipt & {
  vendorId: string;
  receivedAt?: Date | string | null;
  createdAt?: Date | string | null;
};

export type RequisitionQuoteStats = {
  totalQuotesSent: number;
  receivedQuotes: number;
  declinedQuotes: number;
};

const RECEIVED_STATUSES = new Set(["RECEIVED", "APPROVED"]);
const SENT_STATUSES = new Set([
  "SENT",
  "RECEIVED",
  "REJECTED",
  "DECLINED",
  "APPROVED",
]);

export function isVendorQuoteStatusReceived(status: string): boolean {
  return RECEIVED_STATUSES.has(status);
}

export function isVendorQuoteStatusSent(status: string): boolean {
  return SENT_STATUSES.has(status);
}

/** At least one line has a vendor-entered price (same rule as /api/quotes/[id]/compare). */
export function vendorQuoteHasComparablePrices(
  quotedItems?: VendorQuoteLineForReceipt[] | null
): boolean {
  return (
    !!quotedItems?.length &&
    quotedItems.some(
      (item) => item.unitPrice != null || item.totalPrice != null
    )
  );
}

/** Shown on Bid Comparison — priced lines required, not status alone. */
export function isVendorQuoteComparable(quote: VendorQuoteForReceipt): boolean {
  return (
    isVendorQuoteStatusReceived(quote.status) &&
    vendorQuoteHasComparablePrices(quote.quotedItems)
  );
}

export function countComparableVendorQuotes(
  quotes: VendorQuoteForReceipt[]
): number {
  return quotes.filter(isVendorQuoteComparable).length;
}

/** Same ordering as Bid Comparison — latest response per vendor wins. */
function vendorQuoteRecencyTimestamp(quote: VendorQuoteForDedup): number {
  const received = quote.receivedAt ? new Date(quote.receivedAt).getTime() : 0;
  if (Number.isFinite(received) && received > 0) return received;
  const created = quote.createdAt ? new Date(quote.createdAt).getTime() : 0;
  return Number.isFinite(created) ? created : 0;
}

/** One row per vendor (matches /api/quotes/[id]/compare deduplication). */
export function dedupeVendorQuotesByLatest<T extends VendorQuoteForDedup>(
  quotes: T[]
): T[] {
  const byVendor = new Map<string, T>();
  for (const quote of quotes) {
    const existing = byVendor.get(quote.vendorId);
    if (!existing) {
      byVendor.set(quote.vendorId, quote);
      continue;
    }
    if (vendorQuoteRecencyTimestamp(quote) >= vendorQuoteRecencyTimestamp(existing)) {
      byVendor.set(quote.vendorId, quote);
    }
  }
  return Array.from(byVendor.values());
}

/** Supplier column X/Y — counts unique vendors, not duplicate VendorQuote rows. */
export function computeRequisitionQuoteStats(
  quotes: VendorQuoteForDedup[]
): RequisitionQuoteStats {
  const unique = dedupeVendorQuotesByLatest(quotes);
  return {
    totalQuotesSent: unique.filter((q) => isVendorQuoteStatusSent(q.status)).length,
    receivedQuotes: countComparableVendorQuotes(unique),
    declinedQuotes: unique.filter(
      (q) => q.status === "REJECTED" || q.status === "DECLINED"
    ).length,
  };
}

export function countStatusReceivedWithoutPrices(
  quotes: VendorQuoteForReceipt[]
): number {
  return quotes.filter(
    (q) => isVendorQuoteStatusReceived(q.status) && !vendorQuoteHasComparablePrices(q.quotedItems)
  ).length;
}
