"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { TableCard } from "@/components/layout/TableCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";
import type { PurchaseInvoiceListRow } from "@/lib/purchase/types";

type VesselOption = { id: string; code: string; name: string };

export function PurchaseInvoicesPanel() {
  const [vessels, setVessels] = useState<VesselOption[]>([]);
  const [vesselId, setVesselId] = useState("all");
  const [rows, setRows] = useState<PurchaseInvoiceListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/purchase/vessels")
      .then((r) => (r.ok ? r.json() : { vessels: [] }))
      .then((data) => setVessels((data.vessels as VesselOption[]) ?? []))
      .catch(() => setVessels([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (vesselId !== "all") params.set("vesselId", vesselId);
      params.set("take", "50");
      const res = await fetch(`/api/purchase/invoices?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load invoices");
      setRows(data.rows as PurchaseInvoiceListRow[]);
      setTotal(data.total as number);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [vesselId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PageShell size="wide">
      <PageHeader title="Invoices" description="Vendor invoices linked to purchase orders." />

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-52">
          <p className="mb-1 text-xs text-muted-foreground">Vessel</p>
          <SearchableSelect
            items={[
              { value: "all", label: "All vessels" },
              ...vessels.map((v) => ({
                value: v.id,
                label: `${v.name} (${v.code})`,
                searchText: `${v.name} ${v.code}`,
              })),
            ]}
            value={vesselId}
            onValueChange={setVesselId}
          />
        </div>
        <Button variant="outline" onClick={() => void load()}>
          Refresh
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <TableCard title="Invoice queue" description={`${total} invoice(s)`}>
        {loading ? (
          <div className="p-6">
            <ActiniumLoadingState label="Loading invoices…" size="sm" />
          </div>
        ) : rows.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No invoices yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>PO / Req</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.invoiceNumber}</TableCell>
                  <TableCell>{row.vendorName}</TableCell>
                  <TableCell className="text-muted-foreground">
                    <div>{row.poNumber ?? "—"}</div>
                    <div className="text-xs">{row.requisitionNumber}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{row.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.currency} {row.invoiceAmount.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(row.invoiceDate).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableCard>
    </PageShell>
  );
}
