/** Resolve the best available quote total for PO / invoice comparison displays. */
export function resolveQuoteDisplayAmount(quote: {
  totalAmount?: number | null;
  netAmountAfterDiscount?: number | null;
  grossAmountBeforeDiscount?: number | null;
  quotedItemsTotal?: number | null;
}): number | null {
  if (quote.totalAmount != null && !Number.isNaN(Number(quote.totalAmount))) {
    return Number(quote.totalAmount);
  }
  if (
    quote.netAmountAfterDiscount != null &&
    !Number.isNaN(Number(quote.netAmountAfterDiscount))
  ) {
    return Number(quote.netAmountAfterDiscount);
  }
  if (
    quote.grossAmountBeforeDiscount != null &&
    !Number.isNaN(Number(quote.grossAmountBeforeDiscount))
  ) {
    return Number(quote.grossAmountBeforeDiscount);
  }
  if (
    quote.quotedItemsTotal != null &&
    !Number.isNaN(Number(quote.quotedItemsTotal)) &&
    quote.quotedItemsTotal > 0
  ) {
    return Number(quote.quotedItemsTotal);
  }
  return null;
}
