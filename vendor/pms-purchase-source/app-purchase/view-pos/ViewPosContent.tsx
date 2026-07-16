"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { usePurchaseOrdersPaginated } from "@/hooks/usePurchaseOrdersPaginated";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, Loader2, FileText, Search, MoreHorizontal, MessageSquare, Ban, Edit, UserPlus, Calendar as CalendarIcon, Truck } from "lucide-react";
import { TablePagination } from "@/components/ui/table-pagination";
import { format } from "date-fns";
import { toast } from "sonner";
import { useVessels } from "@/hooks/useStaticData";
import { PurchaseOrderDetailsModal } from "@/components/PurchaseOrderDetailsModal";
import { RequisitionDetailsModal } from "@/components/RequisitionDetailsModal";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ClearableInput,
  FilterFieldShell,
  filterTriggerClearPadding,
} from "@/components/ui/clearable-input";
import { cn } from "@/lib/utils";
import { TABLE_PAGE_SIZE_OPTIONS } from "@/lib/table-page-size";
import { TableSerialHead, TableSerialCell } from "@/components/ui/table-serial-column";
import {
  PO_WORKFLOW_STATUS_LABELS,
  PurchaseOrderWorkflowStatus,
  poWorkflowStatusLabel,
} from "@/lib/types/purchase-order-workflow";
import { usePurchaseOrdersHubOptional } from "@/components/purchase/purchase-orders-hub-context";
import { hubPrimaryVesselId } from "@/lib/purchase/purchase-orders-hub";
import { buildPurchaseOrdersListParams } from "@/lib/purchase-orders-list-query";

interface PurchaseOrder {
  id: string;
  poNumber: string;
  poType?: string;
  parentPoNumber?: string | null;
  dateOfIssue: string | null;
  totalAmount: number | null;
  currency: string;
  status: string;
  workflowStatus?: string | null;
  completionStatus: string;
  createdAt: string | null;
  requisition: {
    id: string;
    requisitionNumber: string;
    heading: string | null;
    vessel: { id: string; name: string; code: string } | null;
  } | null;
  quote: {
    quoteNumber: string | null;
    vendor: { id: string; name: string };
  } | null;
}

/** Standard table sizes plus 200 for large PO lists. */
const PAGINATION_OPTIONS = [...TABLE_PAGE_SIZE_OPTIONS, 200] as const;

export type ViewPosContentProps = {
  embedded?: boolean;
};

