"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { TableCard } from "@/components/layout/TableCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";
import type { PurchaseVendorListRow } from "@/lib/purchase/types";

export function PurchaseVendorsPanel() {
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<PurchaseVendorListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      params.set("take", "50");
      const res = await fetch(`/api/purchase/vendors?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load vendors");
      setRows(data.rows as PurchaseVendorListRow[]);
      setTotal(data.total as number);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PageShell size="wide">
      <PageHeader
        title="Vendor Management"
        description="Approved and pending purchase vendors."
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <p className="mb-1 text-xs text-muted-foreground">Search</p>
          <Input
            placeholder="Code, name, email, country…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button variant="outline" onClick={() => void load()}>
          Refresh
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <TableCard title="Vendors" description={`${total} vendor(s)`}>
        {loading ? (
          <div className="p-6">
            <ActiniumLoadingState label="Loading vendors…" size="sm" />
          </div>
        ) : rows.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            No vendors yet. Run <code className="text-xs">npx tsx scripts/seed-purchase-sample.ts</code> to
            load sample vendors.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Currency</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.vendorCode}</TableCell>
                  <TableCell>
                    <div>{row.name}</div>
                    {row.serviceTypes.length > 0 ? (
                      <div className="text-xs text-muted-foreground">{row.serviceTypes.join(", ")}</div>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm">{row.primaryEmail}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {[row.city, row.country].filter(Boolean).join(", ")}
                  </TableCell>
                  <TableCell>
                    {row.isBlacklisted ? (
                      <Badge variant="destructive">Blacklisted</Badge>
                    ) : (
                      <Badge variant={row.isActive ? "default" : "outline"}>
                        {row.verificationStatus}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{row.preferredCurrency}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TableCard>
    </PageShell>
  );
}
