"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LabeledSelect } from "@/components/ui/LabeledSelect";
import { DatePickerField } from "@/components/ui/DatePickerField";
import type { InputFieldDef, InputSectionDef } from "@/lib/superintendent/inputCatalog/types";
import type { InputSubmissionDto } from "@/lib/db/superintendent/inputs";
import { PaintingAreasPanel } from "@/components/superintendent/PaintingAreasPanel";
import { PaintingCoatingPanel } from "@/components/superintendent/PaintingCoatingPanel";
import { CurrentDefectsPanel } from "@/components/superintendent/CurrentDefectsPanel";
import {
  InputPhotosOverview,
  parseInputPhotos,
} from "@/components/superintendent/InputPhotosOverview";
import { InputFileAttachments } from "@/components/superintendent/InputFileAttachments";
import { SafetyEquipmentCountsPanel } from "@/components/superintendent/SafetyEquipmentCountsPanel";
import { HullConditionPanel } from "@/components/superintendent/HullConditionPanel";
import { TankConditionPanel } from "@/components/superintendent/TankConditionPanel";
import { TailshaftConditionPanel } from "@/components/superintendent/TailshaftConditionPanel";
import { PropellerConditionPanel } from "@/components/superintendent/PropellerConditionPanel";
import { RudderConditionPanel } from "@/components/superintendent/RudderConditionPanel";
import { SeaValvesPanel } from "@/components/superintendent/SeaValvesPanel";
import { SearchableMultiSelect } from "@/components/ui/SearchableMultiSelect";
import {
  validateSafetyEquipmentCounts,
  type SafetyCountMap,
} from "@/lib/superintendent/safetyEquipmentCounts";
import { validateHullCondition } from "@/lib/superintendent/hullCondition";
import { resolveCargoSpaceKind, validateTankCondition } from "@/lib/superintendent/tankCondition";
import { validateTailshaftCondition } from "@/lib/superintendent/tailshaftCondition";
import { validatePropellerCondition } from "@/lib/superintendent/propellerCondition";
import { validateRudderCondition } from "@/lib/superintendent/rudderCondition";
import { sanitizeSeaValveValues, validateSeaValves } from "@/lib/superintendent/seaValves";
import { validatePaintingCoating } from "@/lib/superintendent/paintingCoating";

type Props = {
  section: InputSectionDef;
  submission: InputSubmissionDto | null;
  dryDockProjectId: string;
  onSaved: (submission: InputSubmissionDto | null) => void;
  readOnly?: boolean;
  enteredByRole?: InputSectionDef["enteredBy"];
  vesselType?: string | null;
};

