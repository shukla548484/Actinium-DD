"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

type VesselOption = { id: string; code: string; name: string };

const REQ_TYPES = ["STR", "SPR", "GLY", "PNT", "REP", "SER", "CTM", "PRO", "BNK", "LUB", "FCL", "OTR", "CHE"];

export function CreateRequisitionPanel() {
  const router = useRouter();
  const [vessels, setVessels] = useState<VesselOption[]>([]);
  const [vesselId, setVesselId] = useState("");
  const [heading, setHeading] = useState("");
  const [description, setDescription] = useState("");
  const [requisitionType, setRequisitionType] = useState("SPR");
  const [portOfSupply, setPortOfSupply] = useState("");
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("pcs");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/purchase/vessels")
      .then((r) => (r.ok ? r.json() : { vessels: [] }))
      .then((data) => {
        const list = (data.vessels as VesselOption[]) ?? [];
        setVessels(list);
        if (list[0]) setVesselId(list[0].id);
      })
      .catch(() => setVessels([]));
  }, []);

  async function handleSubmit(asDraft: boolean) {
    if (!vesselId || !heading.trim()) {
      setError("Vessel and heading are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/purchase/requisitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vesselId,
          heading: heading.trim(),
          description: description.trim() || null,
          requisitionType,
          portOfSupply: portOfSupply.trim() || null,
          asDraft,
          items: itemName.trim()
            ? [{ itemName: itemName.trim(), quantity: Number(quantity) || 1, unit }]
            : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Create failed");
      router.push("/purchase/view-requisitions");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell size="wide">
      <PageHeader
        title="Create Requisition"
        description="Raise a new office purchase requisition for a vessel."
        actions={
          <Button variant="outline" render={<Link href="/purchase/view-requisitions" />} nativeButton={false}>
            Back to list
          </Button>
        }
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Header</CardTitle>
          <CardDescription>Vessel, type, and requisition details</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label>Vessel</Label>
            <SearchableSelect
              items={vessels.map((v) => ({
                value: v.id,
                label: `${v.name} (${v.code})`,
                searchText: `${v.name} ${v.code}`,
              }))}
              value={vesselId}
              onValueChange={setVesselId}
              placeholder="Select vessel…"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="heading">Heading</Label>
            <Input id="heading" value={heading} onChange={(e) => setHeading(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Type</Label>
            <SearchableSelect
              items={REQ_TYPES.map((t) => ({ value: t, label: t }))}
              value={requisitionType}
              onValueChange={setRequisitionType}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="port">Port of supply</Label>
            <Input id="port" value={portOfSupply} onChange={(e) => setPortOfSupply(e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="desc">Description</Label>
            <Textarea id="desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">First line item</CardTitle>
          <CardDescription>Optional — add more lines after create in a follow-up update</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="item">Item name</Label>
            <Input id="item" value={itemName} onChange={(e) => setItemName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="qty">Qty</Label>
              <Input id="qty" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="unit">Unit</Label>
              <Input id="unit" value={unit} onChange={(e) => setUnit(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void handleSubmit(true)} disabled={saving}>
          {saving ? "Saving…" : "Save as draft"}
        </Button>
        <Button variant="secondary" onClick={() => void handleSubmit(false)} disabled={saving}>
          Submit for approval
        </Button>
      </div>
    </PageShell>
  );
}
