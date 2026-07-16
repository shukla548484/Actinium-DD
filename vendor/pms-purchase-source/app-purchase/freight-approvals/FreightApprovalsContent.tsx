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
import { toast } from "sonner";
import { Loader2, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { isFreightPoNumber } from "@/lib/freight/constants";

type FreightPoRow = {
  id: string;
  poNumber: string;
  totalAmount: number;
  currency: string;
  dateOfIssue: string | null;
  parentPoNumber: string | null;
  levelOneApprovedAt: string | null;
  levelTwoApprovedAt: string | null;
  levelThreeApprovedAt: string | null;
  requiresThreeApprovals: boolean;
  requisition: {
    requisitionNumber: string;
    vessel: { name: string; code: string };
  };
  vendor?: { name: string };
};

export type FreightApprovalsContentProps = {
  embedded?: boolean;
};

export function FreightApprovalsContent({ embedded = false }: FreightApprovalsContentProps = {}) {
  const { ready, markSuccess } = usePageBootstrap();
  const [rows, setRows] = useState<FreightPoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/purchase/freight-approvals", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setRows(data.purchaseOrders ?? []);
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

  const approve = async (poId: string) => {
    setApprovingId(poId);
    try {
      const res = await fetch(`/api/purchase-orders/${poId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ comments: "Freight PO approval" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Approval failed");
      toast.success("Freight PO approved");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Approval failed");
    } finally {
      setApprovingId(null);
    }
  };

  const approvalBadge = (po: FreightPoRow) => {
    if (!po.levelOneApprovedAt) return <Badge variant="outline">L1 pending</Badge>;
    if (!po.levelTwoApprovedAt) return <Badge variant="outline">L2 pending</Badge>;
    if (po.requiresThreeApprovals && !po.levelThreeApprovedAt) {
      return <Badge variant="outline">L3 pending</Badge>;
    }
    return <Badge>Complete</Badge>;
  };

  return (
    <PageReadyGate ready={ready}>
      <div className={embedded ? "space-y-4" : "container mx-auto space-y-6 py-6"}>
        {!embedded && (
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <CheckCircle className="h-6 w-6" />
            Freight PO approvals
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            <code>.FRT</code> purchase orders use the same approval thresholds as goods POs ($3k / $10k).
          </p>
        </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Awaiting your approval ({rows.length})</CardTitle>
            <CardDescription>Only POs you can approve at the current level are listed.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : rows.length === 0 ? (
              <p className="text-muted-foreground">No freight POs need your approval.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Freight PO</TableHead>
                    <TableHead>Parent PO</TableHead>
                    <TableHead>REQ / Vessel</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((po) => (
                    <TableRow key={po.id}>
                      <TableCell>
                        <code>{po.poNumber}</code>
                        {isFreightPoNumber(po.poNumber) && (
                          <Badge className="ml-2" variant="secondary">
                            FRT
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{po.parentPoNumber ?? "—"}</TableCell>
                      <TableCell>
                        {po.requisition.requisitionNumber}
                        <br />
                        <span className="text-muted-foreground text-xs">
                          {po.requisition.vessel.name}
                        </span>
                      </TableCell>
                      <TableCell>{po.vendor?.name ?? "—"}</TableCell>
                      <TableCell>
                        {po.currency} {po.totalAmount.toLocaleString()}
                      </TableCell>
                      <TableCell>{approvalBadge(po)}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/purchase/purchase-orders?tab=view&po=${encodeURIComponent(po.poNumber)}`}>
                            View
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          disabled={approvingId === po.id}
                          onClick={() => approve(po.id)}
                        >
                          {approvingId === po.id && (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                          )}
                          Approve
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </PageReadyGate>
  );
}
