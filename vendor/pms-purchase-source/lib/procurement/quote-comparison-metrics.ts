/** Shared metrics for purchase quote comparison dashboard (KPI cards, vendor grid, tabs). */

export type QuoteLineItem = {
  itemName: string;
  quantity: number;
  unitPrice: number | null;
  totalPrice: number | null;
};

export type QuoteForMetrics = {
  quoteId: string;
  currency: string;
  quoteToUsdRate?: number | null;
  totalAmount: number | null;
  additionalCharges?: number | null;
  deliveryCharges?: number | null;
  packingCharges?: number | null;
  paymentTerms?: string | null;
  deliveryTerms?: string | null;
  leadTime?: string | null;
  validityPeriod?: string | null;
  validUntil?: Date | string | null;
  items: QuoteLineItem[];
  vendor: { id: string; name: string; rating?: number | null; email?: string };
};

export type RequisitionItemForMetrics = {
  id: string;
  itemName: string;
  quantity: number;
  unit: string;
};

export function calculateDiscount(
  totalPrice: number | null,
  quantity: number,
  unitPrice: number | null
): number {
  if (!totalPrice || !unitPrice || quantity === 0) return 0;
  const calculatedDiscount = 100 - (totalPrice * 100) / (quantity * unitPrice);
  return Math.max(0, Math.min(100, calculatedDiscount));
}

export function calculateTotalWithUpdatedQty(
  updatedQty: number,
  unitPrice: number | null,
  discount: number
): number | null {
  if (!unitPrice) return null;
  if (updatedQty <= 0) return 0;
  return (updatedQty * unitPrice * (100 - discount)) / 100;
}

export function computeQuoteGrandTotal(
  quote: QuoteForMetrics,
  requisitionItems: RequisitionItemForMetrics[],
  getUpdatedQuantity: (itemId: string, defaultQty: number) => number,
  matchItem: (quote: QuoteForMetrics, reqItem: RequisitionItemForMetrics) => QuoteLineItem | undefined
): number {
  let subTotal = 0;
  let totalDiscount = 0;
  for (const item of requisitionItems) {
    const quoteItem = matchItem(quote, item);
    if (!quoteItem?.unitPrice) continue;
    const uq = getUpdatedQuantity(item.id, item.quantity);
    subTotal += uq * quoteItem.unitPrice;
    const disc = calculateDiscount(quoteItem.totalPrice, quoteItem.quantity, quoteItem.unitPrice);
    if (disc > 0) {
      const orig = uq * quoteItem.unitPrice;
      const discounted = calculateTotalWithUpdatedQty(uq, quoteItem.unitPrice, disc);
      if (discounted != null) totalDiscount += orig - discounted;
    }
  }
  const addCh = Number(quote.additionalCharges ?? 0);
  const delCh = Number(quote.deliveryCharges ?? 0);
  return subTotal - totalDiscount + addCh + delCh;
}

export function countQuotedItems(
  quote: QuoteForMetrics,
  requisitionItems: RequisitionItemForMetrics[],
  matchItem: (quote: QuoteForMetrics, reqItem: RequisitionItemForMetrics) => QuoteLineItem | undefined
): { quoted: number; missing: number; total: number; pct: number } {
  const total = requisitionItems.length;
  let quoted = 0;
  for (const item of requisitionItems) {
    const qi = matchItem(quote, item);
    if (qi?.unitPrice != null || qi?.totalPrice != null) quoted += 1;
  }
  const missing = total - quoted;
  const pct = total > 0 ? Math.round((quoted / total) * 100) : 0;
  return { quoted, missing, total, pct };
}

export type RankedQuoteMetrics = QuoteForMetrics & {
  rank: number;
  grandTotal: number;
  quotedStats: ReturnType<typeof countQuotedItems>;
};

export function buildRankedQuoteMetrics(
  quotes: QuoteForMetrics[],
  requisitionItems: RequisitionItemForMetrics[],
  getUpdatedQuantity: (itemId: string, defaultQty: number) => number,
  matchItem: (quote: QuoteForMetrics, reqItem: RequisitionItemForMetrics) => QuoteLineItem | undefined
): RankedQuoteMetrics[] {
  return quotes
    .map((quote) => ({
      ...quote,
      grandTotal: computeQuoteGrandTotal(quote, requisitionItems, getUpdatedQuantity, matchItem),
      quotedStats: countQuotedItems(quote, requisitionItems, matchItem),
    }))
    .sort((a, b) => a.grandTotal - b.grandTotal)
    .map((q, i) => ({ ...q, rank: i + 1 }));
}

