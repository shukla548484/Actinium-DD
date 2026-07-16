"use client";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Edit, FileText } from "lucide-react";

type QuoteCommercial = {
  quoteId: string;
  rank: number;
  currency: string;
  quoteToUsdRate?: number | null;
  vendor: { name: string };
  paymentTerms?: string | null;
  deliveryTerms?: string | null;
  termsAndConditions?: string | null;
  packingCharges?: number | null;
  additionalCharges?: number | null;
  deliveryCharges?: number | null;
  deliveryChargesAttachment?: string | null;
  validityPeriod?: string | null;
  validUntil?: Date | string | null;
};

type Props = {
  quotes: QuoteCommercial[];
  formatAmount: (amount: number, currency: string, quoteToUsdRate?: number | null) => string;
  formatDate: (date: Date | string | null) => string;
  canEditDelivery?: boolean;
  onEditDelivery?: (quoteId: string) => void;
};

export function ComparisonCommercialTab({
  quotes,
  formatAmount,
  formatDate,
  canEditDelivery,
  onEditDelivery,
}: Props) {
  if (quotes.length === 0) {
    return <p className="p-2 text-xs text-muted-foreground">No quotes available.</p>;
  }

  return (
    <div className="overflow-x-auto rounded border border-border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted hover:bg-muted">
            <TableHead className="h-7 w-8 px-1.5 text-[11px] font-semibold text-foreground">#</TableHead>
            <TableHead className="h-7 px-1.5 text-[11px] font-semibold text-foreground">Vendor</TableHead>
            <TableHead className="h-7 px-1.5 text-[11px] font-semibold text-foreground">Payment</TableHead>
            <TableHead className="h-7 px-1.5 text-[11px] font-semibold text-foreground">Delivery terms</TableHead>
            <TableHead className="h-7 px-1.5 text-[11px] font-semibold text-foreground">Packing</TableHead>
            <TableHead className="h-7 px-1.5 text-[11px] font-semibold text-foreground">Other chg.</TableHead>
            <TableHead className="h-7 px-1.5 text-[11px] font-semibold text-foreground">Delivery</TableHead>
            <TableHead className="h-7 px-1.5 text-[11px] font-semibold text-foreground">Validity</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {quotes.map((q) => (
            <TableRow key={q.quoteId}>
              <TableCell className="px-1.5 py-1 text-center text-[10px] font-semibold">{q.rank}</TableCell>
              <TableCell className="px-1.5 py-1 text-[10px] font-normal">{q.vendor.name}</TableCell>
              <TableCell className="max-w-[140px] truncate px-1.5 py-1 text-[10px] font-normal">{q.paymentTerms || "—"}</TableCell>
              <TableCell className="max-w-[140px] truncate px-1.5 py-1 text-[10px] font-normal">{q.deliveryTerms || "—"}</TableCell>
              <TableCell className="px-1.5 py-1 text-[10px] font-normal">
                {q.packingCharges && Number(q.packingCharges) > 0
                  ? formatAmount(Number(q.packingCharges), q.currency, q.quoteToUsdRate)
                  : "—"}
              </TableCell>
              <TableCell className="px-1.5 py-1 text-[10px] font-normal">
                {q.additionalCharges && Number(q.additionalCharges) > 0
                  ? formatAmount(Number(q.additionalCharges), q.currency, q.quoteToUsdRate)
                  : "—"}
              </TableCell>
              <TableCell className="px-1.5 py-1 text-[10px] font-normal">
                <div className="flex items-center gap-0.5">
                  <span>
                    {q.deliveryCharges && Number(q.deliveryCharges) > 0
                      ? formatAmount(Number(q.deliveryCharges), q.currency, q.quoteToUsdRate)
                      : "—"}
                  </span>
                  {canEditDelivery && onEditDelivery && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={() => onEditDelivery(q.quoteId)}
                      title="Edit delivery charges"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                  )}
                  {q.deliveryChargesAttachment && (
                    <a
                      href={q.deliveryChargesAttachment}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-info"
                      title="Delivery charges attachment"
                    >
                      <FileText className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </TableCell>
              <TableCell className="px-1.5 py-1 text-[10px] font-normal">
                {q.validityPeriod || (q.validUntil ? formatDate(q.validUntil) : "—")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {quotes.some((q) => q.termsAndConditions) && (
        <div className="space-y-1 border-t border-border p-2">
          {quotes
            .filter((q) => q.termsAndConditions)
            .map((q) => (
              <div key={q.quoteId}>
                <p className="text-[10px] font-semibold">{q.vendor.name} — additional terms</p>
                <p className="whitespace-pre-wrap text-[10px] text-muted-foreground">{q.termsAndConditions}</p>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
