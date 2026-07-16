"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Upload, Edit, FileText, Receipt, Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { safeToNumber } from "@/lib/utils";
import { TableSerialHead, TableSerialCell } from "@/components/ui/table-serial-column";
import { tableSerialNo } from "@/lib/table-serial-column";
import { TablePagination, DEFAULT_TABLE_PAGE_SIZE, type TablePageSize } from "@/components/ui/table-pagination";
import { poListBadgeVariant, poListDisplayStatus } from "@/lib/types/purchase-order-workflow";
import { usePurchaseOrdersHub } from "@/components/purchase/purchase-orders-hub-context";
import { buildPurchaseOrdersHubQuery, PURCHASE_ORDERS_HUB_TABS } from "@/lib/purchase/purchase-orders-hub";

interface PurchaseOrderRow {
  id: string;
  poNumber: string;
  originalPdfUrl: string | null;
  vesselName: string;
  dateOfIssue: string | null;
  totalAmount: unknown;
  currency: string;
  quoteCurrency?: string;
  totalAmountUsd?: number;
  originalAmount?: number;
  status: string;
  workflowStatus: string;
  levelOneApprovedAt: string | null;
  levelTwoApprovedAt: string | null;
  levelThreeApprovedAt: string | null;
  hasInvoice: boolean;
  completionStatus: string;
  createdAt: string;
  requisition: {
    id: string;
    requisitionNumber: string;
    vesselName: string | null;
    vessel?: { id: string; name: string } | null;
  };
  quote: {
    id: string;
    vendorId: string;
    vendor: { name: string };
    currency?: string;
    deliveryNotes: { id: string }[];
  } | null;
}

