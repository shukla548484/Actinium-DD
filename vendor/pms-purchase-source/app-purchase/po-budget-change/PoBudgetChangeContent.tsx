"use client";

import { useCallback, useEffect, useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { BudgetClassificationBadge } from "@/components/purchase/BudgetClassificationBadge";
import type { PoBudgetChangeListRow } from "@/lib/purchase/po-budget-change.service";
import { TableSerialHead, TableSerialCell } from "@/components/ui/table-serial-column";

export type PoBudgetChangeContentProps = {
  embedded?: boolean;
};

function statusBadge(status: string) {
  switch (status) {
    case "PENDING":
      return <Badge className="bg-amber-100 text-amber-950 hover:bg-amber-100">Pending approval</Badge>;
    case "APPROVED":
      return <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Approved</Badge>;
    case "REJECTED":
      return <Badge variant="destructive">Rejected</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export function PoBudgetChangeContent({ embedded = false }: PoBudgetChangeContentProps) {
  const { ready, markSuccess } = usePageBootstrap();
  const [rows, setRows] = useState<PoBudgetChangeListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [canApprove, setCanApprove] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [actingId, setActingId] = useState<string | null>(null);
  const [reviewDialog, setReviewDialog] = useState<{
    id: string;
    action: "approve" | "reject";
    poNumber: string;
  } | null>(null);
  const [reviewComments, setReviewComments] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/purchase/po-budget-change?${params.toString()}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setRows(data.requests ?? []);
      setCanApprove(Boolean(data.canApprove));
      markSuccess();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [markSuccess, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const submitReview = async () => {
    if (!reviewDialog) return;
    setActingId(reviewDialog.id);
    try {
      const endpoint =
        reviewDialog.action === "approve"
          ? `/api/purchase/po-budget-change/${reviewDialog.id}/approve`
          : `/api/purchase/po-budget-change/${reviewDialog.id}/reject`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reviewComments: reviewComments.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      toast.success(
        reviewDialog.action === "approve"
          ? "Budget classification change approved"
          : "Budget change request rejected"
      );
      setReviewDialog(null);
      setReviewComments("");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setActingId(null);
    }
  };

  const pendingCount = rows.filter((r) => r.status === "PENDING").length;

  return (
    <PageReadyGate ready={ready}>
      <div className={embedded ? "" : "mx-auto w-[95%] max-w-[1400px] py-4"}>
        {!embedded ? (
          <div className="mb-6">
            <h1 className="text-2xl font-bold">PO budget classification change</h1>
            <p className="mt-1 text-muted-foreground">
              Request or approve changes between Budgeted and Un-Budgeted after invoice upload.
              Approvers (access levels 44–48) align the PO, requisition, and invoice on approval.
            </p>
          </div>
        ) : null}

        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Budget change requests</CardTitle>
              <CardDescription>
                {canApprove
                  ? `${pendingCount} pending for your review`
                  : "Submitted requests await approval from levels 44–48"}
              </CardDescription>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading…
              </div>
            ) : rows.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No budget change requests found.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableSerialHead />
                    <TableHead>PO / Requisition</TableHead>
                    <TableHead>Vessel</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Change</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Requested</TableHead>
                    {canApprove ? <TableHead className="text-right">Actions</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, index) => (
                    <TableRow key={row.id}>
                      <TableSerialCell serialNo={index + 1} />
                      <TableCell>
                        <div className="font-medium">{row.poNumber}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.requisitionNumber} — {row.requisitionHeading}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.vessel.name}
                        <span className="text-muted-foreground"> ({row.vessel.code})</span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {row.invoiceNumber ?? "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <BudgetClassificationBadge
                            isBudgeted={row.currentIsBudgeted}
                            size="sm"
                          />
                          <span className="text-muted-foreground">→</span>
                          <BudgetClassificationBadge
                            isBudgeted={row.requestedIsBudgeted}
                            size="sm"
                          />
                        </div>
                        {row.reason ? (
                          <p className="mt-1 max-w-xs text-xs text-muted-foreground">{row.reason}</p>
                        ) : null}
                      </TableCell>
                      <TableCell>{statusBadge(row.status)}</TableCell>
                      <TableCell className="text-sm">
                        <div>{row.requestedBy.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(row.requestedAt), "dd MMM yyyy HH:mm")}
                        </div>
                      </TableCell>
                      {canApprove ? (
                        <TableCell className="text-right">
                          {row.status === "PENDING" ? (
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={actingId === row.id}
                                onClick={() => {
                                  setReviewComments("");
                                  setReviewDialog({
                                    id: row.id,
                                    action: "reject",
                                    poNumber: row.poNumber,
                                  });
                                }}
                              >
                                <XCircle className="mr-1 h-4 w-4" />
                                Reject
                              </Button>
                              <Button
                                size="sm"
                                disabled={actingId === row.id}
                                onClick={() => {
                                  setReviewComments("");
                                  setReviewDialog({
                                    id: row.id,
                                    action: "approve",
                                    poNumber: row.poNumber,
                                  });
                                }}
                              >
                                {actingId === row.id ? (
                                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                                ) : (
                                  <CheckCircle className="mr-1 h-4 w-4" />
                                )}
                                Approve
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={reviewDialog != null} onOpenChange={(open) => !open && setReviewDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {reviewDialog?.action === "approve" ? "Approve" : "Reject"} budget change
              </DialogTitle>
              <DialogDescription>
                PO {reviewDialog?.poNumber} — PO, requisition, and active invoices will align to the
                requested classification when approved.
              </DialogDescription>
            </DialogHeader>
            <div>
              <Label htmlFor="review-comments">Comments (optional)</Label>
              <Textarea
                id="review-comments"
                value={reviewComments}
                onChange={(e) => setReviewComments(e.target.value)}
                className="mt-2 min-h-[80px]"
                placeholder="Reason for approval or rejection"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReviewDialog(null)}>
                Cancel
              </Button>
              <Button
                variant={reviewDialog?.action === "reject" ? "destructive" : "default"}
                onClick={() => void submitReview()}
                disabled={actingId != null}
              >
                Confirm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PageReadyGate>
  );
}