export type ComparisonKpiData = {
  lowestBid: number;
  lowestCurrency: string;
  lowestVendorName: string;
  diffToSecond: number | null;
  diffToSecondPct: number | null;
  secondVendorName: string | null;
  savingPct: number | null;
  awardVendorName: string;
  commercialScore: number;
  completenessScore: number;
  itemStats: { quoted: number; missing: number; total: number };
};

export function buildComparisonKpis(
  ranked: RankedQuoteMetrics[],
  requisitionItems: RequisitionItemForMetrics[]
): ComparisonKpiData | null {
  if (ranked.length === 0) return null;
  const first = ranked[0];
  const second = ranked[1];
  const diffToSecond = second ? second.grandTotal - first.grandTotal : null;
  const diffToSecondPct =
    second && first.grandTotal > 0 ? ((second.grandTotal - first.grandTotal) / first.grandTotal) * 100 : null;

  const maxTotal = Math.max(...ranked.map((q) => q.grandTotal), 1);
  const savingPct =
    ranked.length > 1 && maxTotal > 0
      ? Math.round(((maxTotal - first.grandTotal) / maxTotal) * 1000) / 10
      : null;

  const paymentScore = first.paymentTerms?.trim() ? 95 : 70;
  const completeness = first.quotedStats.pct;
  const commercialScore = Math.round((paymentScore + completeness) / 2);

  const allQuoted = requisitionItems.length;
  let totalQuoted = 0;
  let totalMissing = 0;
  for (const q of ranked) {
    totalQuoted += q.quotedStats.quoted;
    totalMissing += q.quotedStats.missing;
  }
  const itemStats = {
    quoted: Math.round(totalQuoted / ranked.length),
    missing: Math.round(totalMissing / ranked.length),
    total: allQuoted,
  };

  return {
    lowestBid: first.grandTotal,
    lowestCurrency: first.currency,
    lowestVendorName: first.vendor.name,
    diffToSecond,
    diffToSecondPct: diffToSecondPct != null ? Math.round(diffToSecondPct * 100) / 100 : null,
    secondVendorName: second?.vendor.name ?? null,
    savingPct,
    awardVendorName: first.vendor.name,
    commercialScore,
    completenessScore: completeness,
    itemStats,
  };
}

export function costBreakdownForQuote(quote: RankedQuoteMetrics) {
  const material = Math.max(
    0,
    quote.grandTotal -
      Number(quote.deliveryCharges ?? 0) -
      Number(quote.additionalCharges ?? 0) -
      Number(quote.packingCharges ?? 0)
  );
  return {
    material,
    packing: Number(quote.packingCharges ?? 0),
    freight: Number(quote.deliveryCharges ?? 0),
    additional: Number(quote.additionalCharges ?? 0),
    grandTotal: quote.grandTotal,
    currency: quote.currency,
  };
}

export type VendorTotalsSummary = {
  subTotalBeforeDiscount: number;
  totalDiscountAmount: number;
  additionalCharges: number;
  deliveryCharges: number;
  grandTotal: number;
};

export function computeVendorTotalsSummary(
  quote: QuoteForMetrics,
  requisitionItems: RequisitionItemForMetrics[],
  getUpdatedQuantity: (itemId: string, defaultQty: number) => number,
  matchItem: (quote: QuoteForMetrics, reqItem: RequisitionItemForMetrics) => QuoteLineItem | undefined
): VendorTotalsSummary {
  let subTotalBeforeDiscount = 0;
  let totalDiscountAmount = 0;
  for (const item of requisitionItems) {
    const quoteItem = matchItem(quote, item);
    if (!quoteItem?.unitPrice) continue;
    const updatedQty = getUpdatedQuantity(item.id, item.quantity);
    subTotalBeforeDiscount += updatedQty * quoteItem.unitPrice;
    const discount = calculateDiscount(quoteItem.totalPrice, quoteItem.quantity, quoteItem.unitPrice);
    if (discount > 0) {
      const originalTotal = updatedQty * quoteItem.unitPrice;
      const discountedTotal = calculateTotalWithUpdatedQty(updatedQty, quoteItem.unitPrice, discount);
      if (discountedTotal != null) totalDiscountAmount += originalTotal - discountedTotal;
    }
  }
  const additionalCharges = Number(quote.additionalCharges ?? 0);
  const deliveryCharges = Number(quote.deliveryCharges ?? 0);
  const grandTotal = subTotalBeforeDiscount - totalDiscountAmount + additionalCharges + deliveryCharges;
  return {
    subTotalBeforeDiscount,
    totalDiscountAmount,
    additionalCharges,
    deliveryCharges,
    grandTotal,
  };
}
