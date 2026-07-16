"use client";

import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { VendorTotalsSummary } from "@/lib/procurement/quote-comparison-metrics";

export type VendorTotalRow = {
  quoteId: string;
  rank: number;
  status: string;
  currency: string;
  quoteToUsdRate?: number | null;
  vendorName: string;
  totals: VendorTotalsSummary;
};

type Props = {
  rows: VendorTotalRow[];
  formatAmount: (amount: number, currency: string, quoteToUsdRate?: number | null) => string;
  formatDisplayTotal?: (amount: number, currency: string, quoteToUsdRate?: number | null) => string;
};

const thBase = "h-7 px-1.5 text-[11px] font-semibold text-foreground";
const tdBase = "px-1.5 py-1 align-middle text-[10px] font-normal";
const tdMoney = `${tdBase} whitespace-normal text-right leading-tight`;

export function ComparisonVendorTotals({ rows, formatAmount, formatDisplayTotal }: Props) {
  const fmt = formatDisplayTotal ?? formatAmount;

  return (
    <div className="overflow-x-auto rounded border border-border">
      <Table className="table-fixed w-full min-w-[640px]">
        <colgroup>
          <col style={{ width: "2rem" }} />
          <col style={{ width: "18%" }} />
          <col style={{ width: "16%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "18%" }} />
        </colgroup>
        <TableHeader>
          <TableRow className="bg-muted hover:bg-muted">
            <TableHead className={`${thBase} text-center`}>#</TableHead>
            <TableHead className={thBase}>Vendor</TableHead>
            <TableHead className={`${thBase} text-right`}>Subtotal</TableHead>
            <TableHead className={`${thBase} text-right`}>Discount</TableHead>
            <TableHead className={`${thBase} text-right`}>Other</TableHead>
            <TableHead className={`${thBase} text-right`}>Delivery</TableHead>
            <TableHead className={`${thBase} text-right`}>Grand total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => {
            const isApproved = row.status === "APPROVED";
            return (
              <TableRow
                key={row.quoteId}
                className={
                  isApproved
                    ? "border-l-2 border-l-primary bg-primary/5"
                    : index === 0
                      ? "bg-success/10"
                      : ""
                }
              >
                <TableCell className={`${tdBase} text-center text-xs font-bold`}>{row.rank}</TableCell>
                <TableCell className={`${tdBase} min-w-0 truncate`}>
                  <div className="flex items-center gap-1">
                    <span className="truncate text-xs font-medium">{row.vendorName}</span>
                    {isApproved && (
                      <Badge className="h-4 shrink-0 px-1 text-[9px]">OK</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className={tdMoney}>
                  {formatAmount(row.totals.subTotalBeforeDiscount, row.currency, row.quoteToUsdRate)}
                </TableCell>
                <TableCell className={`${tdMoney} text-success`}>
                  {row.totals.totalDiscountAmount > 0
                    ? `-${formatAmount(row.totals.totalDiscountAmount, row.currency, row.quoteToUsdRate)}`
                    : "—"}
                </TableCell>
                <TableCell className={tdMoney}>
                  {row.totals.additionalCharges > 0
                    ? formatAmount(row.totals.additionalCharges, row.currency, row.quoteToUsdRate)
                    : "—"}
                </TableCell>
                <TableCell className={tdMoney}>
                  {row.totals.deliveryCharges > 0
                    ? formatAmount(row.totals.deliveryCharges, row.currency, row.quoteToUsdRate)
                    : "—"}
                </TableCell>
                <TableCell className={`${tdMoney} text-xs font-semibold`}>
                  {fmt(row.totals.grandTotal, row.currency, row.quoteToUsdRate)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
