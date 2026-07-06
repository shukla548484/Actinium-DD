"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LabeledSelect } from "@/components/ui/LabeledSelect";
import { equipmentSystemLabel } from "@/lib/shipAccess/crewDefectSystems";
import type { RequisitionLineInput, VesselRequisitionDto } from "@/lib/shipAccess/requisitionDto";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";
import {
  VESSEL_REQUISITION_PURPOSE_ITEMS,
  VESSEL_REQUISITION_URGENCY_ITEMS,
  VESSEL_REQUISITION_UNIT_ITEMS,
} from "@/lib/shipAccess/requisitionTypes";

type EligibleDefect = {
  id: string;
  title: string;
  equipmentSystem: string;
  equipmentLabel: string | null;
  location: string | null;
  priority: string;
};

type LineRow = RequisitionLineInput & { key: string };

type Props = {
  vesselId?: string | null;
  dryDockProjectId?: string | null;
  readOnly?: boolean;
  requisitionsApiBase?: string;
  defaultRequestedByName?: string;
  requisitionId?: string;
  initialDefectId?: string | null;
};

function emptyLine(equipmentLabel?: string | null): LineRow {
  return {
    key: crypto.randomUUID(),
    partName: "",
    partNumber: "",
    quantity: 1,
    unit: "pcs",
    urgency: "normal",
    equipmentLabel: equipmentLabel ?? null,
    remarks: "",
  };
}

