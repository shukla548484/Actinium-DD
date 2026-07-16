"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LabeledSelect } from "@/components/ui/LabeledSelect";
import { JOB_PRIORITY_ITEMS } from "@/lib/superintendent/constants";
import type { JobInputFieldDef, JobLibraryNodeDto } from "@/lib/vessel/jobLibrary/catalog";
import { CONDITION_RATING_ITEMS } from "@/lib/vessel/machinery/parameters";
import { uploadPendingVesselJobFiles } from "@/components/shipAccess/VesselJobAttachmentsPanel";
import type { DdVesselJobDto } from "@/lib/superintendent/types";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";
import type { MachineryAssetDto } from "@/lib/db/vesselMachineryAssets";

export type DefectJobPrefill = {
  id: string;
  title: string;
  description: string | null;
  equipmentLabel: string | null;
  priority: string;
};

type Props = {
  vesselId: string;
  dryDockProjectId?: string | null;
  linkedDefectId?: string | null;
  defectPrefill?: DefectJobPrefill | null;
  createdByName?: string;
  onSaved?: () => void;
  jobsApiBase?: string;
  jobLibraryApiBase?: string;
};

type WizardStep = "pick" | "details" | "review";

export function DynamicScopeJobWizard({
  vesselId,
  dryDockProjectId,
  linkedDefectId,
  defectPrefill,
  createdByName = "",
  onSaved,
  jobsApiBase = "/api/ship-access/jobs",
  jobLibraryApiBase = "/api/ship-access/job-library",
}: Props) {
  const [step, setStep] = useState<WizardStep>("pick");
  const [path, setPath] = useState<JobLibraryNodeDto[]>([]);
  const [options, setOptions] = useState<JobLibraryNodeDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [priority, setPriority] = useState("medium");
  const [conditionRating, setConditionRating] = useState("monitor");
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [pendingPhotos, setPendingPhotos] = useState<File[]>([]);
  const [resolvedTemplate, setResolvedTemplate] = useState<JobInputFieldDef[]>([]);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [machineryAssets, setMachineryAssets] = useState<MachineryAssetDto[]>([]);
  const [machineryLoading, setMachineryLoading] = useState(true);
  const [selectedMachineryAssetId, setSelectedMachineryAssetId] = useState("");

  const standardJob = path.find((n) => n.nodeType === "standard_job") ?? null;
  const template = resolvedTemplate.length > 0 ? resolvedTemplate : (standardJob?.inputTemplate ?? []);
  const selectedMachineryAsset =
    machineryAssets.find((asset) => asset.id === selectedMachineryAssetId) ?? null;

  useEffect(() => {
    if (!defectPrefill) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setFormValues((prev) => ({
        ...prev,
        conditionDescription:
          prev.conditionDescription ||
          [defectPrefill.title, defectPrefill.description].filter(Boolean).join("\n\n"),
        observedDefect:
          prev.observedDefect || defectPrefill.equipmentLabel || defectPrefill.title,
        repairRecommendation:
          prev.repairRecommendation ||
          `Scope repair linked to Master-approved defect: ${defectPrefill.title}`,
      }));
      if (defectPrefill.priority) setPriority(defectPrefill.priority);
    });
    return () => {
      cancelled = true;
    };
  }, [defectPrefill]);

  const loadChildren = useCallback(async (parentId: string | null) => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (parentId) qs.set("parentId", parentId);
    else {
      if (dryDockProjectId) qs.set("dryDockProjectId", dryDockProjectId);
      qs.set("vesselId", vesselId);
    }
    const query = qs.toString();
    const res = await fetch(`${jobLibraryApiBase}${query ? `?${query}` : ""}`);
    const data = (await res.json()) as { nodes?: JobLibraryNodeDto[] };
    setOptions(data.nodes ?? []);
    setLoading(false);
  }, [dryDockProjectId, vesselId, jobLibraryApiBase]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void loadChildren(null);
    });
    return () => {
      cancelled = true;
    };
  }, [loadChildren]);

  useEffect(() => {
    const qs = new URLSearchParams({ vesselId });
    void fetch(`/api/ship-access/machinery/assets?${qs.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { assets?: MachineryAssetDto[] } | null) => {
        setMachineryAssets(data?.assets ?? []);
      })
      .finally(() => setMachineryLoading(false));
  }, [vesselId]);

  function selectNode(node: JobLibraryNodeDto) {
    const nextPath = [...path, node];
    setPath(nextPath);
    if (node.nodeType === "standard_job") {
      setPriority(node.defaultPriority ?? "medium");
      setResolvedTemplate([]);
      setTemplateLoading(true);
      setStep("details");
      void fetch(`${jobLibraryApiBase}/${node.id}`)
        .then((r) => r.json())
        .then((data: { node?: JobLibraryNodeDto }) => {
          setResolvedTemplate(data.node?.inputTemplate ?? node.inputTemplate ?? []);
        })
        .catch(() => {
          setResolvedTemplate(node.inputTemplate ?? []);
        })
        .finally(() => setTemplateLoading(false));
      return;
    }
    void loadChildren(node.id);
  }

  function goBack() {
    if (step === "details") {
      setStep("pick");
      setPath([]);
      setSelectedMachineryAssetId("");
      void loadChildren(null);
      return;
    }
    if (path.length <= 1) {
      setPath([]);
      void loadChildren(null);
      return;
    }
    const nextPath = path.slice(0, -1);
    setPath(nextPath);
    void loadChildren(nextPath[nextPath.length - 1]?.id ?? null);
  }

  async function submit(submitForReview: boolean) {
    if (!standardJob) return;
    setSaving(true);
    setError(null);

    const department = path.find((n) => n.department)?.department ?? path[0]?.name ?? "General";
    const systemNode = path.find((n) => n.nodeType === "system");
    const machineryNode = path.find((n) => n.nodeType === "machinery");
    const componentNode = path.find((n) => n.nodeType === "component");

    const payload = {
      vesselId,
      targetDryDockProjectId: dryDockProjectId ?? null,
      standardJobLibraryId: standardJob.id,
      title: standardJob.name,
      category: path.find((n) => n.nodeType === "category")?.code ?? department.toLowerCase(),
      department,
      systemKey: systemNode?.code ?? null,
      machineryKey: machineryNode?.code ?? null,
      componentKey: componentNode?.code ?? null,
      workshop: systemNode?.workshop ?? path.find((n) => n.workshop)?.workshop ?? null,
      priority,
      source: "vessel",
      conditionRating,
      conditionDescription: formValues.conditionDescription ?? null,
      observedDefect: formValues.observedDefect ?? null,
      repairRecommendation: formValues.repairRecommendation ?? null,
      replacementParts: formValues.replacementParts ?? null,
      consumables: formValues.consumables ?? null,
      estimatedManhours: formValues.estimatedManhours
        ? Number(formValues.estimatedManhours)
        : standardJob.estimatedManhours,
      estimatedCost: formValues.estimatedCost ? Number(formValues.estimatedCost) : null,
      classAttendance: formValues.classAttendance === "true",
      makerAttendance: formValues.makerAttendance === "true",
      operationalRisk: formValues.operationalRisk ?? null,
      safetyRisk: formValues.safetyRisk ?? null,
      environmentalRisk: formValues.environmentalRisk ?? null,
      criticality: formValues.criticality ?? null,
      runningHoursAtSurvey: formValues.runningHours
        ? Number.parseInt(formValues.runningHours, 10)
        : null,
      lastOverhaulDate: formValues.lastOverhaul || null,
      linkedPmsReference: selectedMachineryAsset
        ? `machinery:${selectedMachineryAsset.id}`
        : null,
      linkedDefectId: linkedDefectId ?? null,
      formData: {
        ...formValues,
        machineryAssetId: selectedMachineryAsset?.id ?? "",
        machineryAssetName: selectedMachineryAsset?.name ?? "",
        machineryAssetMaker: selectedMachineryAsset?.maker ?? "",
        machineryAssetModel: selectedMachineryAsset?.model ?? "",
        machineryAssetSerialNumber: selectedMachineryAsset?.serialNumber ?? "",
      },
      createdByName: createdByName.trim() || null,
      createdByRole: "vessel",
      submit: submitForReview,
    };

    try {
      const res = await fetch(jobsApiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { error?: string; vesselJob?: DdVesselJobDto };
      if (!res.ok) {
        setError(data.error ?? "Failed to save job");
        return;
      }
      if (data.vesselJob?.id && pendingPhotos.length > 0) {
        await uploadPendingVesselJobFiles(data.vesselJob.id, pendingPhotos);
      }
      setPath([]);
      setFormValues({});
      setPendingPhotos([]);
      setResolvedTemplate([]);
      setSelectedMachineryAssetId("");
      setStep("pick");
      void loadChildren(null);
      onSaved?.();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  function formatDateForInput(value: string | null): string {
    return value ? value.slice(0, 10) : "";
  }

  function applyMachineryAsset(assetId: string) {
    setSelectedMachineryAssetId(assetId);
    const asset = machineryAssets.find((item) => item.id === assetId);
    if (!asset) return;

    const makeModel = [asset.maker, asset.model].filter(Boolean).join(" / ");
    setFormValues((prev) => ({
      ...prev,
      machineryAssetId: asset.id,
      equipmentTag: prev.equipmentTag || asset.name,
      department: prev.department || asset.department,
      runningHours: asset.currentRunningHours != null ? String(asset.currentRunningHours) : prev.runningHours || "",
      lastOverhaul: formatDateForInput(asset.lastOverhaulDate) || prev.lastOverhaul || "",
      makeModel: prev.makeModel || makeModel,
      engineMake: prev.engineMake || asset.maker || "",
      engineModel: prev.engineModel || asset.model || "",
      turbochargerMake: prev.turbochargerMake || asset.maker || "",
      turbochargerModel: prev.turbochargerModel || asset.model || "",
      pumpName: prev.pumpName || asset.name,
      motorNameNo: prev.motorNameNo || asset.name,
      generatorNo: prev.generatorNo || asset.name,
      equipmentSerialNumber: prev.equipmentSerialNumber || asset.serialNumber || "",
      machineryNotes: prev.machineryNotes || asset.notes || "",
    }));
    if (asset.conditionRating) setConditionRating(asset.conditionRating);
  }

  function renderField(field: JobInputFieldDef) {
    const value = formValues[field.key] ?? "";
    const onChange = (v: string) => setFormValues((prev) => ({ ...prev, [field.key]: v }));

    if (field.type === "textarea") {
      return (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          required={field.required}
        />
      );
    }
    if (field.type === "boolean") {
      return (
        <LabeledSelect
          items={[
            { value: "false", label: "No" },
            { value: "true", label: "Yes" },
          ]}
          value={value || "false"}
          onValueChange={onChange}
          className="w-full"
        />
      );
    }
    if (field.type === "photos_note") {
      return (
        <div className="space-y-2">
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            rows={2}
            placeholder="Describe photos taken or attach files below"
          />
          <Input
            type="file"
            accept="image/*,video/*,.pdf"
            multiple
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              setPendingPhotos((prev) => [...prev, ...files]);
              e.target.value = "";
            }}
          />
          {pendingPhotos.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              {pendingPhotos.length} file{pendingPhotos.length === 1 ? "" : "s"} ready to upload on save
            </p>
          ) : null}
        </div>
      );
    }
    if (field.type === "select" && field.options) {
      return (
        <LabeledSelect
          items={field.options}
          value={value}
          onValueChange={onChange}
          className="w-full"
        />
      );
    }
    return (
      <Input
        type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={field.required}
      />
    );
  }

  function emptyPickerMessage(): string {
    const inMasterRepoFramework = path.some(
      (n) =>
        n.code === "mtil_master_repo_v12" ||
        n.name.includes("Master Engineering Repository") ||
        n.name === "Engineering Domains",
    );
    const atFrameworkLeaf =
      inMasterRepoFramework && path[path.length - 1]?.nodeType === "system";

    if (atFrameworkLeaf) {
      return (
        "This R0.9 framework folder is a placeholder — it does not contain seeded jobs yet. " +
        "Go back to the top level and choose “Main Propulsion & Auxiliary (V3.1 ME+AE)” instead. " +
        "If that option is missing, an administrator must seed the EMDR V3.1 master repository from Admin → Job library."
      );
    }

    if (path.length > 0) {
      return (
        "No jobs are available under this branch. Go back and select “Main Propulsion & Auxiliary (V3.1 ME+AE)”. " +
        "If it is not listed, ask an administrator to seed the EMDR master repository from Admin → Job library."
      );
    }

    return (
      "No job library departments are available for this vessel and project type. " +
      "An administrator must seed the EMDR V3.1 (Main Engine + Auxiliary Engine) master repository from Admin → Job library, " +
      "then reload this page."
    );
  }

  return (
    <div className="space-y-4">
      {defectPrefill ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-3 text-sm">
            Creating scope job from Master-approved defect:{" "}
            <span className="font-medium">{defectPrefill.title}</span>
          </CardContent>
        </Card>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {step === "pick" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Select from master job library</CardTitle>
            <CardDescription>
              Department → System → Machinery → Component → Standard job. Do not type jobs from
              scratch.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {path.length > 0 ? (
              <p className="text-sm text-muted-foreground">
                Path: {path.map((n) => n.name).join(" → ")}
              </p>
            ) : null}

            {loading ? (
              <ActiniumLoadingState label="Loading options…" size="sm" />
            ) : options.length === 0 ? (
              <p className="text-sm text-muted-foreground">{emptyPickerMessage()}</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {options.map((node) => (
                  <Button
                    key={node.id}
                    variant="outline"
                    className="h-auto justify-start px-3 py-2 text-left"
                    onClick={() => selectNode(node)}
                  >
                    <span className="flex flex-col gap-0.5">
                      <span className="font-medium">{node.name}</span>
                      <span className="text-xs font-normal capitalize text-muted-foreground">
                        {node.nodeType.replace(/_/g, " ")}
                      </span>
                    </span>
                  </Button>
                ))}
              </div>
            )}

            {path.length > 0 ? (
              <Button variant="ghost" size="sm" onClick={goBack}>
                ← Back
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {step === "details" && standardJob ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{standardJob.name}</CardTitle>
            <CardDescription>
              {path.map((n) => n.name).join(" → ")} · Ref: {standardJob.referenceCode ?? "—"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {templateLoading ? (
              <ActiniumLoadingState label="Loading job form template…" size="sm" />
            ) : null}

            <div className="space-y-3 rounded-md border p-3">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Machinery / equipment from vessel register</Label>
                  {machineryLoading ? (
                    <ActiniumLoadingState label="Loading machinery…" size="sm" />
                  ) : machineryAssets.length > 0 ? (
                    <LabeledSelect
                      items={machineryAssets.map((asset) => ({
                        value: asset.id,
                        label: `${asset.name}${asset.department ? ` · ${asset.department}` : ""}`,
                      }))}
                      value={selectedMachineryAssetId}
                      onValueChange={applyMachineryAsset}
                      placeholder="Select machinery"
                      className="w-full"
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground">No machinery registered for this vessel.</p>
                  )}
                </div>
                {selectedMachineryAsset ? (
                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">{selectedMachineryAsset.name}</p>
                    <p>{[selectedMachineryAsset.maker, selectedMachineryAsset.model].filter(Boolean).join(" / ") || "Maker/model not recorded"}</p>
                    <p>
                      Running hours: {selectedMachineryAsset.currentRunningHours ?? "—"} · Last overhaul:{" "}
                      {selectedMachineryAsset.lastOverhaulDate
                        ? new Date(selectedMachineryAsset.lastOverhaulDate).toLocaleDateString()
                        : "—"}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Priority</Label>
                <LabeledSelect
                  items={JOB_PRIORITY_ITEMS}
                  value={priority}
                  onValueChange={(v) => setPriority(v || "medium")}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label>Condition rating</Label>
                <LabeledSelect
                  items={CONDITION_RATING_ITEMS.map((i) => ({ value: i.value, label: i.label }))}
                  value={conditionRating}
                  onValueChange={(v) => setConditionRating(v || "monitor")}
                  className="w-full"
                />
              </div>
            </div>

            {(["condition", "repair", "risk", "approval"] as const).map((section) => {
              const fields = template.filter((f) => f.section === section);
              if (fields.length === 0) return null;
              return (
                <div key={section} className="space-y-3">
                  <h3 className="text-sm font-semibold capitalize">{section.replace(/_/g, " ")}</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {fields.map((field) => (
                      <div
                        key={field.key}
                        className={
                          field.type === "textarea" || field.type === "photos_note"
                            ? "sm:col-span-2 space-y-2"
                            : "space-y-2"
                        }
                      >
                        <Label>
                          {field.label}
                          {field.unit ? ` (${field.unit})` : ""}
                          {field.required ? " *" : ""}
                        </Label>
                        {renderField(field)}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            <div className="flex flex-wrap gap-2">
              <Button disabled={saving} onClick={() => void submit(true)}>
                {saving ? "Submitting…" : "Submit for CE review"}
              </Button>
              <Button variant="outline" disabled={saving} onClick={() => void submit(false)}>
                Save draft
              </Button>
              <Button variant="ghost" size="sm" onClick={goBack}>
                ← Reselect job
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
