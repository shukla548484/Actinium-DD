"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MessageSquareText, AlertTriangle } from "lucide-react";
import { canManagePurchaseClarifications } from "@/lib/procurement/clarification-notifications-access";

type ClarificationRow = {
  id: string;
  status: string;
  requestType: string;
  message?: string;
  requestedAt: string;
  responseDueAt?: string;
  isOverdue?: boolean;
  requisition?: { id: string; requisitionNumber: string; heading?: string };
  requisitionItem?: { itemName: string } | null;
  vendor?: { name: string } | null;
};

export default function PendingClarificationsPageWrapper() {
  return (
    <Suspense fallback={<div className="container py-12 text-muted-foreground">Loading…</div>}>
      <PendingClarificationsPage />
    </Suspense>
  );
}

function PendingClarificationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requisitionIdFilter = searchParams.get("requisitionId") || undefined;
  const [items, setItems] = useState<ClarificationRow[]>([]);
  const [view, setView] = useState<"office" | "vessel">("office");
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const profile = await fetch("/api/profile/basic", { credentials: "include" });
      if (profile.ok) {
        const p = await profile.json();
        const level = p.user?.designationAccessLevel;
        const isOffice = canManagePurchaseClarifications(level);
        const isVessel = level >= 6 && level <= 25;
        if (!isOffice && !isVessel) {
          setAccessDenied(true);
          return;
        }
        setView(isOffice ? "office" : "vessel");
      }

      const params = new URLSearchParams({ pending: "1" });
      if (requisitionIdFilter) params.set("requisitionId", requisitionIdFilter);
      const res = await fetch(`/api/rfq-clarifications?${params}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setItems(data.clarifications || []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [requisitionIdFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  if (accessDenied) {
    return (
      <div className="container max-w-3xl py-12 text-center">
        <p>You do not have access to RFQ clarifications.</p>
        <Button className="mt-4" onClick={() => router.push("/purchase/view-requisitions")}>
          Back to requisitions
        </Button>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquareText className="h-5 w-5" />
            Pending RFQ clarifications
          </CardTitle>
          <CardDescription>
            {view === "vessel"
              ? "Information requests awaiting your response (quoting party identity hidden)."
              : "Open vendor information requests across requisitions."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open clarification requests.</p>
          ) : (
            <div className="space-y-3">
              {items.map((row) => (
                <div
                  key={row.id}
                  className="flex flex-col gap-2 rounded-lg border p-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{row.requestType.replace(/_/g, " ")}</Badge>
                      {row.isOverdue && (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" /> Overdue
                        </Badge>
                      )}
                      {row.requisition && (
                        <span className="text-sm font-medium">{row.requisition.requisitionNumber}</span>
                      )}
                    </div>
                    {row.requisitionItem && (
                      <p className="text-sm text-muted-foreground">{row.requisitionItem.itemName}</p>
                    )}
                    {view === "office" && row.vendor?.name && (
                      <p className="text-xs text-muted-foreground">Vendor: {row.vendor.name}</p>
                    )}
                    {row.message && <p className="text-sm line-clamp-2">{row.message}</p>}
                    <p className="text-xs text-muted-foreground">
                      Requested {new Date(row.requestedAt).toLocaleString()}
                      {row.responseDueAt &&
                        ` · Due ${new Date(row.responseDueAt).toLocaleDateString()}`}
                    </p>
                  </div>
                  {row.requisition && (
                    <Button variant="outline" size="sm" asChild className="shrink-0">
                      <Link
                        href={`/purchase/requisitions/${row.requisition.id}/clarifications/${row.id}?view=${view}`}
                      >
                        Respond
                      </Link>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