export function RequisitionSubmitForm({
  vesselId,
  dryDockProjectId,
  readOnly,
  requisitionsApiBase = "/api/ship-access/requisitions",
  defaultRequestedByName = "",
  requisitionId,
  initialDefectId,
}: Props) {
  const router = useRouter();
  const [eligibleDefects, setEligibleDefects] = useState<EligibleDefect[]>([]);
  const [defectId, setDefectId] = useState(initialDefectId ?? "");
  const [purpose, setPurpose] = useState("defect_closer");
  const [requestedByName, setRequestedByName] = useState(defaultRequestedByName);
  const [lines, setLines] = useState<LineRow[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [heading, setHeading] = useState("");
  const [description, setDescription] = useState("");
  const [portOfSupply, setPortOfSupply] = useState("");
  const [loaded, setLoaded] = useState(!requisitionId);

  const selectedDefect = eligibleDefects.find((d) => d.id === defectId);

  useEffect(() => {
    setRequestedByName(defaultRequestedByName);
  }, [defaultRequestedByName]);

  useEffect(() => {
    if (!vesselId) return;
    void fetch(
      `${requisitionsApiBase}?vesselId=${encodeURIComponent(vesselId)}&eligibleDefects=true`,
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        setEligibleDefects((data?.defects as EligibleDefect[] | undefined) ?? []);
      });
  }, [vesselId, requisitionsApiBase]);

  useEffect(() => {
    if (!requisitionId) return;
    void fetch(`${requisitionsApiBase}/${requisitionId}`)
      .then((r) => r.json())
      .then((data: { requisition?: VesselRequisitionDto }) => {
        const req = data.requisition;
        if (!req) return;
        setDefectId(req.vesselDefectId);
        setPurpose(req.requisitionPurpose);
        setHeading(req.heading);
        setDescription(req.description ?? "");
        setPortOfSupply(req.portOfSupply ?? "");
        setRequestedByName(req.requestedByName ?? defaultRequestedByName);
        setLines(
          req.lines.length
            ? req.lines.map((line) => ({
                key: line.id,
                partName: line.partName,
                partNumber: line.partNumber ?? "",
                description: line.description ?? "",
                quantity: line.quantity,
                unit: line.unit,
                urgency: line.urgency,
                equipmentLabel: line.equipmentLabel,
                remarks: line.remarks ?? "",
              }))
            : [emptyLine(req.defect?.equipmentLabel)],
        );
        if (req.defect) {
          setEligibleDefects((prev) => {
            const exists = prev.some((d) => d.id === req.defect!.id);
            if (exists) return prev;
            return [
              {
                id: req.defect!.id,
                title: req.defect!.title,
                equipmentSystem: req.defect!.equipmentSystem,
                equipmentLabel: req.defect!.equipmentLabel,
                location: req.defect!.location,
                priority: req.defect!.priority,
              },
              ...prev,
            ];
          });
        }
        setLoaded(true);
      });
  }, [requisitionId, requisitionsApiBase, defaultRequestedByName]);

  useEffect(() => {
    if (requisitionId || !initialDefectId) return;
    setDefectId(initialDefectId);
  }, [initialDefectId, requisitionId]);

  useEffect(() => {
    if (requisitionId || !selectedDefect || heading) return;
    setHeading(`Spares for defect: ${selectedDefect.title}`);
    setLines([emptyLine(selectedDefect.equipmentLabel)]);
  }, [selectedDefect, requisitionId, heading]);

  function updateLine(key: string, patch: Partial<LineRow>) {
    setLines((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine(selectedDefect?.equipmentLabel)]);
  }

  function removeLine(key: string) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((line) => line.key !== key)));
  }

  async function save(submit: boolean) {
    if (readOnly || !vesselId) return;
    if (!defectId) {
      setError("Select a Master-approved defect");
      return;
    }
    if (!heading.trim()) {
      setError("Heading is required");
      return;
    }
    const validLines = lines.filter((line) => line.partName.trim());
    if (validLines.length === 0) {
      setError("Add at least one line item with a part name");
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      vesselId,
      vesselDefectId: defectId,
      targetDryDockProjectId: dryDockProjectId || null,
      heading: heading.trim(),
      description: description.trim() || null,
      requisitionPurpose: purpose,
      portOfSupply: portOfSupply.trim() || null,
      requestedByName: requestedByName.trim() || null,
      lines: validLines.map(({ key: _key, ...line }) => ({
        ...line,
        partNumber: line.partNumber || null,
        remarks: line.remarks || null,
      })),
      submit,
    };

    try {
      const res = await fetch(
        requisitionId ? `${requisitionsApiBase}/${requisitionId}` : requisitionsApiBase,
        {
          method: requisitionId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to save requisition");
        return;
      }
      router.push("/ship-access/purchase");
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  if (!vesselId || !loaded) {
    return (
      <Card>
        <ActiniumLoadingState size="md" minHeight={80} />
      </Card>
    );
  }

  const defectItems = eligibleDefects.map((defect) => ({
    value: defect.id,
    label: `${defect.title} — ${equipmentSystemLabel(defect.equipmentSystem as never)}`,
  }));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Spares requisition (SPR)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Raise a spares requisition against a Master-approved defect. Save as draft to edit
            later, or submit for Master approval. Once approved, the requisition is locked onboard
            and forwarded to the office procurement workflow.
          </p>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Linked defect *</Label>
              <LabeledSelect
                items={defectItems}
                value={defectId}
                onValueChange={(v) => !readOnly && !requisitionId && setDefectId(v || "")}
                className="w-full"
              />
              {selectedDefect ? (
                <p className="text-xs text-muted-foreground">
                  {selectedDefect.equipmentLabel ?? equipmentSystemLabel(selectedDefect.equipmentSystem as never)}
                  {selectedDefect.location ? ` · ${selectedDefect.location}` : ""}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>Purpose</Label>
              <LabeledSelect
                items={VESSEL_REQUISITION_PURPOSE_ITEMS}
                value={purpose}
                onValueChange={(v) => !readOnly && setPurpose(v || "defect_closer")}
                className="w-full"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="req-heading">Heading *</Label>
              <Input
                id="req-heading"
                value={heading}
                onChange={(e) => setHeading(e.target.value)}
                disabled={readOnly}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="req-port">Port of supply</Label>
              <Input
                id="req-port"
                value={portOfSupply}
                onChange={(e) => setPortOfSupply(e.target.value)}
                placeholder="e.g. Singapore"
                disabled={readOnly}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="req-description">Description</Label>
            <Textarea
              id="req-description"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={readOnly}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="req-requestedBy">Requested by</Label>
            <Input
              id="req-requestedBy"
              value={requestedByName}
              onChange={(e) => setRequestedByName(e.target.value)}
              disabled={readOnly}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Line items</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={addLine} disabled={readOnly}>
            Add line
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {lines.map((line, index) => (
            <div key={line.key} className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Item {index + 1}</p>
                {lines.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeLine(line.key)}
                    disabled={readOnly}
                  >
                    Remove
                  </Button>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Part name *</Label>
                  <Input
                    value={line.partName}
                    onChange={(e) => updateLine(line.key, { partName: e.target.value })}
                    disabled={readOnly}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Part number</Label>
                  <Input
                    value={line.partNumber ?? ""}
                    onChange={(e) => updateLine(line.key, { partNumber: e.target.value })}
                    disabled={readOnly}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    min={0.01}
                    step={1}
                    value={line.quantity ?? 1}
                    onChange={(e) =>
                      updateLine(line.key, { quantity: Number(e.target.value) || 1 })
                    }
                    disabled={readOnly}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit</Label>
                  <LabeledSelect
                    items={VESSEL_REQUISITION_UNIT_ITEMS}
                    value={line.unit ?? "pcs"}
                    onValueChange={(v) => !readOnly && updateLine(line.key, { unit: v || "pcs" })}
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Urgency</Label>
                  <LabeledSelect
                    items={VESSEL_REQUISITION_URGENCY_ITEMS}
                    value={line.urgency ?? "normal"}
                    onValueChange={(v) =>
                      !readOnly &&
                      updateLine(line.key, { urgency: (v || "normal") as LineRow["urgency"] })
                    }
                    className="w-full"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Equipment</Label>
                  <Input
                    value={line.equipmentLabel ?? ""}
                    onChange={(e) => updateLine(line.key, { equipmentLabel: e.target.value })}
                    disabled={readOnly}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Remarks</Label>
                <Input
                  value={line.remarks ?? ""}
                  onChange={(e) => updateLine(line.key, { remarks: e.target.value })}
                  disabled={readOnly}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={readOnly || saving} onClick={() => void save(false)}>
          Save draft
        </Button>
        <Button disabled={readOnly || saving} onClick={() => void save(true)}>
          Submit for Master approval
        </Button>
      </div>
    </div>
  );
}
