"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { TableCard } from "@/components/layout/TableCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import type { PurchaseRequisitionListRow } from "@/lib/purchase/types";

type VesselOption = { id: string; code: string; name: string };

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "NOT_READY", label: "Not ready / draft" },
  { value: "NEW_REQ", label: "New" },
  { value: "REQ_APPROVED", label: "Approved" },
  { value: "SENT_FOR_QUOTE", label: "Sent for quote" },
  { value: "QUOTE_RECEIVED", label: "Quote received" },
  { value: "QUOTE_APPROVED", label: "Quote approved" },
  { value: "QUOTE_CONFIRMED_PO_SENT", label: "PO sent" },
  { value: "CANCELLED", label: "Cancelled" },
];

function statusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  if (status === "CANCELLED" || status === "REQ_RETURNED") return "destructive";
  if (status === "REQ_APPROVED" || status === "QUOTE_APPROVED" || status === "QUOTE_CONFIRMED_PO_SENT") {
    return "default";
  }
  if (status === "NOT_READY") return "outline";
  return "secondary";
}

export function PurchaseRequisitionsPanel({
  initialStatus,
  title = "Requisitions",
  description = "Office purchase requisitions — approve, RFQ, quote, and issue PO.",
}: {
  initialStatus?: string;
  title?: string;
  description?: string;
}) {
  const [vessels, setVessels] = useState<VesselOption[]>([]);
  const [vesselId, setVesselId] = useState("all");
  const [status, setStatus] = useState(initialStatus ?? "");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<PurchaseRequisitionListRow[]>([]);
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
      if (status) params.set("status", status);
      if (search.trim()) params.set("q", search.trim());
      params.set("take", "50");
      const res = await fetch(`/api/purchase/requisitions?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load requisitions");
      setRows(data.rows as PurchaseRequisitionListRow[]);
      setTotal(data.total as number);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [vesselId, status, search]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PageShell size="wide">
      <PageHeader
        title={title}
        description={description}
        actions={
          <Button render={<Link href="/purchase/create-requisition" />} nativeButton={false}>
            Create requisition
          </Button>
        }
      />

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
        <div className="min-w-48">
          <p className="mb-1 text-xs text-muted-foreground">Status</p>
          <SearchableSelect items={STATUS_OPTIONS} value={status} onValueChange={setStatus} />
        </div>
        <div className="min-w-56 flex-1">
          <p className="mb-1 text-xs text-muted-foreground">Search</p>
          <Input
            placeholder="Number or heading…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button variant="outline" onClick={() => void load()}>
          Refresh
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <TableCard title="Requisition queue" description={`${total} requisition(s)`}>
        {loading ? (
          <div className="p-6">
            <ActiniumLoadingState label="Loading requisitions…" size="sm" />
          </div>
        ) : rows.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            No requisitions yet. Create one from{" "}
            <Link href="/purchase/create-requisition" className="text-primary hover:underline">
              Create requisition
            </Link>
            , or seed sample data for testing.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Heading</TableHead>
                <TableHead>Vessel</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Created</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.requisitionNumber}</TableCell>
                  <TableCell>
                    <div>{row.heading}</div>
                    <div className="text-xs text-muted-foreground">{row.createdByName}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.vesselName}
                    <span className="block text-xs">{row.vesselCode}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{row.requisitionType}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                  </TableCell>
                  <TableCell className="tabular-nums">{row.itemCount}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(row.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      render={<Link href={`/purchase/view-requisitions?focus=${row.id}`} />}
                      nativeButton={false}
                    >
                      Open
                    </Button>
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
