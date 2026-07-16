"use client";

import type { ComparisonKpiData } from "@/lib/procurement/quote-comparison-metrics";
import type { DashboardRankedQuote } from "./VendorRankingTable";
import { costBreakdownForQuote } from "@/lib/procurement/quote-comparison-metrics";
import { ComparisonVendorTotals, type VendorTotalRow } from "./ComparisonVendorTotals";

type Props = {
  kpis: ComparisonKpiData;
  topQuote: DashboardRankedQuote | undefined;
  vendorTotalRows: VendorTotalRow[];
  requisitionNumber?: string;
  formatAmount: (amount: number, currency: string, quoteToUsdRate?: number | null) => string;
  formatDisplayTotal?: (amount: number, currency: string, quoteToUsdRate?: number | null) => string;
};

export function ComparisonOverviewTab({
  kpis,
  topQuote,
  vendorTotalRows,
  requisitionNumber,
  formatAmount,
  formatDisplayTotal,
}: Props) {
  const breakdown = topQuote
    ? costBreakdownForQuote({
        quoteId: topQuote.quoteId,
        currency: topQuote.currency,
        quoteToUsdRate: topQuote.quoteToUsdRate,
        totalAmount: topQuote.displayGrandTotal,
        grandTotal: topQuote.displayGrandTotal,
        additionalCharges: topQuote.additionalCharges,
        deliveryCharges: topQuote.deliveryCharges,
        packingCharges: topQuote.packingCharges,
        items: [],
        vendor: topQuote.vendor,
        quotedStats: { quoted: 0, missing: 0, total: 0, pct: 0 },
        rank: topQuote.rank,
      })
    : null;

  return (
    <div className="grid gap-2">
      <div className="rounded border border-border p-2">
        <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Award recommendation</h3>
        <p className="text-sm font-bold text-foreground">{kpis.awardVendorName}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Lowest responsive bid · {formatAmount(kpis.lowestBid, kpis.lowestCurrency)}
        </p>
        {requisitionNumber && (
          <p className="mt-1 text-[10px] text-muted-foreground">Requisition {requisitionNumber}</p>
        )}
      </div>

      {breakdown && topQuote && (
        <div className="rounded border border-border p-2">
          <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            L1 cost breakdown — {topQuote.vendor.name}
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {(
              [
                ["Material", breakdown.material],
                ["Packing", breakdown.packing],
                ["Freight", breakdown.freight],
                ["Other", breakdown.additional],
                ["Total", breakdown.grandTotal],
              ] as const
            ).map(([label, amount], i) => (
              <div
                key={label}
                className={`flex min-w-0 flex-col gap-0.5 ${i === 4 ? "font-bold sm:border-l sm:border-border sm:pl-2" : ""}`}
              >
                <span className="text-[10px] text-muted-foreground">{label}</span>
                <span className="truncate text-[11px] leading-tight">
                  {formatAmount(amount, breakdown.currency, topQuote.quoteToUsdRate)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {vendorTotalRows.length > 0 && (
        <div className="rounded border border-border p-2">
          <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Quote totals (all vendors)</h3>
          <ComparisonVendorTotals
            rows={vendorTotalRows}
            formatAmount={formatAmount}
            formatDisplayTotal={formatDisplayTotal}
          />
        </div>
      )}
    </div>
  );
}