function FieldControl({
  field,
  value,
  onChange,
  disabled,
}: {
  field: InputFieldDef;
  value: unknown;
  onChange: (key: string, val: unknown) => void;
  disabled?: boolean;
}) {
  const id = `field-${field.key}`;
  const strVal = value == null ? "" : String(value);

  if (field.type === "files") {
    return (
      <InputFileAttachments
        files={parseInputPhotos(value)}
        onChange={(files) => onChange(field.key, files)}
        disabled={disabled}
        label=""
      />
    );
  }

  if (field.type === "photos") {
    return (
      <InputPhotosOverview
        photos={parseInputPhotos(value)}
        onChange={(photos) => onChange(field.key, photos)}
        disabled={disabled}
        label=""
      />
    );
  }

  if (field.type === "textarea" || field.type === "photos_note") {
    return (
      <Textarea
        id={id}
        value={strVal}
        onChange={(e) => onChange(field.key, e.target.value)}
        placeholder={field.placeholder}
        rows={field.type === "photos_note" ? 3 : 4}
        disabled={disabled}
      />
    );
  }

  if (field.type === "boolean") {
    return (
      <LabeledSelect
        items={[
          { value: "true", label: "Yes" },
          { value: "false", label: "No" },
        ]}
        value={value === true || value === "true" ? "true" : value === false || value === "false" ? "false" : ""}
        onValueChange={(v) => onChange(field.key, v === "true")}
        className="w-full"
      />
    );
  }

  if (field.type === "select" && field.options) {
    return (
      <LabeledSelect
        items={field.options.map((o) => ({ value: o.value, label: o.label }))}
        value={strVal}
        onValueChange={(v) => onChange(field.key, v)}
        className="w-full"
      />
    );
  }

  if (field.type === "multiselect" && field.options) {
    const selected = Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
    return (
      <SearchableMultiSelect
        id={id}
        items={field.options.map((o) => ({ value: o.value, label: o.label }))}
        values={selected}
        onValuesChange={(next) => onChange(field.key, next)}
        placeholder={field.placeholder ?? "Search and select…"}
        searchPlaceholder="Search…"
        disabled={disabled}
      />
    );
  }

  if (field.type === "date") {
    return (
      <DatePickerField
        id={id}
        name={field.key}
        label=""
        value={strVal}
        onValueChange={(v) => onChange(field.key, v)}
        placeholder={field.placeholder ?? "Select date"}
        disabled={disabled}
      />
    );
  }

  if (field.type === "number") {
    return (
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="number"
          value={strVal}
          onChange={(e) => onChange(field.key, e.target.value === "" ? null : Number(e.target.value))}
          placeholder={field.placeholder}
          disabled={disabled}
        />
        {field.unit ? (
          <span className="shrink-0 text-sm text-muted-foreground">{field.unit}</span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        id={id}
        value={strVal}
        onChange={(e) => onChange(field.key, e.target.value)}
        placeholder={field.placeholder}
        disabled={disabled}
      />
      {field.unit ? (
        <span className="shrink-0 text-sm text-muted-foreground">{field.unit}</span>
      ) : null}
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  reviewed: "Reviewed",
  approved: "Approved",
  rejected: "Rejected",
  inactive: "Inactive",
};

export function InputSectionForm({
  section,
  submission,
  dryDockProjectId,
  onSaved,
  readOnly = false,
  enteredByRole,
  vesselType,
}: Props) {
  const [values, setValues] = useState<Record<string, unknown>>(
    () => (submission?.valuesJson as Record<string, unknown>) ?? {},
  );
  const [enteredByName, setEnteredByName] = useState(submission?.enteredByName ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [defectCount, setDefectCount] = useState(
    () => Number(submission?.valuesJson?.importedDefectCount) || 0,
  );
  const role = enteredByRole ?? section.enteredBy;

  const setField = useCallback((key: string, val: unknown) => {
    setValues((prev) => ({ ...prev, [key]: val }));
  }, []);

  const save = async (status: "draft" | "submitted") => {
    setSaving(true);
    setError(null);
    if (section.key === "vessel_defects" && status === "submitted" && defectCount === 0) {
      setSaving(false);
      setError("Add at least one defect (table or Excel) before submitting.");
      return;
    }
    if (section.key === "vessel_safety" && status === "submitted") {
      const countsError = validateSafetyEquipmentCounts(values);
      if (countsError) {
        setSaving(false);
        setError(countsError);
        return;
      }
    }
    if (section.key === "hull_condition" && status === "submitted") {
      const hullError = validateHullCondition(values);
      if (hullError) {
        setSaving(false);
        setError(hullError);
        return;
      }
    }
    let payloadValues = values;
    if (section.key === "tank_condition") {
      const cargoSpaceKind = resolveCargoSpaceKind(values, vesselType);
      if (cargoSpaceKind) {
        payloadValues = { ...values, cargoSpaceKind };
      }
      if (status === "submitted") {
        const tankError = validateTankCondition(payloadValues, vesselType);
        if (tankError) {
          setSaving(false);
          setError(tankError);
          return;
        }
      }
    }
    if (section.key === "propeller" && status === "submitted") {
      const propellerError = validatePropellerCondition(values);
      if (propellerError) {
        setSaving(false);
        setError(propellerError);
        return;
      }
    }
    if (section.key === "tailshaft" && status === "submitted") {
      const tailshaftError = validateTailshaftCondition(values);
      if (tailshaftError) {
        setSaving(false);
        setError(tailshaftError);
        return;
      }
    }
    if (section.key === "rudder" && status === "submitted") {
      const rudderError = validateRudderCondition(values);
      if (rudderError) {
        setSaving(false);
        setError(rudderError);
        return;
      }
    }
    if (section.key === "sea_valves") {
      payloadValues = sanitizeSeaValveValues(values);
      if (status === "submitted") {
        const seaValvesError = validateSeaValves(payloadValues);
        if (seaValvesError) {
          setSaving(false);
          setError(seaValvesError);
          return;
        }
      }
    }
    if (section.key === "painting" && status === "submitted") {
      const paintingError = validatePaintingCoating(values);
      if (paintingError) {
        setSaving(false);
        setError(paintingError);
        return;
      }
    }
    try {
      const res = await fetch(
        `/api/superintendent/projects/${dryDockProjectId}/inputs/${section.key}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sectionKey: section.key,
            valuesJson: payloadValues,
            enteredByRole: role,
            enteredByName: enteredByName || null,
            status,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      onSaved(data.submission as InputSubmissionDto);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const patchAction = async (action: "deactivate" | "delete") => {
    if (!submission) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/superintendent/projects/${dryDockProjectId}/inputs/${section.key}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Action failed");
      if (action === "delete") {
        onSaved(null);
        setValues({});
      } else if (data.submission) {
        onSaved(data.submission as InputSubmissionDto);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setSaving(false);
    }
  };

  const locked =
    readOnly ||
    submission?.status === "approved" ||
    submission?.status === "inactive";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-medium">{section.label}</h3>
          {section.description ? (
            <p className="text-sm text-muted-foreground">{section.description}</p>
          ) : null}
        </div>
        {submission || defectCount > 0 ? (
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
            {STATUS_LABELS[submission?.status ?? "submitted"] ?? submission?.status ?? "Submitted"}
          </span>
        ) : (
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            Not started
          </span>
        )}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {section.key === "vessel_defects" ? (
        <CurrentDefectsPanel
          dryDockProjectId={dryDockProjectId}
          values={values}
          onChange={setField}
          enteredByName={enteredByName}
          onEnteredByNameChange={setEnteredByName}
          disabled={locked}
          onDefectCountChange={setDefectCount}
          onSubmissionSynced={(next) => {
            setValues((prev) => ({
              ...prev,
              openDefects: next.valuesJson.openDefects ?? prev.openDefects,
              importedDefectCount: next.valuesJson.importedDefectCount,
              machineryStatus: prev.machineryStatus || next.valuesJson.machineryStatus,
            }));
            onSaved(next);
          }}
        />
      ) : section.key === "hull_condition" ? (
        <div className="space-y-4">
          <div>
            <Label htmlFor="enteredByName">Entered by (name)</Label>
            <Input
              id="enteredByName"
              className="mt-1.5"
              value={enteredByName}
              onChange={(e) => setEnteredByName(e.target.value)}
              placeholder="Chief Engineer / Master"
              disabled={locked}
            />
          </div>
          <HullConditionPanel values={values} onChange={setField} disabled={locked} />
        </div>
      ) : section.key === "tank_condition" ? (
        <div className="space-y-4">
          <div>
            <Label htmlFor="enteredByName">Entered by (name)</Label>
            <Input
              id="enteredByName"
              className="mt-1.5"
              value={enteredByName}
              onChange={(e) => setEnteredByName(e.target.value)}
              placeholder="Chief Engineer / Master"
              disabled={locked}
            />
          </div>
          <TankConditionPanel
            values={values}
            onChange={setField}
            disabled={locked}
            vesselType={vesselType}
          />
        </div>
      ) : section.key === "tailshaft" ? (
        <div className="space-y-4">
          <div>
            <Label htmlFor="enteredByName">Entered by (name)</Label>
            <Input
              id="enteredByName"
              className="mt-1.5"
              value={enteredByName}
              onChange={(e) => setEnteredByName(e.target.value)}
              placeholder="Chief Engineer / Master"
              disabled={locked}
            />
          </div>
          <TailshaftConditionPanel values={values} onChange={setField} disabled={locked} />
        </div>
      ) : section.key === "propeller" ? (
        <div className="space-y-4">
          <div>
            <Label htmlFor="enteredByName">Entered by (name)</Label>
            <Input
              id="enteredByName"
              className="mt-1.5"
              value={enteredByName}
              onChange={(e) => setEnteredByName(e.target.value)}
              placeholder="Chief Engineer / Master"
              disabled={locked}
            />
          </div>
          <PropellerConditionPanel values={values} onChange={setField} disabled={locked} />
        </div>
      ) : section.key === "rudder" ? (
        <div className="space-y-4">
          <div>
            <Label htmlFor="enteredByName">Entered by (name)</Label>
            <Input
              id="enteredByName"
              className="mt-1.5"
              value={enteredByName}
              onChange={(e) => setEnteredByName(e.target.value)}
              placeholder="Chief Engineer / Master"
              disabled={locked}
            />
          </div>
          <RudderConditionPanel values={values} onChange={setField} disabled={locked} />
        </div>
      ) : section.key === "sea_valves" ? (
        <div className="space-y-4">
          <div>
            <Label htmlFor="enteredByName">Entered by (name)</Label>
            <Input
              id="enteredByName"
              className="mt-1.5"
              value={enteredByName}
              onChange={(e) => setEnteredByName(e.target.value)}
              placeholder="Chief Engineer / Master"
              disabled={locked}
            />
          </div>
          <SeaValvesPanel
            values={values}
            onChange={setField}
            dryDockProjectId={dryDockProjectId}
            disabled={locked}
            onImported={onSaved}
          />
        </div>
      ) : section.key === "painting" ? (
        <div className="space-y-4">
          <div>
            <Label htmlFor="enteredByName">Entered by (name)</Label>
            <Input
              id="enteredByName"
              className="mt-1.5"
              value={enteredByName}
              onChange={(e) => setEnteredByName(e.target.value)}
              placeholder="Chief Engineer / Master"
              disabled={locked}
            />
          </div>
          <PaintingCoatingPanel
            values={values}
            onChange={setField}
            disabled={locked}
            vesselType={vesselType}
          />
        </div>
      ) : section.key === "vessel_safety" ? (
        <div className="space-y-4">
          <div>
            <Label htmlFor="enteredByName">Entered by (name)</Label>
            <Input
              id="enteredByName"
              className="mt-1.5"
              value={enteredByName}
              onChange={(e) => setEnteredByName(e.target.value)}
              placeholder="Chief Engineer / Master"
              disabled={locked}
            />
          </div>
          <SafetyEquipmentCountsPanel
            lsaCounts={values.lsaCounts}
            ffaCounts={values.ffaCounts}
            onChange={(key: "lsaCounts" | "ffaCounts", value: SafetyCountMap) =>
              setField(key, value)
            }
            disabled={locked}
          />
          <div className="grid gap-3 md:grid-cols-2">
            {section.fields
              .filter((field) => field.key === "lsaDueItems" || field.key === "ffaDueItems")
              .map((field) => (
                <div key={field.key}>
                  <div className="mb-1.5 flex items-baseline gap-1">
                    <Label htmlFor={`field-${field.key}`}>{field.label}</Label>
                  </div>
                  <FieldControl
                    field={field}
                    value={values[field.key]}
                    onChange={setField}
                    disabled={locked}
                  />
                </div>
              ))}
            <div className="md:col-span-2 space-y-2">
              <p className="text-sm font-medium">Fixed extinguishing system onboard</p>
              <p className="text-xs text-muted-foreground">
                Select every medium fitted on board (CO2, foam, or other). Do not assume CO2 only.
              </p>
              <div className="flex flex-wrap gap-3">
                {(
                  [
                    ["co2", "CO2"],
                    ["foam", "Foam"],
                    ["water_mist", "Water mist"],
                    ["dry_powder", "Dry powder"],
                    ["other", "Other medium"],
                  ] as const
                ).map(([value, label]) => {
                  const selected = Array.isArray(values.fixedSystemMedia)
                    ? (values.fixedSystemMedia as string[]).includes(value)
                    : false;
                  return (
                    <div key={value} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        id={`fixed-media-${value}`}
                        checked={selected}
                        disabled={locked}
                        onCheckedChange={(checked) => {
                          const current = Array.isArray(values.fixedSystemMedia)
                            ? [...(values.fixedSystemMedia as string[])]
                            : [];
                          const next = checked === true
                            ? [...current, value]
                            : current.filter((v) => v !== value);
                          setField("fixedSystemMedia", next);
                        }}
                      />
                      <Label htmlFor={`fixed-media-${value}`} className="font-normal">
                        {label}
                      </Label>
                    </div>
                  );
                })}
              </div>
              {Array.isArray(values.fixedSystemMedia) &&
              (values.fixedSystemMedia as string[]).includes("other") ? (
                <div>
                  <Label htmlFor="field-fixedSystemOther">Other medium (specify)</Label>
                  <Input
                    id="field-fixedSystemOther"
                    className="mt-1.5"
                    value={values.fixedSystemOther == null ? "" : String(values.fixedSystemOther)}
                    onChange={(e) => setField("fixedSystemOther", e.target.value)}
                    placeholder="e.g. Novec, Inergen, Hi-Fog"
                    disabled={locked}
                  />
                </div>
              ) : null}
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="field-fixedSystemStatus">Fixed extinguishing system status</Label>
              <Input
                id="field-fixedSystemStatus"
                className="mt-1.5"
                value={values.fixedSystemStatus == null ? "" : String(values.fixedSystemStatus)}
                onChange={(e) => setField("fixedSystemStatus", e.target.value)}
                placeholder="Condition, last service, defects"
                disabled={locked}
              />
            </div>
            <div>
              <Label htmlFor="field-lifeboatStatus">Lifeboat status</Label>
              <Input
                id="field-lifeboatStatus"
                className="mt-1.5"
                value={values.lifeboatStatus == null ? "" : String(values.lifeboatStatus)}
                onChange={(e) => setField("lifeboatStatus", e.target.value)}
                placeholder="Condition, last overhaul, defects"
                disabled={locked}
              />
            </div>
            <div>
              <Label htmlFor="field-davitStatus">Davit status</Label>
              <Input
                id="field-davitStatus"
                className="mt-1.5"
                value={values.davitStatus == null ? "" : String(values.davitStatus)}
                onChange={(e) => setField("davitStatus", e.target.value)}
                placeholder="Condition, last load test, defects"
                disabled={locked}
              />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <InputFileAttachments
              files={parseInputPhotos(values.previousCertificate)}
              onChange={(files) => setField("previousCertificate", files)}
              disabled={locked}
              label="Previous certificate"
              hint="Attach the last LSA/FFA certificate. Preview appears here immediately."
            />
            <InputFileAttachments
              files={parseInputPhotos(values.previousServiceReport)}
              onChange={(files) => setField("previousServiceReport", files)}
              disabled={locked}
              label="Previous service report"
              hint="Attach the last service report. Preview appears here immediately."
            />
          </div>
        </div>
      ) : (
        <>
          {!locked ? (
            <div className="space-y-2">
              <Label htmlFor="enteredByName">Entered by (name)</Label>
              <Input
                id="enteredByName"
                value={enteredByName}
                onChange={(e) => setEnteredByName(e.target.value)}
                placeholder="Chief Engineer / Master"
              />
            </div>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            {section.fields.map((field) => (
              <div
                key={field.key}
                className={
                  field.type === "textarea" ||
                  field.type === "photos_note" ||
                  field.type === "photos" ||
                  field.type === "files"
                    ? "sm:col-span-2"
                    : ""
                }
              >
                <div className="mb-1.5 flex items-baseline gap-1">
                  <Label htmlFor={`field-${field.key}`}>{field.label}</Label>
                  {field.required ? <span className="text-destructive">*</span> : null}
                </div>
                <FieldControl
                  field={field}
                  value={values[field.key]}
                  onChange={setField}
                  disabled={locked}
                />
              </div>
            ))}
          </div>
        </>
      )}

      {section.attachmentRequired &&
      section.key !== "hull_condition" &&
      section.key !== "tank_condition" &&
      section.key !== "tailshaft" &&
      section.key !== "rudder" ? (
        <p className="text-xs text-muted-foreground">
          Attachments required — note file references or upload links in the photos field.
        </p>
      ) : null}

      {section.key === "painting" ? (
        <PaintingAreasPanel values={values} dryDockProjectId={dryDockProjectId} />
      ) : null}

      {!locked ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={saving} onClick={() => void save("draft")}>
            Save draft
          </Button>
          <Button type="button" disabled={saving} onClick={() => void save("submitted")}>
            Submit for review
          </Button>
          {submission?.status === "draft" ? (
            <Button
              type="button"
              variant="destructive"
              disabled={saving}
              onClick={() => void patchAction("delete")}
            >
              Delete draft
            </Button>
          ) : null}
          {submission && submission.status !== "draft" && submission.status !== "inactive" ? (
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => void patchAction("deactivate")}
            >
              Deactivate
            </Button>
          ) : null}
        </div>
      ) : null}

      {submission?.reviewNotes ? (
        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          <p className="font-medium">Review notes</p>
          <p className="text-muted-foreground">{submission.reviewNotes}</p>
        </div>
      ) : null}
    </div>
  );
}
