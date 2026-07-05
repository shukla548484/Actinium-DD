"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ProjectChecklistModulePage } from "@/components/superintendent/ProjectChecklistModulePage";
import { VesselRequisitionBankPanel } from "@/components/superintendent/VesselRequisitionBankPanel";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { fmtDate, fmtMoney } from "@/lib/superintendent/formatters";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type PoRow = {
  id: string;
  poNumber: string | null;
  supplier: string | null;
  description: string | null;
  amount: number;
  currency: string;
  status: string;
  expectedDelivery: string | null;
};

export default function ProjectProcurementPage() {
  const { id } = useParams<{ id: string }>();
  const [orders, setOrders] = useState<PoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [supplier, setSupplier] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");

  const load = useCallback(() => {
    void fetch(`/api/superintendent/purchase-orders?dryDockProjectId=${encodeURIComponent(id)}&limit=50`)
      .then((r) => r.json())
      .then((d: { items?: PoRow[] }) => setOrders(d.items ?? []))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function createPo(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/superintendent/purchase-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dryDockProjectId: id,
        supplier: supplier || null,
        description: description || null,
        amount: amount ? Number(amount) : 0,
        status: "draft",
      }),
    });
    setBusy(false);
    if (res.ok) {
      setSupplier("");
      setDescription("");
      setAmount("");
      load();
    }
  }

  async function updateStatus(poId: string, status: string) {
    await fetch(`/api/superintendent/purchase-orders/${poId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  return (
    <PageShell size="wide">
      <PageHeader
        title="Procurement"
        description="Purchase orders and procurement checklist for this project."
      />

      <div className="space-y-6">
        <VesselRequisitionBankPanel dryDockProjectId={id} />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Purchase orders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Setting a PO to <strong>issued</strong> creates an approval request in the approvals inbox.
              Required sign-off level depends on PO amount (see RBAC approval levels).
            </p>
            <form className="grid gap-3 md:grid-cols-4" onSubmit={(e) => void createPo(e)}>
              <div className="space-y-1">
                <Label>Supplier</Label>
                <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Description</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label>Amount</Label>
                <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <Button type="submit" size="sm" disabled={busy} className="md:col-span-4 w-fit">
                Add PO
              </Button>
            </form>

            {loading ? (
              <p className="text-sm text-muted-foreground">Loading purchase orders…</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO #</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expected</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No purchase orders yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    orders.map((po) => (
                      <TableRow key={po.id}>
                        <TableCell>{po.poNumber ?? "—"}</TableCell>
                        <TableCell>{po.supplier ?? "—"}</TableCell>
                        <TableCell>{po.description ?? "—"}</TableCell>
                        <TableCell>{fmtMoney(po.amount)} {po.currency}</TableCell>
                        <TableCell>
                          <Select
                            value={po.status}
                            onValueChange={(v) => v && void updateStatus(po.id, v)}
                          >
                            <SelectTrigger className="h-8 w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {["draft", "issued", "acknowledged", "in_transit", "delivered", "cancelled"].map(
                                (s) => (
                                  <SelectItem key={s} value={s}>
                                    {s.replace(/_/g, " ")}
                                  </SelectItem>
                                ),
                              )}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>{fmtDate(po.expectedDelivery)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <ProjectChecklistModulePage moduleKey="procurement" embedded />
      </div>
    </PageShell>
  );
}
