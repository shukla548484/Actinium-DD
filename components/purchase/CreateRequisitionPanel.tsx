"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  FileText,
  Package,
  Paperclip,
  Plus,
  Ship,
  Trash2,
  User,
} from "lucide-react";
import { ImpaItemSearchFields } from "@/components/purchase/ImpaItemSearchFields";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  listL2BudgetSelectOptions,
  type BudgetScope,
} from "@/lib/purchase/budgetCodes";
import {
  budgetCodeForType,
  budgetLabelForCode,
  PURCHASE_REQ_PURPOSE_LABELS,
  PURCHASE_REQ_TYPE_LABELS,
  PURCHASE_REQ_TYPES,
  PURCHASE_REQ_URGENCY_LABELS,
  PURCHASE_SUB_CATEGORIES,
} from "@/lib/purchase/requisitionLabels";
import { cn } from "@/lib/utils";

type VesselOption = { id: string; code: string; name: string };
type StoreOption = { id: string; name: string; code: string };
type MachineryOption = {
  id: string;
  name: string;
  code: string | null;
  make: string | null;
  model: string | null;
  serialNumber: string | null;
  machineryType: string | null;
};

type LineItem = {
  key: string;
  itemName: string;
  impaCode: string;
  quantity: string;
  unit: string;
  remarks: string;
  files: File[];
};

function newLineItem(): LineItem {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    itemName: "",
    impaCode: "",
    quantity: "1",
    unit: "pcs",
    remarks: "",
    files: [],
  };
}

function previewReqNumber(vesselCode: string | undefined, type: string) {
  if (!vesselCode || !type) return null;
  const code = vesselCode.replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase() || "GEN";
  const yy = String(new Date().getFullYear()).slice(-2);
  return `0.${code}.${type}.${yy}.????`;
}

