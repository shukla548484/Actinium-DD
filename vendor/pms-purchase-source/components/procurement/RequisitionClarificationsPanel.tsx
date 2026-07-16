"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageSquareText, AlertTriangle } from "lucide-react";

type ClarificationRow = {
  id: string;
  status: string;
  requestType: string;
  message?: string;
  vesselVisibleMessage?: string;
  requestedAt: string;
  responseDueAt?: string;
  isOverdue?: boolean;
  answeredAt?: string | null;
  requisitionItem?: { id: string; itemName: string } | null;
  vendor?: { name: string } | null;
};

export function RequisitionClarificationsPanel({
  requisitionId,
  view = "office",
}: {
  requisitionId: string;
  view?: "office" | "vessel";
}) {
  const [items, setItems] = useState<ClarificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/rfq-clarifications?requisitionId=${encodeURIComponent(requisitionId)}`,
        { credentials: "include" }
      );
      const data = await res.json();
      if (res.ok) setItems(data.clarifications || []);
    } finally {
      setLoading(false);
    }
  }, [requisitionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const displayMessage = (row: ClarificationRow) =>
    view === "vessel" ? row.vesselVisibleMessage || row.message : row.message;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquareText className="h-5 w-5" />
          RFQ clarifications
        </CardTitle>
        <CardDescription>
          {view === "vessel"
            ? "Information requests from quoting parties (vendor identity hidden)."
            : "Vendor information requests and vessel responses for this requisition."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading clarifications…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No clarification requests yet.</p>
        ) : (
          <div className="space-y-3">
            {items.map((row) => (
              <div
                key={row.id}
                className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{row.requestType.replace(/_/g, " ")}</Badge>
                    <Badge>{row.status}</Badge>
                    {row.status === "OPEN" && row.isOverdue && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" /> Overdue
                      </Badge>
                    )}
                    {row.requisitionItem && (
                      <span className="text-xs text-muted-foreground truncate">
                        {row.requisitionItem.itemName}
                      </span>
                    )}
                    {view === "office" && row.vendor?.name && (
                      <span className="text-xs text-muted-foreground">{row.vendor.name}</span>
                    )}
                  </div>
                  {displayMessage(row) && (
                    <p className="text-sm line-clamp-2">{displayMessage(row)}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Requested {new Date(row.requestedAt).toLocaleString()}
                    {row.responseDueAt && row.status === "OPEN"
                      ? ` · Due ${new Date(row.responseDueAt).toLocaleDateString()}`
                      : ""}
                    {row.answeredAt
                      ? ` · Answered ${new Date(row.answeredAt).toLocaleString()}`
                      : ""}
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild className="shrink-0">
                  <Link
                    href={`/purchase/requisitions/${requisitionId}/clarifications/${row.id}?view=${view}`}
                  >
                    Open
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
