/**
 * Quote status rules: VendorQuote is set to RECEIVED only when the quote was received
 * (email or vendor portal) AND at least one item has a non-zero quoted cost.
 */

export type ItemWithPrices = {
  unitPrice?: number | null;
  totalPrice?: number | null;
};

/**
 * Returns true if at least one item has a non-zero unit price or total price.
 * Used to decide whether to set VendorQuote status to RECEIVED.
 */
export function hasAtLeastOneQuotedCost(
  items: ItemWithPrices[]
): boolean {
  if (!items?.length) return false;
  return items.some((item) => {
    const u = item.unitPrice;
    const t = item.totalPrice;
    return (u != null && Number(u) > 0) || (t != null && Number(t) > 0);
  });
}