async function downloadBlob(res: Response, fallbackName: string) {
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition");
  const match = cd?.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? fallbackName;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function CreateRequisitionPanel() {
  const router = useRouter();
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [vessels, setVessels] = useState<VesselOption[]>([]);
  const [vesselId, setVesselId] = useState("");
  const [requisitionType, setRequisitionType] = useState("");
  const [subCategoryCode, setSubCategoryCode] = useState("");
  const [storeLocationId, setStoreLocationId] = useState("");
  const [storeLocations, setStoreLocations] = useState<StoreOption[]>([]);
  const [machineryId, setMachineryId] = useState("");
  const [machineryOptions, setMachineryOptions] = useState<MachineryOption[]>([]);
  const [spareManualMachineryName, setSpareManualMachineryName] = useState("");
  const [heading, setHeading] = useState("");
  const [manualReqNumber, setManualReqNumber] = useState("");
  const [requisitionPurpose, setRequisitionPurpose] = useState("ROUTINE_MAINTENANCE");
  const [priority, setPriority] = useState("NORMAL");
  const [portOfSupply, setPortOfSupply] = useState("");
  const [description, setDescription] = useState("");
  const [portAgentDetails, setPortAgentDetails] = useState("");
  const [items, setItems] = useState<LineItem[]>([newLineItem()]);
  const [budgetCodeOverride, setBudgetCodeOverride] = useState("");
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

  const selectedVessel = vessels.find((v) => v.id === vesselId);
  const setupReady = Boolean(vesselId && requisitionType);
  const subOptions = PURCHASE_SUB_CATEGORIES[requisitionType] ?? [];
  const budgetScope: BudgetScope = requisitionPurpose === "DRY_DOCK" ? "DRY_DOCK" : "NORMAL";
  const autoBudgetCode = useMemo(
    () => budgetCodeForType(requisitionType, subCategoryCode, requisitionPurpose),
    [requisitionType, subCategoryCode, requisitionPurpose],
  );
  const resolvedBudgetCode = budgetCodeOverride || autoBudgetCode;
  const budgetLabel = useMemo(
    () => budgetLabelForCode(resolvedBudgetCode),
    [resolvedBudgetCode],
  );
  const budgetSelectOptions = useMemo(
    () => listL2BudgetSelectOptions(budgetScope),
    [budgetScope],
  );
  const reqPreview = previewReqNumber(selectedVessel?.code, requisitionType);
  const isSpr = requisitionType === "SPR";
  const isStr = requisitionType === "STR";

  useEffect(() => {
    setSubCategoryCode("");
    setStoreLocationId("");
    setMachineryId("");
    setSpareManualMachineryName("");
    setBudgetCodeOverride("");
  }, [requisitionType]);

  useEffect(() => {
    setBudgetCodeOverride("");
  }, [requisitionPurpose]);

  useEffect(() => {
    if (!vesselId || !isStr) {
      setStoreLocations([]);
      return;
    }
    void fetch(`/api/purchase/store-locations?vesselId=${encodeURIComponent(vesselId)}`)
      .then((r) => (r.ok ? r.json() : { storeLocations: [] }))
      .then((data) => setStoreLocations((data.storeLocations as StoreOption[]) ?? []))
      .catch(() => setStoreLocations([]));
  }, [vesselId, isStr]);

  useEffect(() => {
    if (!vesselId || !isSpr) {
      setMachineryOptions([]);
      return;
    }
    void fetch(`/api/purchase/machinery?vesselId=${encodeURIComponent(vesselId)}&limit=1000`)
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((data) => {
        const list = Array.isArray(data.data) ? (data.data as MachineryOption[]) : [];
        setMachineryOptions(list);
      })
      .catch(() => setMachineryOptions([]));
  }, [vesselId, isSpr]);

  function updateItem(key: string, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addItem() {
    setItems((prev) => [...prev, newLineItem()]);
  }

  function removeItem(key: string) {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((row) => row.key !== key)));
  }

  async function handleDownloadTemplate() {
    if (!vesselId || !requisitionType) return;
    setError(null);
    try {
      const res = await fetch("/api/purchase/requisitions/template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vesselId,
          requisitionType,
          heading: heading.trim() || undefined,
          description: description.trim() || undefined,
          portOfSupply: portOfSupply.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Template download failed");
      }
      await downloadBlob(res, `Quote_Request_Template_${requisitionType}.xlsx`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Template download failed");
    }
  }

  async function handleDownloadBudgetTemplate() {
    setError(null);
    try {
      const res = await fetch("/api/purchase/requisition-subcategories/template");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Budget template download failed");
      }
      await downloadBlob(res, "requisition-subcategories-budget-template.xlsx");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Budget template download failed");
    }
  }

  async function handleSubmit(asDraft: boolean) {
    if (!vesselId || !requisitionType) {
      setError("Select vessel and requisition type.");
      return;
    }
    if (!heading.trim()) {
      setError("Heading is required.");
      return;
    }
    if (isSpr && !machineryId && !spareManualMachineryName.trim()) {
      setError("Select machinery or enter a manual machinery name for spare requisitions.");
      return;
    }

    const payloadItems = items
      .filter((i) => i.itemName.trim())
      .map((i) => ({
        itemName: i.itemName.trim(),
        partNumber: i.impaCode.trim() || null,
        quantity: Number(i.quantity) || 1,
        unit: i.unit.trim() || "pcs",
        remarks: i.remarks.trim() || null,
        machineryAssetId: machineryId || null,
      }));
    if (!asDraft && payloadItems.length === 0) {
      setError("Add at least one line item before creating the requisition.");
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
          portAgentDetails: portAgentDetails.trim() || null,
          manualReqNumber: manualReqNumber.trim() || null,
          requisitionPurpose,
          priority,
          subCategoryCode: subCategoryCode || null,
          budgetCode: resolvedBudgetCode || null,
          storeLocationId: isStr ? storeLocationId || null : null,
          machineryAssetId: isSpr ? machineryId || null : null,
          spareManualMachineryName: isSpr ? spareManualMachineryName.trim() || null : null,
          asDraft,
          items: payloadItems,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Create failed");

      const createdItems = (data.items as Array<{ id: string; sortOrder: number }>) ?? [];
      const namedItems = items.filter((i) => i.itemName.trim());
      for (let i = 0; i < namedItems.length; i++) {
        const line = namedItems[i]!;
        const created = createdItems[i];
        if (!created || line.files.length === 0) continue;
        for (const file of line.files) {
          const form = new FormData();
          form.append("file", file);
          const up = await fetch(
            `/api/purchase/requisitions/${data.id}/items/${created.id}/attachments`,
            { method: "POST", body: form },
          );
          if (!up.ok) {
            const err = await up.json().catch(() => ({}));
            throw new Error(err.error ?? `Failed to upload attachment for ${line.itemName}`);
          }
        }
      }

      router.push(asDraft ? "/purchase/draft-requisitions" : "/purchase/view-requisitions");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <PageShell size="full">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Create Requisition</h1>
        <p className="text-sm text-muted-foreground">
          Create new requisitions for your vessel. Select vessel and type to begin.
        </p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Card>
        <Tabs defaultValue="setup" className="gap-0">
          <CardHeader className="flex flex-nowrap items-center gap-3 overflow-x-auto max-[480px]:flex-wrap">
            <CardTitle className="flex shrink-0 items-center gap-2 text-lg whitespace-nowrap">
              <Ship className="size-4 text-muted-foreground" />
              Requisition Information
            </CardTitle>
            <div className="flex shrink-0 items-center gap-2 rounded-md bg-muted/50 px-2.5 py-1.5 text-xs whitespace-nowrap">
              <span className="text-muted-foreground">Req. Number</span>
              {reqPreview ? (
                <span className="flex items-center gap-1 font-mono font-semibold text-foreground">
                  <FileText className="size-3.5 text-emerald-600" />
                  {reqPreview}
                </span>
              ) : (
                <span className="text-muted-foreground">Select vessel & type</span>
              )}
            </div>
            {setupReady ? (
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="whitespace-nowrap"
                  onClick={() => void handleDownloadTemplate()}
                >
                  Download Excel Template
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="whitespace-nowrap"
                  onClick={() => void handleDownloadBudgetTemplate()}
                >
                  Sub-categories & budgets (Excel)
                </Button>
              </div>
            ) : null}
            <TabsList className="ml-auto h-8 w-fit shrink-0">
              <TabsTrigger value="setup" className="gap-1.5 whitespace-nowrap">
                <Ship className="size-3.5" />
                Requisition Setup
              </TabsTrigger>
              <TabsTrigger value="agent" className="gap-1.5 whitespace-nowrap">
                <User className="size-3.5" />
                Port Agent Details
              </TabsTrigger>
            </TabsList>
          </CardHeader>
          <CardContent>
            <TabsContent value="setup" className="mt-0">
              <div className="grid gap-3 lg:grid-cols-3">
                <div className="rounded-md border bg-muted/10 p-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Setup
                  </p>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label>
                        Vessel <span className="text-destructive">*</span>
                      </Label>
                      <SearchableSelect
                        items={vessels.map((v) => ({
                          value: v.id,
                          label: `${v.name} (${v.code})`,
                          searchText: `${v.name} ${v.code}`,
                        }))}
                        value={vesselId}
                        onValueChange={setVesselId}
                        placeholder="Select vessel"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>
                        Type <span className="text-destructive">*</span>
                      </Label>
                      <SearchableSelect
                        items={PURCHASE_REQ_TYPES.map((t) => ({
                          value: t,
                          label: PURCHASE_REQ_TYPE_LABELS[t] ?? t,
                          searchText: `${t} ${PURCHASE_REQ_TYPE_LABELS[t] ?? ""}`,
                        }))}
                        value={requisitionType}
                        onValueChange={setRequisitionType}
                        placeholder={vesselId ? "Select type" : "Select vessel first"}
                        disabled={!vesselId}
                      />
                    </div>
                    {requisitionType && subOptions.length > 0 && requisitionType !== "CTM" ? (
                      <div className="space-y-1">
                        <Label>Sub category</Label>
                        <SearchableSelect
                          items={subOptions.map((s) => ({
                            value: s.code,
                            label: `${s.code} — ${s.name}`,
                            searchText: `${s.code} ${s.name} ${s.budgetCode}`,
                          }))}
                          value={subCategoryCode}
                          onValueChange={(v) => {
                            setSubCategoryCode(v);
                            setBudgetCodeOverride("");
                          }}
                          placeholder="Select sub category"
                        />
                      </div>
                    ) : null}
                    {isStr ? (
                      <div className="space-y-1">
                        <Label>Store location</Label>
                        <SearchableSelect
                          items={storeLocations.map((s) => ({
                            value: s.id,
                            label: `${s.code} — ${s.name}`,
                            searchText: `${s.code} ${s.name}`,
                          }))}
                          value={storeLocationId}
                          onValueChange={setStoreLocationId}
                          placeholder={
                            storeLocations.length
                              ? "Select physical store (optional)"
                              : "No store locations seeded yet"
                          }
                        />
                      </div>
                    ) : null}
                    {isSpr ? (
                      <>
                        <div className="space-y-1">
                          <Label>
                            Machinery <span className="text-destructive">*</span>
                          </Label>
                          <SearchableSelect
                            items={machineryOptions.map((m) => ({
                              value: m.id,
                              label: [
                                m.name,
                                m.make || m.model ? `(${[m.make, m.model].filter(Boolean).join(" ")})` : null,
                                m.machineryType ? `· ${m.machineryType}` : null,
                              ]
                                .filter(Boolean)
                                .join(" "),
                              searchText: `${m.name} ${m.make ?? ""} ${m.model ?? ""} ${m.serialNumber ?? ""} ${m.machineryType ?? ""}`,
                            }))}
                            value={machineryId}
                            onValueChange={(v) => {
                              setMachineryId(v);
                              if (v) setSpareManualMachineryName("");
                            }}
                            placeholder={
                              machineryOptions.length
                                ? "Select machinery"
                                : "No machinery on vessel — use manual name"
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="manual-mach">Manual machinery name</Label>
                          <Input
                            id="manual-mach"
                            value={spareManualMachineryName}
                            onChange={(e) => {
                              setSpareManualMachineryName(e.target.value);
                              if (e.target.value.trim()) setMachineryId("");
                            }}
                            placeholder="If machinery is not in register"
                          />
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="rounded-md border bg-muted/10 p-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Requisition Details
                  </p>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="heading">
                        Heading <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="heading"
                        value={heading}
                        onChange={(e) => setHeading(e.target.value)}
                        placeholder="Enter requisition heading"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="manual-req">Manual Req Number</Label>
                      <Input
                        id="manual-req"
                        value={manualReqNumber}
                        onChange={(e) => setManualReqNumber(e.target.value)}
                        placeholder="Optional manual reference"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Purpose</Label>
                      <SearchableSelect
                        items={Object.entries(PURCHASE_REQ_PURPOSE_LABELS).map(([value, label]) => ({
                          value,
                          label,
                        }))}
                        value={requisitionPurpose}
                        onValueChange={setRequisitionPurpose}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Urgency</Label>
                      <SearchableSelect
                        items={Object.entries(PURCHASE_REQ_URGENCY_LABELS).map(([value, label]) => ({
                          value,
                          label,
                        }))}
                        value={priority}
                        onValueChange={setPriority}
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-md border bg-muted/10 p-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Budget & Delivery
                  </p>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label>Budget Code (auto)</Label>
                      <div className="min-h-9 truncate rounded-md border bg-muted/40 px-3 py-2 text-sm">
                        {budgetLabel ? (
                          <>
                            <span className="font-mono text-xs text-muted-foreground">
                              {resolvedBudgetCode}
                            </span>
                            <span className="mx-1.5 text-muted-foreground">·</span>
                            <span>{budgetLabel}</span>
                          </>
                        ) : requisitionType ? (
                          <span className="text-muted-foreground">
                            No automatic mapping for this type yet — pick a code below
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Select requisition type</span>
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>Budget Code (manual override)</Label>
                      <SearchableSelect
                        items={[
                          {
                            value: "",
                            label: autoBudgetCode
                              ? `Use auto (${autoBudgetCode})`
                              : "Use auto mapping",
                            searchText: "auto default",
                          },
                          ...budgetSelectOptions,
                        ]}
                        value={budgetCodeOverride}
                        onValueChange={setBudgetCodeOverride}
                        placeholder={
                          budgetScope === "DRY_DOCK"
                            ? "Optional dry-dock L2 override"
                            : "Optional L2 budget override"
                        }
                        disabled={!requisitionType}
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Master catalog: {budgetScope === "DRY_DOCK" ? "Dry Dock" : "Purchase (NORMAL)"}{" "}
                        Level 2 codes from all-budget-codes.xlsx
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="port">Supply Port</Label>
                      <Input
                        id="port"
                        value={portOfSupply}
                        onChange={(e) => setPortOfSupply(e.target.value)}
                        placeholder="Enter supply port"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="desc">Description</Label>
                      <Textarea
                        id="desc"
                        rows={3}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Enter requisition description"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="agent" className="mt-0">
              <div className="space-y-2">
                <Label htmlFor="port-agent">Port Agent Details</Label>
                <Textarea
                  id="port-agent"
                  rows={10}
                  value={portAgentDetails}
                  onChange={(e) => setPortAgentDetails(e.target.value)}
                  placeholder="Enter port agent details, contact information, and other relevant information"
                />
              </div>
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      {setupReady ? (
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Package className="size-4" />
                Requisition Items
              </CardTitle>
              <CardDescription>
                Add all items required for this requisition. At least one item is required.
                Attachments: PDF / JPEG / PNG (uploaded after create).
              </CardDescription>
            </div>
            <Button type="button" size="sm" onClick={addItem}>
              <Plus className="size-4" />
              Add Item
            </Button>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="px-2 py-2 font-medium w-10">#</th>
                  <th className="px-2 py-2 font-medium min-w-[200px]">
                    Item Name <span className="text-destructive">*</span>
                  </th>
                  <th className="px-2 py-2 font-medium w-36">IMPA Code</th>
                  <th className="px-2 py-2 font-medium w-24">
                    Qty <span className="text-destructive">*</span>
                  </th>
                  <th className="px-2 py-2 font-medium w-28">
                    Unit <span className="text-destructive">*</span>
                  </th>
                  <th className="px-2 py-2 font-medium w-40">Remarks</th>
                  <th className="px-2 py-2 font-medium w-12 text-center">Att.</th>
                  <th className="px-2 py-2 font-medium w-14 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row, index) => (
                  <tr key={row.key} className="border-b align-top">
                    <td className="px-2 py-2 tabular-nums text-muted-foreground">{index + 1}</td>
                    <td className="px-2 py-2" colSpan={2}>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <ImpaItemSearchFields
                          requisitionType={requisitionType}
                          subCategoryCode={subCategoryCode}
                          itemName={row.itemName}
                          impaCode={row.impaCode}
                          onItemNameChange={(v) => updateItem(row.key, { itemName: v })}
                          onImpaCodeChange={(v) => updateItem(row.key, { impaCode: v })}
                          onSelect={(hit) =>
                            updateItem(row.key, {
                              itemName: hit.itemName,
                              impaCode: hit.impaCode,
                              unit: hit.unit || row.unit,
                            })
                          }
                        />
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        value={row.quantity}
                        onChange={(e) => updateItem(row.key, { quantity: e.target.value })}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        value={row.unit}
                        onChange={(e) => updateItem(row.key, { unit: e.target.value })}
                        placeholder="pcs, kg"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <Input
                        value={row.remarks}
                        onChange={(e) => updateItem(row.key, { remarks: e.target.value })}
                        placeholder="Remarks (optional)"
                      />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <input
                        ref={(el) => {
                          fileInputRefs.current[row.key] = el;
                        }}
                        type="file"
                        accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          const files = Array.from(e.target.files ?? []);
                          updateItem(row.key, { files: [...row.files, ...files] });
                          e.target.value = "";
                        }}
                      />
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        title={
                          row.files.length
                            ? `${row.files.length} file(s) selected`
                            : "Attach PDF / JPEG / PNG"
                        }
                        onClick={() => fileInputRefs.current[row.key]?.click()}
                        className={cn(row.files.length > 0 && "text-emerald-700")}
                      >
                        <Paperclip className="size-3.5" />
                      </Button>
                      {row.files.length > 0 ? (
                        <p className="mt-0.5 text-[10px] text-muted-foreground">{row.files.length}</p>
                      ) : null}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => removeItem(row.key)}
                        disabled={items.length <= 1}
                        className={cn(items.length <= 1 && "opacity-40")}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full border border-amber-300 bg-amber-50 text-amber-700">
              <AlertTriangle className="size-6" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">Selection Required</p>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Please select both a vessel and a requisition type from the options above to begin
                creating your requisition.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 pb-4">
        <Button variant="outline" render={<Link href="/purchase/view-requisitions" />} nativeButton={false}>
          Cancel
        </Button>
        <Button variant="secondary" onClick={() => void handleSubmit(true)} disabled={saving || !setupReady}>
          {saving ? "Saving…" : "Save as Draft"}
        </Button>
        <Button onClick={() => void handleSubmit(false)} disabled={saving || !setupReady}>
          {saving ? "Creating…" : "Create Requisition"}
        </Button>
      </div>
    </PageShell>
  );
}
