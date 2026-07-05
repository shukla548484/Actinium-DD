"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LabeledSelect } from "@/components/ui/LabeledSelect";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DdInvoiceDto } from "@/lib/db/superintendent/invoices";

const STATUS_ITEMS = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "verified", label: "Verified" },
  { value: "approved", label: "Approved" },
  { value: "paid", label: "Paid" },
  { value: "rejected", label: "Rejected" },
];

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount);
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "verified" || status === "approved" || status === "paid") return "default";
  if (status === "rejected") return "destructive";
  if (status === "submitted") return "secondary";
  return "outline";
}

export function AccountsInvoicePanel() {
  const [status, setStatus] = useState("submitted");
  const [invoices, setInvoices] = useState<DdInvoiceDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (status !== "all") params.set("status", status);
      const res = await fetch(`/api/office/invoices?${params}`);
      const data = (await res.json()) as { invoices?: DdInvoiceDto[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to load invoices");
        setInvoices([]);
        return;
      }
      setInvoices(data.invoices ?? []);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateStatus(id: string, nextStatus: string) {
    setBusyId(id);
    try {
      const res = await fetch("/api/office/invoices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: nextStatus }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Update failed");
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  }

  const pendingCount = invoices.filter((i) => i.status === "submitted").length;
  const verifiedCount = invoices.filter((i) => i.status === "verified" || i.status === "approved").length;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="py-4">
            <p className="text-2xl font-semibold tabular-nums">{invoices.length}</p>
            <p className="text-sm text-muted-foreground">Invoices in view</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-2xl font-semibold tabular-nums">{pendingCount}</p>
            <p className="text-sm text-muted-foreground">Awaiting verification</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <p className="text-2xl font-semibold tabular-nums">{verifiedCount}</p>
            <p className="text-sm text-muted-foreground">Verified / approved</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 py-4">
          <div className="min-w-[180px] space-y-2">
            <p className="text-sm font-medium">Status filter</p>
            <LabeledSelect
              items={STATUS_ITEMS}
              value={status}
              onValueChange={(v) => setStatus(v || "all")}
              className="w-full"
            />
          </div>
        </CardContent>
      </Card>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading invoices…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice no.</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Verified</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No invoices match this filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell>{inv.invoiceNumber ?? inv.id.slice(0, 8)}</TableCell>
                      <TableCell>{inv.supplier ?? "—"}</TableCell>
                      <TableCell className="tabular-nums">
                        {formatMoney(inv.amount, inv.currency)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(inv.status)}>{inv.status}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {inv.verifiedBy ?? "—"}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        {inv.status === "submitted" ? (
                          <>
                            <Button
                              size="sm"
                              disabled={busyId === inv.id}
                              onClick={() => void updateStatus(inv.id, "verified")}
                            >
                              Verify
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busyId === inv.id}
                              onClick={() => void updateStatus(inv.id, "rejected")}
                            >
                              Reject
                            </Button>
                          </>
                        ) : inv.status === "verified" ? (
                          <Button
                            size="sm"
                            disabled={busyId === inv.id}
                            onClick={() => void updateStatus(inv.id, "approved")}
                          >
                            Approve
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
