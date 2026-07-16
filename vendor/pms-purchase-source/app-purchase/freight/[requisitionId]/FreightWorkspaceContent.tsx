"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { usePageBootstrap } from "@/hooks/use-page-bootstrap";
import { PageReadyGate } from "@/components/page-ready/PageReadyGate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Ship, Truck } from "lucide-react";
import { FREIGHT_CHARGE_KEYS } from "@/lib/freight/constants";

interface VendorOption {
  id: string;
  name: string;
}

export function FreightWorkspaceContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const requisitionId = params.requisitionId as string;
  const parentPoId =
    searchParams.get("parentPoId") ?? searchParams.get("parentPurchaseOrderId") ?? undefined;
  const { ready, markSuccess } = usePageBootstrap();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [bundle, setBundle] = useState<{
    requisition: { requisitionNumber: string; heading: string | null; vessel: { name: string; code: string } };
    goodsPo: {
      id: string;
      poNumber: string;
      totalAmount: number | null;
      currency: string;
      quote?: { vendor: { id: string; name: string } };
      childFreightOrders?: { poNumber: string }[];
    } | null;
    declaration: {
      id: string;
      status: string;
      freightAmount: number;
      currency: string;
      freightMode: string;
      freightVendorId: string;
      notes: string | null;
      chargeBreakdown?: Record<string, number> | null;
      freightPurchaseOrder?: { poNumber: string } | null;
    } | null;
    previewFreightPoNumber: string | null;
  } | null>(null);

  const [freightVendorId, setFreightVendorId] = useState("");
  const [freightAmount, setFreightAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [freightMode, setFreightMode] = useState<"SEPARATE" | "COMBINED">("SEPARATE");
  const [notes, setNotes] = useState("");
  const [charges, setCharges] = useState<Record<string, string>>({});

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ requisitionId });
      if (parentPoId) q.set("parentPurchaseOrderId", parentPoId);
      const res = await fetch(`/api/purchase/freight/workspace?${q}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setBundle(data);
      if (data.declaration) {
        setFreightVendorId(data.declaration.freightVendorId);
        setFreightAmount(String(data.declaration.freightAmount));
        setCurrency(data.declaration.currency || "USD");
        setFreightMode(data.declaration.freightMode === "COMBINED" ? "COMBINED" : "SEPARATE");
        setNotes(data.declaration.notes || "");
        if (data.declaration.chargeBreakdown) {
          const c: Record<string, string> = {};
          for (const [k, v] of Object.entries(data.declaration.chargeBreakdown)) {
            c[k] = String(v);
          }
          setCharges(c);
        }
      } else if (data.goodsPo?.quote?.vendor?.id) {
        setFreightVendorId(data.goodsPo.quote.vendor.id);
      }
      markSuccess();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load freight workspace");
    } finally {
      setLoading(false);
    }
  }, [requisitionId, parentPoId, markSuccess]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    fetch("/api/vendors?limit=300&isActive=true", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        if (d.vendors) {
          setVendors(d.vendors.map((v: { id: string; name: string }) => ({ id: v.id, name: v.name })));
        }
      })
      .catch(() => {});
  }, []);

  const buildBreakdown = (): Record<string, number> | null => {
    const out: Record<string, number> = {};
    for (const key of FREIGHT_CHARGE_KEYS) {
      const v = parseFloat(charges[key] ?? "");
      if (!Number.isNaN(v) && v > 0) out[key] = v;
    }
    return Object.keys(out).length ? out : null;
  };

  const saveDeclaration = async (submitForApproval: boolean) => {
    if (!bundle?.goodsPo) {
      toast.error("No goods purchase order found for this requisition");
      return;
    }
    const amount = parseFloat(freightAmount);
    if (!freightVendorId || Number.isNaN(amount) || amount <= 0) {
      toast.error("Select vendor and enter a valid freight amount");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/purchase/freight/declarations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          requisitionId,
          parentPurchaseOrderId: bundle.goodsPo.id,
          freightVendorId,
          freightAmount: amount,
          currency,
          freightMode,
          notes: notes || null,
          chargeBreakdown: buildBreakdown(),
          submitForApproval,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      toast.success(submitForApproval ? "Freight approved for PO issue" : "Freight saved");
      await loadWorkspace();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const issuePo = async () => {
    if (!bundle?.declaration?.id) {
      toast.error("Save and approve freight first");
      return;
    }
    setIssuing(true);
    try {
      const res = await fetch(
        `/api/purchase/freight/declarations/${bundle.declaration.id}/issue-po`,
        { method: "POST", credentials: "include" }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Issue failed");
      toast.success(`Freight PO ${data.freightPoNumber} issued`);
      await loadWorkspace();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to issue PO");
    } finally {
      setIssuing(false);
    }
  };

  const declStatus = bundle?.declaration?.status;
  const canIssue = declStatus === "PURCHASER_APPROVED";
  const alreadyIssued = declStatus === "FRT_PO_ISSUED";

  return (
    <PageReadyGate ready={ready}>
      <div className="container mx-auto max-w-4xl space-y-6 py-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/purchase/view-pos">
              <ArrowLeft className="mr-2 h-4 w-4" />
              View POs
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold">Freight workspace</h1>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : !bundle?.goodsPo ? (
          <Alert>
            <AlertDescription>
              No goods PO found for this requisition. Issue a goods PO before managing freight.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Ship className="h-5 w-5" />
                  {bundle.requisition.requisitionNumber}
                </CardTitle>
                <CardDescription>
                  {bundle.requisition.heading} · {bundle.requisition.vessel.name} (
                  {bundle.requisition.vessel.code})
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>
                  <span className="font-medium">Goods PO:</span> {bundle.goodsPo.poNumber}
                  {bundle.goodsPo.quote?.vendor && (
                    <> · {bundle.goodsPo.quote.vendor.name}</>
                  )}
                </p>
                <p>
                  <span className="font-medium">Preview freight PO:</span>{" "}
                  <code>{bundle.previewFreightPoNumber}</code>
                </p>
                {declStatus && (
                  <Badge variant="outline">{declStatus.replace(/_/g, " ")}</Badge>
                )}
                {alreadyIssued && bundle.declaration?.freightPurchaseOrder && (
                  <p className="text-green-700">
                    Issued: {bundle.declaration.freightPurchaseOrder.poNumber}
                  </p>
                )}
              </CardContent>
            </Card>

            {!alreadyIssued && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="h-5 w-5" />
                    Freight declaration
                  </CardTitle>
                  <CardDescription>
                    Separate mode issues a child PO with suffix <code>.FRT</code>. Combined keeps
                    freight on the goods PO (informational only).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label>Freight mode</Label>
                      <Select
                        value={freightMode}
                        onValueChange={(v) => setFreightMode(v as "SEPARATE" | "COMBINED")}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SEPARATE">Separate (.FRT PO)</SelectItem>
                          <SelectItem value="COMBINED">Combined (in goods PO)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Freight vendor</Label>
                      <Select value={freightVendorId} onValueChange={setFreightVendorId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select vendor" />
                        </SelectTrigger>
                        <SelectContent>
                          {vendors.map((v) => (
                            <SelectItem key={v.id} value={v.id}>
                              {v.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Freight amount</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={freightAmount}
                        onChange={(e) => setFreightAmount(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>Currency</Label>
                      <Input value={currency} onChange={(e) => setCurrency(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {FREIGHT_CHARGE_KEYS.map((key) => (
                      <div key={key}>
                        <Label className="capitalize">{key.replace(/([A-Z])/g, " $1")}</Label>
                        <Input
                          type="number"
                          min="0"
                          value={charges[key] ?? ""}
                          onChange={(e) =>
                            setCharges((prev) => ({ ...prev, [key]: e.target.value }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" disabled={saving} onClick={() => saveDeclaration(false)}>
                      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Save draft
                    </Button>
                    <Button disabled={saving} onClick={() => saveDeclaration(true)}>
                      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Approve for PO issue
                    </Button>
                    {canIssue && freightMode === "SEPARATE" && (
                      <Button variant="default" disabled={issuing} onClick={() => issuePo()}>
                        {issuing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Issue {bundle.previewFreightPoNumber}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {alreadyIssued && (
              <Button onClick={() => router.push("/purchase/freight-approvals")}>
                View freight PO approvals
              </Button>
            )}
          </>
        )}
      </div>
    </PageReadyGate>
  );
}