function formatMoney(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function PurchaseOrdersRegistryTable({
  purchaseOrders,
  page,
  pageSize,
  totalCount,
  totalUsdAll,
}: {
  purchaseOrders: PurchaseOrderRow[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalUsdAll: number;
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableSerialHead />
            <TableHead>PO Number</TableHead>
            <TableHead>Req. Number</TableHead>
            <TableHead>Vessel</TableHead>
            <TableHead>Vendor</TableHead>
            <TableHead>Date of Issue</TableHead>
            <TableHead className="text-right">Total Amount</TableHead>
            <TableHead>Approval Status</TableHead>
            <TableHead>Completion Status</TableHead>
            <TableHead>Created At</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {purchaseOrders.map((po, index) => {
            const quoteCurrency = (po.quoteCurrency || po.quote?.currency || po.currency || "USD")
              .trim()
              .toUpperCase();
            const originalAmount =
              po.originalAmount != null
                ? po.originalAmount
                : safeToNumber(po.totalAmount);
            const usdAmount =
              po.totalAmountUsd != null
                ? po.totalAmountUsd
                : quoteCurrency === "USD"
                  ? originalAmount
                  : originalAmount;

            return (
              <TableRow key={po.id}>
                <TableSerialCell serialNo={tableSerialNo(page, pageSize, index)} />
                <TableCell className="font-medium">
                  {po.originalPdfUrl ? (
                    <Link
                      href={`/api/purchase-orders/download?fileUrl=${encodeURIComponent(po.originalPdfUrl)}`}
                      target="_blank"
                      className="text-blue-600 hover:underline"
                    >
                      {po.poNumber}
                    </Link>
                  ) : (
                    po.poNumber
                  )}
                </TableCell>
                <TableCell>
                  <Link
                    href={`/api/requisitions/${po.requisition.id}/pdf`}
                    target="_blank"
                    className="text-blue-600 hover:underline"
                  >
                    {po.requisition.requisitionNumber}
                  </Link>
                </TableCell>
                <TableCell>{po.requisition?.vesselName || po.vesselName}</TableCell>
                <TableCell>{po.quote?.vendor?.name || "N/A"}</TableCell>
                <TableCell>
                  {po.dateOfIssue ? new Date(po.dateOfIssue).toLocaleDateString() : "-"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {po.totalAmount != null ? (
                    <div className="space-y-0.5">
                      <div className="font-medium">{formatMoney(usdAmount, "USD")}</div>
                      {quoteCurrency !== "USD" ? (
                        <div className="text-xs text-muted-foreground">
                          Quote: {formatMoney(originalAmount, quoteCurrency)}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground">Quote currency: USD</div>
                      )}
                    </div>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={poListBadgeVariant(po)}>{poListDisplayStatus(po)}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{po.completionStatus}</Badge>
                </TableCell>
                <TableCell>{new Date(po.createdAt).toLocaleDateString()}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link
                          href={`/purchase/dn-status?vesselId=${po.requisition?.vessel?.id || ""}&purchaseOrderId=${po.id}&openUpload=true`}
                          className="flex items-center"
                        >
                          <Upload className="mr-2 h-4 w-4" />
                          Upload DN
                        </Link>
                      </DropdownMenuItem>
                      {po.quote?.deliveryNotes && po.quote.deliveryNotes.length > 0 && (
                        <DropdownMenuItem asChild>
                          <Link
                            href={`/purchase/dn-status?vesselId=${po.requisition?.vessel?.id || ""}&purchaseOrderId=${po.id}&edit=true`}
                            className="flex items-center"
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit DN
                          </Link>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem asChild>
                        <Link
                          href={`/purchase/invoices?vesselId=${po.requisition?.vessel?.id || ""}&purchaseOrderId=${po.id}&openUpload=true`}
                          className="flex items-center"
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          Upload Invoice
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link
                          href={`/purchase/invoices?vesselId=${po.requisition?.vessel?.id || ""}&purchaseOrderId=${po.id}&edit=true`}
                          className="flex items-center"
                        >
                          <Receipt className="mr-2 h-4 w-4" />
                          Edit Invoice
                        </Link>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
          {purchaseOrders.length === 0 && (
            <TableRow>
              <TableSerialCell serialNo={1} />
              <TableCell colSpan={11} className="text-center text-muted-foreground">
                No purchase orders found matching your criteria.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
        {totalCount > 0 ? (
          <TableFooter>
            <TableRow>
              <TableCell colSpan={6} className="font-semibold">
                Total ({totalCount} PO{totalCount === 1 ? "" : "s"})
              </TableCell>
              <TableCell className="text-right font-semibold tabular-nums">
                {formatMoney(totalUsdAll, "USD")}
              </TableCell>
              <TableCell colSpan={4} />
            </TableRow>
          </TableFooter>
        ) : null}
      </Table>
    </div>
  );
}

/** Registry tab inside Purchase Orders hub — loads via API from hub filters. */
export function PurchaseOrdersAllTab() {
  const { filters } = usePurchaseOrdersHub();
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<TablePageSize>(DEFAULT_TABLE_PAGE_SIZE);
  const [totalCount, setTotalCount] = useState(0);
  const [totalUsdAll, setTotalUsdAll] = useState(0);
  const [exportingExcel, setExportingExcel] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [filters]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = buildPurchaseOrdersHubQuery(PURCHASE_ORDERS_HUB_TABS.all, filters);
      const params = new URLSearchParams(qs);
      params.delete("tab");
      params.set("page", String(page));
      params.set("pageSize", String(pageSize));
      const res = await fetch(`/api/purchase-orders/registry?${params.toString()}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setPurchaseOrders(data.purchaseOrders ?? []);
      setTotalCount(data.pagination?.total ?? data.purchaseOrders?.length ?? 0);
      setTotalUsdAll(Number(data.totals?.totalUsd) || 0);
    } catch {
      setPurchaseOrders([]);
      setTotalCount(0);
      setTotalUsdAll(0);
    } finally {
      setLoading(false);
    }
  }, [filters, page, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  const downloadExcel = async () => {
    if (totalCount === 0) {
      toast.info("No data to download");
      return;
    }
    try {
      setExportingExcel(true);
      const qs = buildPurchaseOrdersHubQuery(PURCHASE_ORDERS_HUB_TABS.all, filters);
      const params = new URLSearchParams(qs);
      params.delete("tab");
      const res = await fetch(`/api/purchase-orders/registry/export?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to export Excel");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `po_registry_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Excel downloaded (all filtered POs)");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to export Excel");
    } finally {
      setExportingExcel(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-base">All purchase orders</CardTitle>
          <CardDescription>
            Full registry with approval status, completion, and document actions. Amounts show USD
            plus the quote currency.
          </CardDescription>
        </div>
        {totalCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => void downloadExcel()}
            disabled={exportingExcel}
          >
            {exportingExcel ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Download Excel
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex justify-center py-12 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <>
            <PurchaseOrdersRegistryTable
              purchaseOrders={purchaseOrders}
              page={page}
              pageSize={pageSize}
              totalCount={totalCount}
              totalUsdAll={totalUsdAll}
            />
            <TablePagination
              page={page}
              pageSize={pageSize}
              total={totalCount}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
              itemLabel="purchase orders"
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
