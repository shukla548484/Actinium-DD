"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LabeledSelect } from "@/components/ui/LabeledSelect";
import { DatePickerField } from "@/components/ui/DatePickerField";
import type { InputFieldDef, InputSectionDef } from "@/lib/superintendent/inputCatalog/types";
import type { InputSubmissionDto } from "@/lib/db/superintendent/inputs";
import { PaintingAreasPanel } from "@/components/superintendent/PaintingAreasPanel";

type Props = {
  section: InputSectionDef;
  submission: InputSubmissionDto | null;
  dryDockProjectId: string;
  onSaved: (submission: InputSubmissionDto | null) => void;
  readOnly?: boolean;
  enteredByRole?: InputSectionDef["enteredBy"];
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
}: Props) {
  const [values, setValues] = useState<Record<string, unknown>>(
    () => (submission?.valuesJson as Record<string, unknown>) ?? {},
  );
  const [enteredByName, setEnteredByName] = useState(submission?.enteredByName ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const role = enteredByRole ?? section.enteredBy;

  const setField = useCallback((key: string, val: unknown) => {
    setValues((prev) => ({ ...prev, [key]: val }));
  }, []);

  const save = async (status: "draft" | "submitted") => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/superintendent/projects/${dryDockProjectId}/inputs/${section.key}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sectionKey: section.key,
            valuesJson: values,
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
        {submission ? (
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
            {STATUS_LABELS[submission.status] ?? submission.status}
          </span>
        ) : (
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            Not started
          </span>
        )}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

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
            className={field.type === "textarea" || field.type === "photos_note" ? "sm:col-span-2" : ""}
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

      {section.attachmentRequired ? (
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
