"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePageBootstrap } from "@/hooks/use-page-bootstrap";
import { PageReadyGate } from "@/components/page-ready/PageReadyGate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Truck } from "lucide-react";
import { format } from "date-fns";

type PendingRow = {
  id: string;
  freightAmount: number;
  currency: string;
  updatedAt: string;
  requisition: {
    id: string;
    requisitionNumber: string;
    heading: string | null;
    vessel: { name: string; code: string };
  };
  parentPurchaseOrder: { id: string; poNumber: string; totalAmount: number | null };
  freightVendor: { name: string };
  submittedByVendor?: { name: string } | null;
};

export type FreightPendingContentProps = {
  embedded?: boolean;
};

export function FreightPendingContent({ embedded = false }: FreightPendingContentProps = {}) {
  const { ready, markSuccess } = usePageBootstrap();
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectId, setRejectId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/purchase/freight/pending", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setRows(data.declarations ?? []);
      markSuccess();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [markSuccess]);

  useEffect(() => {
    void load();
  }, [load]);

  const approve = async (id: string) => {
    setActionId(id);
    try {
      const res = await fetch(`/api/purchase/freight/declarations/${id}/approve`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Approve failed");
      toast.success("Freight approved — you can issue the .FRT PO from the workspace");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setActionId(null);
    }
  };

  const reject = async () => {
    if (!rejectId || !rejectReason.trim()) return;
    setActionId(rejectId);
    try {
      const res = await fetch(`/api/purchase/freight/declarations/${rejectId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reject failed");
      toast.success("Freight rejected");
      setRejectOpen(false);
      setRejectReason("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reject failed");
    } finally {
      setActionId(null);
    }
  };

  return (
    <PageReadyGate ready={ready}>
      <div className={embedded ? "space-y-4" : "container mx-auto space-y-6 py-6"}>
        {!embedded && (
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Truck className="h-6 w-6" />
            Vendor freight — pending approval
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Approve vendor-submitted freight before issuing a separate <code>.FRT</code> purchase order.
          </p>
        </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Pending ({rows.length})</CardTitle>
            <CardDescription>Requires purchaser approval (access levels 32+)</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : rows.length === 0 ? (
              <p className="text-muted-foreground">No vendor freight awaiting approval.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>REQ</TableHead>
                    <TableHead>Vessel</TableHead>
                    <TableHead>Goods PO</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Link
                          className="text-primary hover:underline"
                          href={`/purchase/freight/${row.requisition.id}?parentPoId=${row.parentPurchaseOrder.id}`}
                        >
                          {row.requisition.requisitionNumber}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {row.requisition.vessel.name} ({row.requisition.vessel.code})
                      </TableCell>
                      <TableCell>{row.parentPurchaseOrder.poNumber}</TableCell>
                      <TableCell>{row.freightVendor.name}</TableCell>
                      <TableCell>
                        {row.currency} {Number(row.freightAmount).toLocaleString()}
                      </TableCell>
                      <TableCell>{format(new Date(row.updatedAt), "dd MMM yyyy")}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          size="sm"
                          disabled={actionId === row.id}
                          onClick={() => approve(row.id)}
                        >
                          {actionId === row.id && (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          )}
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setRejectId(row.id);
                            setRejectOpen(true);
                          }}
                        >
                          Reject
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject freight</DialogTitle>
              <DialogDescription>Vendor will need to resubmit.</DialogDescription>
            </DialogHeader>
            <Label>Reason</Label>
            <Textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={() => reject()}>
                Reject
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageReadyGate>
  );
}
