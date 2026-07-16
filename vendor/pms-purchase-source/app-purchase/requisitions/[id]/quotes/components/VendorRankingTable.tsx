"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TablePagination } from "@/components/ui/table-pagination";
import { StarRating } from "@/components/StarRating";
import { CheckCircle2, Download, Trophy } from "lucide-react";

export type DashboardRankedQuote = {
  quoteId: string;
  status: string;
  rank: number;
  currency: string;
  quoteToUsdRate?: number | null;
  displayGrandTotal: number;
  quotedPct: number;
  missingCount: number;
  paymentTerms?: string | null;
  leadTime?: string | null;
  additionalCharges?: number | null;
  deliveryCharges?: number | null;
  packingCharges?: number | null;
  vendor: { name: string; email: string; rating?: number | null };
  fileUrl?: string | null;
  fileName?: string | null;
  fileAttachmentId?: string | null;
};

type Props = {
  quotes: DashboardRankedQuote[];
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  formatTotal: (quote: DashboardRankedQuote) => string;
  allItemsAssignedToVendor: (quoteId: string) => boolean;
  onVendorSelectCheckbox: (quoteId: string, checked: boolean | "indeterminate") => void;
};

const thBase = "h-9 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";
const tdBase = "px-2 py-2 align-middle text-[11px] font-normal";

export function VendorRankingTable({
  quotes,
  page,
  pageSize,
  onPageChange,
  formatTotal,
  allItemsAssignedToVendor,
  onVendorSelectCheckbox,
}: Props) {
  const paginated = quotes.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="overflow-hidden rounded-md border border-border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
        <div>
          <p className="text-sm font-semibold text-foreground">Vendor ranking</p>
          <p className="text-[11px] text-muted-foreground">Commercial order with line coverage and quote status.</p>
        </div>
        <Badge variant="outline" className="h-6 px-2 text-[11px]">
          {quotes.length} vendors
        </Badge>
      </div>
      <div className="overflow-x-auto">
        <Table className="table-fixed w-full min-w-[720px]">
          <colgroup>
            <col style={{ width: "2.25rem" }} />
            <col style={{ width: "1.75rem" }} />
            <col style={{ width: "24%" }} />
            <col style={{ width: "19%" }} />
            <col style={{ width: "9%" }} />
            <col style={{ width: "13%" }} />
            <col style={{ width: "11%" }} />
            <col style={{ width: "11%" }} />
          </colgroup>
          <TableHeader>
            <TableRow className="bg-background hover:bg-background">
              <TableHead className={`${thBase} text-center`}>Sel</TableHead>
              <TableHead className={`${thBase} text-center`}>#</TableHead>
              <TableHead className={thBase}>Vendor</TableHead>
              <TableHead className={`${thBase} text-right`}>Total</TableHead>
              <TableHead className={`${thBase} text-center`}>Lines</TableHead>
              <TableHead className={thBase}>Payment</TableHead>
              <TableHead className={thBase}>Lead</TableHead>
              <TableHead className={`${thBase} text-center`}>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginated.map((quote, index) => {
              const isApproved = quote.status === "APPROVED";
              return (
                <TableRow
                  key={quote.quoteId}
                  className={
                    isApproved
                      ? "border-l-4 border-l-primary bg-primary/5"
                      : index === 0
                        ? "border-l-4 border-l-success bg-success/10"
                        : ""
                  }
                >
                  <TableCell className={`${tdBase} text-center`}>
                    <Checkbox
                      checked={allItemsAssignedToVendor(quote.quoteId)}
                      onCheckedChange={(c) => onVendorSelectCheckbox(quote.quoteId, c)}
                      disabled={allItemsAssignedToVendor(quote.quoteId)}
                      className="h-4 w-4"
                    />
                  </TableCell>
                  <TableCell className={`${tdBase} text-center`}>
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-bold text-foreground">
                      {quote.rank}
                    </span>
                  </TableCell>
                  <TableCell className={`${tdBase} min-w-0 whitespace-normal`}>
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-sm font-semibold">{quote.vendor.name}</span>
                      {quote.vendor.rating != null && (
                        <StarRating rating={quote.vendor.rating} readonly size={10} />
                      )}
                      {quote.fileUrl && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => {
                            if (quote.fileAttachmentId) {
                              window.open(`/api/emails/attachments/${quote.fileAttachmentId}/download`, "_blank");
                            } else if (quote.fileUrl) {
                              window.open(quote.fileUrl, "_blank");
                            }
                          }}
                          title={quote.fileName || "Download quote"}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                    <p className="truncate text-[11px] text-muted-foreground">{quote.vendor.email}</p>
                  </TableCell>
                  <TableCell className={`${tdBase} whitespace-normal text-right text-xs font-semibold leading-tight`}>
                    {formatTotal(quote)}
                  </TableCell>
                  <TableCell className={`${tdBase} text-center`}>
                    <div className="inline-flex flex-col items-center rounded bg-muted/60 px-2 py-1 leading-tight">
                      <span className="font-semibold text-foreground">{quote.quotedPct}%</span>
                      <span className="text-[10px] text-muted-foreground">{quote.missingCount} missing</span>
                    </div>
                  </TableCell>
                  <TableCell className={`${tdBase} truncate`}>{quote.paymentTerms || <span className="text-muted-foreground">Not given</span>}</TableCell>
                  <TableCell className={`${tdBase} truncate`}>{quote.leadTime || <span className="text-muted-foreground">Not given</span>}</TableCell>
                  <TableCell className={`${tdBase} text-center`}>
                    {isApproved ? (
                      <Badge className="h-6 border border-primary/30 bg-primary/10 px-2 text-[11px] text-primary">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Approved
                      </Badge>
                    ) : index === 0 ? (
                      <Badge className="h-6 bg-success px-2 text-[11px] text-white">
                        <Trophy className="mr-1 h-3 w-3" />
                        Lowest
                      </Badge>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">Review</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <TablePagination
        page={page}
        pageSize={pageSize}
        total={quotes.length}
        onPageChange={onPageChange}
        itemLabel="vendors"
        className="border-t px-2 py-2"
      />
    </div>
  );
}
