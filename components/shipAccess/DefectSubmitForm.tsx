"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LabeledSelect } from "@/components/ui/LabeledSelect";
import { JOB_PRIORITY_ITEMS } from "@/lib/superintendent/constants";
import {
  suggestEquipmentLabel,
  VESSEL_DEFECT_EQUIPMENT_SYSTEM_ITEMS,
  VESSEL_DEFECT_EQUIPMENT_SYSTEMS,
} from "@/lib/shipAccess/crewDefectSystems";
import type { VesselDefectDto } from "@/lib/shipAccess/defectTypes";

type Props = {
  vesselId?: string | null;
  readOnly?: boolean;
  defectsApiBase?: string;
  defaultReportedByName?: string;
  defectId?: string;
  onSaved?: () => void;
};

export function DefectSubmitForm({
  vesselId,
  readOnly,
  defectsApiBase = "/api/ship-access/defects",
  defaultReportedByName = "",
  defectId,
  onSaved,
}: Props) {
  const router = useRouter();
  const [equipmentSystem, setEquipmentSystem] = useState("main_engine");
  const [priority, setPriority] = useState("medium");
  const [reportedByName, setReportedByName] = useState(defaultReportedByName);
  const [machineryHint, setMachineryHint] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    setReportedByName(defaultReportedByName);
  }, [defaultReportedByName]);

  useEffect(() => {
    if (!vesselId) return;
    void fetch(`/api/ship-access/machinery-hours?vesselId=${encodeURIComponent(vesselId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const profile = data?.hours as
          | {
              mainEngine?: string | null;
              auxiliaryEngine?: string | null;
              boilerInfo?: string | null;
            }
          | undefined;
        if (!profile) return;
        const suggested = suggestEquipmentLabel(
          equipmentSystem as (typeof VESSEL_DEFECT_EQUIPMENT_SYSTEMS)[number],
          profile,
        );
        setMachineryHint(suggested);
        if (!defectId && formRef.current) {
          const labelInput = formRef.current.elements.namedItem(
            "equipmentLabel",
          ) as HTMLInputElement | null;
          if (labelInput && !labelInput.value && suggested) {
            labelInput.value = suggested;
          }
        }
      });
  }, [vesselId, equipmentSystem, defectId]);

  useEffect(() => {
    if (!defectId) return;
    void fetch(`${defectsApiBase}/${defectId}`)
      .then((r) => r.json())
      .then((data: { defect?: VesselDefectDto }) => {
        const defect = data.defect;
        if (!defect) return;
        setEquipmentSystem(defect.equipmentSystem);
        setPriority(defect.priority);
        setReportedByName(defect.reportedByName ?? defaultReportedByName);
        if (formRef.current) {
          (formRef.current.elements.namedItem("equipmentLabel") as HTMLInputElement).value =
            defect.equipmentLabel ?? "";
          (formRef.current.elements.namedItem("location") as HTMLInputElement).value =
            defect.location ?? "";
          (formRef.current.elements.namedItem("title") as HTMLInputElement).value = defect.title;
          (formRef.current.elements.namedItem("description") as HTMLTextAreaElement).value =
            defect.description ?? "";
        }
      });
  }, [defectId, defectsApiBase, defaultReportedByName]);

  async function saveDraft() {
    const form = formRef.current;
    if (!form || readOnly || !vesselId) return;
    await handleSubmit(form, false);
  }

  async function saveAndSubmit() {
    const form = formRef.current;
    if (!form || readOnly || !vesselId) return;
    if (!form.reportValidity()) return;
    await handleSubmit(form, true);
  }

  async function handleSubmit(form: HTMLFormElement, submit: boolean) {
    setSaving(true);
    setError(null);
    const formData = new FormData(form);

    try {
      const payload = {
        vesselId,
        equipmentSystem,
        equipmentLabel: (formData.get("equipmentLabel") as string) || null,
        location: (formData.get("location") as string) || null,
        title: formData.get("title"),
        description: (formData.get("description") as string) || null,
        priority,
        reportedByName: reportedByName.trim() || null,
        submit,
      };

      const res = await fetch(defectId ? `${defectsApiBase}/${defectId}` : defectsApiBase, {
        method: defectId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to save defect");
        return;
      }

      onSaved?.();
      if (submit || defectId) {
        router.push("/ship-access/defects");
      } else {
        form.reset();
        setEquipmentSystem("main_engine");
        setPriority("medium");
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  if (!vesselId) {
    return (
      <Card>
        <CardContent className="py-4 text-sm text-muted-foreground">
          Loading vessel context…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Report machinery / equipment defect</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          Identify the machinery, equipment, or system first, then describe the defect. Save as
          draft to edit later, or submit to upload for Master approval. Once the Master approves, the
          defect is locked and cannot be changed onboard.
        </p>
        {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}
        <form ref={formRef} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Equipment / system *</Label>
              <LabeledSelect
                items={VESSEL_DEFECT_EQUIPMENT_SYSTEM_ITEMS}
                value={equipmentSystem}
                onValueChange={(v) => setEquipmentSystem(v || "main_engine")}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="defect-equipmentLabel">Equipment name / maker model</Label>
              <Input
                id="defect-equipmentLabel"
                name="equipmentLabel"
                placeholder={machineryHint ?? "e.g. MAN B&W 6S50ME-C"}
                disabled={readOnly}
              />
              {machineryHint ? (
                <p className="text-xs text-muted-foreground">
                  From vessel profile: {machineryHint}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="defect-location">Location on board</Label>
              <Input
                id="defect-location"
                name="location"
                placeholder="e.g. ER stbd, funnel deck"
                disabled={readOnly}
              />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <LabeledSelect
                items={JOB_PRIORITY_ITEMS}
                value={priority}
                onValueChange={(v) => setPriority(v || "medium")}
                className="w-full"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="defect-title">Defect title *</Label>
            <Input
              id="defect-title"
              name="title"
              required
              placeholder="Brief summary of the defect"
              disabled={readOnly}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="defect-description">Defect details</Label>
            <Textarea
              id="defect-description"
              name="description"
              rows={4}
              placeholder="Symptoms, when observed, operational impact, temporary measures taken…"
              disabled={readOnly}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="defect-reportedBy">Reported by</Label>
            <Input
              id="defect-reportedBy"
              value={reportedByName}
              onChange={(e) => setReportedByName(e.target.value)}
              disabled={readOnly}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={readOnly || saving} onClick={() => void saveDraft()}>
              Save draft
            </Button>
            <Button type="button" disabled={readOnly || saving} onClick={() => void saveAndSubmit()}>
              Submit for Master approval
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
