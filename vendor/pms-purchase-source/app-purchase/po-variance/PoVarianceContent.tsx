"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronDown, ChevronRight, Scale } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { TableSerialHead, TableSerialCell } from "@/components/ui/table-serial-column";
import { usePurchaseOrdersHubOptional } from "@/components/purchase/purchase-orders-hub-context";
import { hubPrimaryVesselId } from "@/lib/purchase/purchase-orders-hub";
import { PURCHASE_ORDERS_HUB_PATH, PURCHASE_ORDERS_HUB_TABS } from "@/lib/purchase/purchase-orders-hub";

type VarianceLine = {
  lineKey?: string;
  itemName?: string;
  qtyOrdered?: number;
  qtyReceived?: number;
  qtyVariance?: number;
  unitPrice?: number;
  poLineAmount?: number;
  receivedLineAmount?: number;
  lineAmountVariance?: number;
  lineRemark?: string;
};

type VarianceSnapshot = {
  currency?: string;
  poHeaderTotal?: number;
  sumPoLineAmount?: number;
  sumReceivedLineAmount?: number;
  amountVarianceByLines?: number;
  amountVarianceVsPoHeader?: number;
  lines?: VarianceLine[];
};

type PoVarianceRow = {
  id: string;
  vesselId: string;
  vesselName: string | null;
  poNumber: string;
  requisitionId: string;
  requisitionNumber: string | null;
  currency: string;
  crewReceiptStatus: string | null;
  crewReceiptAt: string | null;
  receiptAmountVariance: number | null;
  variance: VarianceSnapshot | null;
};

function formatMoney(currency: string, value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD" }).format(
      value
    );
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

export type PoVarianceContentProps = {
  embedded?: boolean;
};

export function PoVarianceContent({ embedded = false }: PoVarianceContentProps) {
  const hub = usePurchaseOrdersHubOptional();
  const [vesselId, setVesselId] = useState<string>("all");
  const [rows, setRows] = useState<PoVarianceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (embedded && hub) {
      setVesselId(hubPrimaryVesselId(hub.filters));
    }
  }, [embedded, hub, hub?.filters]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (vesselId && vesselId !== "all") params.set("vesselId", vesselId);
      const res = await fetch(`/api/purchase/po-variance?${params.toString()}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setRows(data.rows ?? []);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load";
      toast.error(msg);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [vesselId]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className={embedded ? "space-y-4" : "container mx-auto space-y-6 py-6"}>
      {!embedded && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <Scale className="h-7 w-7 text-muted-foreground" aria-hidden />
              PO variance (vessel receipts)
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Quantities and amounts recorded on board vs issued PO lines (from web onboard receipt
              and synced <code className="rounded bg-muted px-1 py-0.5 text-xs">purchase_orders_offline</code>).
            </p>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href={`${PURCHASE_ORDERS_HUB_PATH}?tab=${PURCHASE_ORDERS_HUB_TABS.view}`}>
              View purchase orders
            </Link>
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Variance rows</CardTitle>
          <CardDescription>
            {loading ? "Loading…" : `${rows.length} record(s) with quantity or amount variance.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center py-12 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No variance records. Lines where received qty differs from ordered PO qty appear here
              after onboard receipt confirmation.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableSerialHead />
                  <TableHead className="w-10" />
                  <TableHead>Vessel</TableHead>
                  <TableHead>PO</TableHead>
                  <TableHead>Requisition</TableHead>
                  <TableHead>Receipt</TableHead>
                  <TableHead className="text-right">Line amount variance</TableHead>
                  <TableHead className="text-right">vs PO header</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, rowIdx) => {
                  const v = r.variance;
                  const cur = v?.currency || r.currency || "USD";
                  const lineVar = v?.amountVarianceByLines;
                  const hdrVar = v?.amountVarianceVsPoHeader;
                  const open = !!expanded[r.id];
                  return (
                    <React.Fragment key={r.id}>
                      <TableRow className="align-middle">
                        <TableSerialCell serialNo={rowIdx + 1} />
                        <TableCell className="p-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => toggle(r.id)}
                            aria-expanded={open}
                          >
                            {open ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="text-sm">{r.vesselName || r.vesselId}</TableCell>
                        <TableCell className="font-mono text-sm">{r.poNumber}</TableCell>
                        <TableCell className="text-sm">
                          <span className="font-mono text-xs">
                            {r.requisitionNumber || r.requisitionId}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            {r.crewReceiptStatus ? (
                              <Badge variant="secondary" className="w-fit text-xs">
                                {r.crewReceiptStatus.replace(/_/g, " ")}
                              </Badge>
                            ) : null}
                            <span className="text-xs text-muted-foreground">
                              {r.crewReceiptAt
                                ? format(new Date(r.crewReceiptAt), "yyyy-MM-dd HH:mm")
                                : "—"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          {formatMoney(cur, lineVar ?? r.receiptAmountVariance ?? undefined)}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {formatMoney(cur, hdrVar)}
                        </TableCell>
                      </TableRow>
                      {open && v?.lines && v.lines.length > 0 ? (
                        <TableRow>
                          <TableSerialCell serialNo={1} />
                          <TableCell colSpan={8} className="bg-muted/30 p-0">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableSerialHead />
                                  <TableHead>Item</TableHead>
                                  <TableHead className="text-right">Qty PO</TableHead>
                                  <TableHead className="text-right">Qty recv</TableHead>
                                  <TableHead className="text-right">Δ Qty</TableHead>
                                  <TableHead className="text-right">Unit</TableHead>
                                  <TableHead className="text-right">PO line $</TableHead>
                                  <TableHead className="text-right">Received $</TableHead>
                                  <TableHead className="text-right">Δ $</TableHead>
                                  <TableHead>Remark</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {v.lines.map((ln, i) => (
                                  <TableRow key={ln.lineKey || i}>
                                    <TableSerialCell serialNo={i + 1} />
                                    <TableCell className="max-w-[220px] truncate text-xs">
                                      {ln.itemName}
                                    </TableCell>
                                    <TableCell className="text-right text-xs">{ln.qtyOrdered}</TableCell>
                                    <TableCell className="text-right text-xs">{ln.qtyReceived}</TableCell>
                                    <TableCell className="text-right text-xs">{ln.qtyVariance}</TableCell>
                                    <TableCell className="text-right text-xs">{ln.unitPrice}</TableCell>
                                    <TableCell className="text-right text-xs">
                                      {formatMoney(cur, ln.poLineAmount)}
                                    </TableCell>
                                    <TableCell className="text-right text-xs">
                                      {formatMoney(cur, ln.receivedLineAmount)}
                                    </TableCell>
                                    <TableCell className="text-right text-xs font-medium">
                                      {formatMoney(cur, ln.lineAmountVariance)}
                                    </TableCell>
                                    <TableCell className="text-xs">
                                      {(ln.lineRemark || "").replace(/_/g, " ") || "—"}
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