export function ViewPosContent({ embedded = false }: ViewPosContentProps = {}) {
  const searchParams = useSearchParams();
  const hub = usePurchaseOrdersHubOptional();
  const queryClient = useQueryClient();
  const fromNotification = searchParams.get("from") === "notification";
  const poFromUrl = searchParams.get("po")?.trim() || "";
  const purchaseOrderIdFromUrl = searchParams.get("purchaseOrderId")?.trim() || "";
  const { data: vessels = [] } = useVessels({ limit: 200, isActive: true });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [workflowStatusFilter, setWorkflowStatusFilter] = useState<string>("all");
  const [poTypeFilter, setPoTypeFilter] = useState<string>("all");
  const [vesselId, setVesselId] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [searchKeyword, setSearchKeyword] = useState<string>("");
  const [searchInput, setSearchInput] = useState<string>("");
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailsModalPoId, setDetailsModalPoId] = useState<string | null>(null);
  const [detailsModalInitialTab, setDetailsModalInitialTab] = useState<string>("details");
  const [requisitionModalOpen, setRequisitionModalOpen] = useState(false);
  const [requisitionModalId, setRequisitionModalId] = useState<string | null>(null);
  const taskDeepLinkAppliedRef = useRef(false);

  useEffect(() => {
    if (taskDeepLinkAppliedRef.current) return;
    const poSearch = poFromUrl || purchaseOrderIdFromUrl;
    if (!poSearch) return;
    setSearchInput(poSearch);
    setSearchKeyword(poSearch);
    taskDeepLinkAppliedRef.current = true;
    if (purchaseOrderIdFromUrl) {
      setDetailsModalPoId(purchaseOrderIdFromUrl);
      setDetailsModalOpen(true);
    }
  }, [poFromUrl, purchaseOrderIdFromUrl]);

  useEffect(() => {
    if (!embedded || !hub) return;
    const f = hub.filters;
    setVesselId(hubPrimaryVesselId(f));
    setWorkflowStatusFilter(f.workflowStatus);
    setStatusFilter(f.legacyStatus);
    setPoTypeFilter(f.poType);
    const keyword = f.searchKeyword || f.poNumber || f.requisitionNumber || "";
    setSearchInput(keyword);
    setSearchKeyword(keyword);
    setDateFrom(f.startDate ? new Date(f.startDate) : undefined);
    setDateTo(f.endDate ? new Date(f.endDate) : undefined);
    setCurrentPage(1);
  }, [
    embedded,
    hub,
    hub?.filters.vesselIds.join(","),
    hub?.filters.poNumber,
    hub?.filters.requisitionNumber,
    hub?.filters.vendorIds.join(","),
    hub?.filters.startDate,
    hub?.filters.endDate,
    hub?.filters.workflowStatus,
    hub?.filters.legacyStatus,
    hub?.filters.poType,
    hub?.filters.searchKeyword,
  ]);

  const listFilters = useMemo(
    () => ({
      page: currentPage,
      limit: itemsPerPage,
      statusFilter,
      workflowStatusFilter,
      poTypeFilter,
      vesselId,
      dateFrom,
      dateTo,
      searchKeyword,
    }),
    [currentPage, itemsPerPage, statusFilter, workflowStatusFilter, poTypeFilter, vesselId, dateFrom, dateTo, searchKeyword]
  );

  const {
    data: listData,
    isFetching,
    isError,
    error: listError,
  } = usePurchaseOrdersPaginated(listFilters, true);

  const purchaseOrders = (listData?.purchaseOrders ?? []) as PurchaseOrder[];
  const totalCount = listData?.count ?? 0;
  const totalUsdAll = Number(listData?.totals?.totalUsd) || 0;
  const accessLevel = listData?.accessLevel ?? 0;
  const loading = isFetching && purchaseOrders.length === 0;
  const error = isError
    ? listError instanceof Error
      ? listError.message
      : "Failed to load purchase orders"
    : null;
  const [exportingExcel, setExportingExcel] = useState(false);

  const refreshList = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["purchase-orders-list"] });
  }, [queryClient]);

  useEffect(() => {
    if (!isError) return;
    toast.error(error ?? "Failed to load purchase orders");
  }, [isError, error]);

  const openDetailsModal = (poId: string, tab: string) => {
    setDetailsModalPoId(poId);
    setDetailsModalInitialTab(tab);
    setDetailsModalOpen(true);
  };

  const handleDownloadPO = async (poId: string, poNumber: string) => {
    try {
      const res = await fetch(`/api/purchase-orders/${poId}/pdf`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (data.signedUrl) {
          window.open(data.signedUrl, "_blank");
          toast.success("Purchase order opened in new tab");
        } else {
          toast.error("PDF not available");
        }
      } else {
        toast.error("Failed to open purchase order");
      }
    } catch {
      toast.error("Failed to open purchase order");
    }
  };

  const handleViewRequisition = (requisitionId: string) => {
    setRequisitionModalId(requisitionId);
    setRequisitionModalOpen(true);
  };

  const downloadExcel = async () => {
    if (totalCount === 0) {
      toast.info("No data to download");
      return;
    }
    try {
      setExportingExcel(true);
      const params = buildPurchaseOrdersListParams({
        page: 1,
        limit: itemsPerPage,
        statusFilter,
        workflowStatusFilter,
        poTypeFilter,
        vesselId,
        dateFrom,
        dateTo,
        searchKeyword,
      });
      const res = await fetch(`/api/purchase-orders/view-pos/export?${params.toString()}`, {
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
      a.download = `purchase_orders_${new Date().toISOString().slice(0, 10)}.xlsx`;
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

  const formatCurrency = (amount: number | null, currency: string) => {
    if (amount == null) return "—";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD" }).format(
      Number(amount)
    );
  };

  const getWorkflowBadgeVariant = (
    workflowStatus: string | null | undefined
  ): "default" | "secondary" | "destructive" => {
    if (workflowStatus === PurchaseOrderWorkflowStatus.CANCELLED) return "destructive";
    if (workflowStatus === PurchaseOrderWorkflowStatus.PO_SENT) return "default";
    if (workflowStatus === PurchaseOrderWorkflowStatus.PO_CONFIRMED) return "default";
    return "secondary";
  };

  const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" => {
    if (status === "CANCELLED") return "destructive";
    if (status === "ACTIVE") return "default";
    return "secondary";
  };

  const getCompletionBadgeVariant = (status: string): "default" | "secondary" | "destructive" => {
    if (status === "COMPLETED") return "default";
    if (status === "OPEN") return "secondary";
    return "secondary";
  };

  const applySearch = () => {
    setSearchKeyword(searchInput);
    setCurrentPage(1);
  };

  return (
    <div className={embedded ? "space-y-4" : "w-[98%] max-w-[98vw] mx-auto p-6 space-y-6"}>
      <div className="flex flex-col gap-4">
        {!embedded && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            {fromNotification && (
              <Link
                href="/notifications"
                className="text-sm text-primary hover:underline font-medium inline-flex mb-2"
              >
                ← Return to Notifications
              </Link>
            )}
            <h1 className="text-3xl font-bold text-foreground">Purchase Orders</h1>
            <p className="text-foreground mt-1">View purchase orders across the approval workflow</p>
          </div>
          {totalCount > 0 && (
            <Button onClick={downloadExcel} variant="outline" size="default" disabled={exportingExcel}>
              {exportingExcel ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Download Excel
            </Button>
          )}
        </div>
        )}

        {embedded && fromNotification && (
          <Link
            href="/notifications"
            className="text-sm text-primary hover:underline font-medium inline-flex"
          >
            ← Return to Notifications
          </Link>
        )}

        {embedded && totalCount > 0 && (
          <div className="flex justify-end">
            <Button onClick={downloadExcel} variant="outline" size="default" disabled={exportingExcel}>
              {exportingExcel ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Download Excel
            </Button>
          </div>
        )}

        {!embedded && (
        <Card variant="filter">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filters</CardTitle>
            <CardDescription>Vessel, date range (created), and keyword search (Requisition number, PO number, Requisition heading)</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Vessel</label>
              <FilterFieldShell
                showClear={vesselId !== "all"}
                onClear={() => {
                  setVesselId("all");
                  setCurrentPage(1);
                }}
                hasDropdownChevron
                className="max-w-none w-[200px]"
              >
                <Select
                  value={vesselId}
                  onValueChange={(v) => {
                    setVesselId(v);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger
                    className={cn(
                      "w-[200px]",
                      filterTriggerClearPadding(vesselId !== "all", true)
                    )}
                    width="vessel"
                  >
                    <SelectValue placeholder="All vessels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All vessels</SelectItem>
                    {vessels.map((v: { id: string; name: string; code?: string }) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name} {v.code ? `(${v.code})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterFieldShell>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Date Range</label>
              <FilterFieldShell
                showClear={Boolean(dateFrom || dateTo)}
                onClear={() => {
                  setDateFrom(undefined);
                  setDateTo(undefined);
                  setCurrentPage(1);
                }}
                className="max-w-none min-w-[240px]"
              >
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full min-w-[240px] justify-start text-left font-normal",
                      filterTriggerClearPadding(Boolean(dateFrom || dateTo))
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom && dateTo ? (
                      <>
                        {format(dateFrom, "MMM d, yyyy")} - {format(dateTo, "MMM d, yyyy")}
                      </>
                    ) : dateFrom ? (
                      format(dateFrom, "MMM d, yyyy")
                    ) : (
                      <span className="text-muted-foreground">Select date range</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={{
                      from: dateFrom,
                      to: dateTo,
                    }}
                    onSelect={(range: { from: Date | undefined; to: Date | undefined } | undefined) => {
                      setDateFrom(range?.from);
                      setDateTo(range?.to);
                      setCurrentPage(1);
                    }}
                    numberOfMonths={2}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              </FilterFieldShell>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Workflow</label>
              <FilterFieldShell
                showClear={workflowStatusFilter !== "all"}
                onClear={() => {
                  setWorkflowStatusFilter("all");
                  setCurrentPage(1);
                }}
                hasDropdownChevron
                className="max-w-none w-[180px]"
              >
                <Select
                  value={workflowStatusFilter}
                  onValueChange={(v) => {
                    setWorkflowStatusFilter(v);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger
                    className={cn(
                      "w-[180px]",
                      filterTriggerClearPadding(workflowStatusFilter !== "all", true)
                    )}
                  >
                    <SelectValue placeholder="Workflow" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All stages</SelectItem>
                    {Object.entries(PO_WORKFLOW_STATUS_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FilterFieldShell>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Legacy status</label>
              <FilterFieldShell
                showClear={statusFilter !== "all"}
                onClear={() => {
                  setStatusFilter("all");
                  setCurrentPage(1);
                }}
                hasDropdownChevron
                className="max-w-none w-[140px]"
              >
                <Select
                  value={statusFilter}
                  onValueChange={(v) => {
                    setStatusFilter(v);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger
                    className={cn(
                      "w-[140px]",
                      filterTriggerClearPadding(statusFilter !== "all", true)
                    )}
                  >
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="ACTIVE">Issued</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </FilterFieldShell>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">PO type</label>
              <FilterFieldShell
                showClear={poTypeFilter !== "all"}
                onClear={() => {
                  setPoTypeFilter("all");
                  setCurrentPage(1);
                }}
                hasDropdownChevron
                className="max-w-none w-[140px]"
              >
                <Select
                  value={poTypeFilter}
                  onValueChange={(v) => {
                    setPoTypeFilter(v);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger
                    className={cn(
                      "w-[140px]",
                      filterTriggerClearPadding(poTypeFilter !== "all", true)
                    )}
                  >
                    <SelectValue placeholder="PO type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    <SelectItem value="GOODS">Goods</SelectItem>
                    <SelectItem value="FREIGHT">Freight (.FRT)</SelectItem>
                  </SelectContent>
                </Select>
              </FilterFieldShell>
            </div>
            <div className="space-y-1.5 flex-1 min-w-[200px]">
              <label className="text-sm font-medium text-foreground">Search (PO number, Req number, Req heading)</label>
              <div className="flex gap-2">
                <ClearableInput
                  placeholder="Keywords..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applySearch()}
                  onClear={() => {
                    setSearchInput("");
                    setSearchKeyword("");
                    setCurrentPage(1);
                  }}
                  className="max-w-sm h-9 text-sm"
                />
                <Button type="button" variant="secondary" size="default" onClick={applySearch}>
                  <Search className="h-4 w-4 mr-1" />
                  Search
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        )}
      </div>

      {error && (
        <Card className="border-border bg-destructive">
          <CardContent className="p-4">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {loading && purchaseOrders.length === 0 && !error && (
        <Card>
          <CardContent className="p-12 text-center">
            <Loader2 className="h-12 w-12 mx-auto text-muted-foreground mb-4 animate-spin" />
            <p className="text-foreground">Loading purchase orders...</p>
          </CardContent>
        </Card>
      )}

      {!loading && purchaseOrders.length === 0 && !error && (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-foreground">No purchase orders found.</p>
          </CardContent>
        </Card>
      )}

      {purchaseOrders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Purchase Orders ({totalCount})</CardTitle>
            <CardDescription>
              Click PO Number to open PDF; click Requisition Number to view details in a popup
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                      <TableSerialHead />
                    <TableHead>PO Number</TableHead>
                    <TableHead>Date of Issue</TableHead>
                    <TableHead>Requisition Number</TableHead>
                    <TableHead>Requisition Heading</TableHead>
                    <TableHead>Vessel</TableHead>
                    <TableHead>Vessel Code</TableHead>
                    <TableHead>Quote Number</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead className="text-right">Total Amount</TableHead>
                    <TableHead>Workflow</TableHead>
                    <TableHead>Completion</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchaseOrders.map((po, index) => (
                    <TableRow key={po.id}>
                      <TableSerialCell serialNo={index + 1} />
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => handleDownloadPO(po.id, po.poNumber)}
                          className="font-medium text-info hover:underline"
                        >
                          {po.poNumber}
                        </button>
                        {po.poType === "FREIGHT" && (
                          <Badge variant="secondary" className="ml-2">
                            FRT
                          </Badge>
                        )}
                        {po.parentPoNumber && (
                          <span className="text-muted-foreground block text-xs">
                            Parent: {po.parentPoNumber}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {po.dateOfIssue
                          ? new Date(po.dateOfIssue).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {po.requisition ? (
                          <button
                            type="button"
                            onClick={() => handleViewRequisition(po.requisition!.id)}
                            className="text-info hover:underline"
                          >
                            {po.requisition.requisitionNumber}
                          </button>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {po.requisition?.heading ?? "—"}
                      </TableCell>
                      <TableCell>{po.requisition?.vessel?.name ?? "—"}</TableCell>
                      <TableCell>{po.requisition?.vessel?.code ?? "—"}</TableCell>
                      <TableCell>{po.quote?.quoteNumber ?? "—"}</TableCell>
                      <TableCell>{po.quote?.vendor?.name ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(po.totalAmount, po.currency)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getWorkflowBadgeVariant(po.workflowStatus)}>
                          {poWorkflowStatusLabel(po.workflowStatus)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getCompletionBadgeVariant(po.completionStatus)}>
                          {po.completionStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {po.createdAt
                          ? new Date(po.createdAt).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openDetailsModal(po.id, "details")}>
                              <FileText className="mr-2 h-4 w-4" />
                              View details
                            </DropdownMenuItem>
                            {po.poType !== "FREIGHT" && po.requisition && (
                              <DropdownMenuItem asChild>
                                <Link
                                  href={`/purchase/freight/${po.requisition.id}?parentPoId=${po.id}`}
                                >
                                  <Truck className="mr-2 h-4 w-4" />
                                  Freight workspace
                                </Link>
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => openDetailsModal(po.id, "chat")}>
                              <MessageSquare className="mr-2 h-4 w-4" />
                              Chat with vendor
                            </DropdownMenuItem>
                            {po.status === "ACTIVE" &&
                              po.workflowStatus !== PurchaseOrderWorkflowStatus.PO_SENT && (
                              <>
                                <DropdownMenuItem onClick={() => openDetailsModal(po.id, "details")}>
                                  <Edit className="mr-2 h-4 w-4" />
                                  Modify PO
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openDetailsModal(po.id, "details")}>
                                  <Ban className="mr-2 h-4 w-4" />
                                  Cancel PO
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openDetailsModal(po.id, "agent-requests")}>
                                  <UserPlus className="mr-2 h-4 w-4" />
                                  Add Agent Details
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                {totalCount > 0 ? (
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={9} className="font-semibold">
                        Total ({totalCount} filtered PO{totalCount === 1 ? "" : "s"})
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: "USD",
                        }).format(totalUsdAll)}
                      </TableCell>
                      <TableCell colSpan={4} className="text-xs text-muted-foreground">
                        Sum converted to USD
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                ) : null}
              </Table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t pt-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Rows per page:</span>
                <Select
                  value={String(itemsPerPage)}
                  onValueChange={(v) => {
                    setItemsPerPage(Number(v));
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGINATION_OPTIONS.map((n) => (
                      <SelectItem key={n} value={String(n)}>
                        {n}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <TablePagination
                className="mt-0"
                page={currentPage}
                pageSize={itemsPerPage}
                total={totalCount}
                itemLabel="purchase orders"
                disabled={loading}
                onPageChange={setCurrentPage}
              />
            </div>
          </CardContent>
        </Card>
      )}

      <PurchaseOrderDetailsModal
        isOpen={detailsModalOpen}
        onClose={() => {
          setDetailsModalOpen(false);
          setDetailsModalPoId(null);
        }}
        purchaseOrderId={detailsModalPoId}
        currentUserAccessLevel={accessLevel}
        onRefresh={refreshList}
        initialTab={detailsModalInitialTab}
      />

      <RequisitionDetailsModal
        isOpen={requisitionModalOpen}
        onClose={() => {
          setRequisitionModalOpen(false);
          setRequisitionModalId(null);
        }}
        requisitionId={requisitionModalId}
        currentUserAccessLevel={accessLevel}
      />
    </div>
  );
}
