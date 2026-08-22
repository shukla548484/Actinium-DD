"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LabeledSelect } from "@/components/ui/LabeledSelect";
import { Textarea } from "@/components/ui/textarea";
import {
  areasForJobType,
  DD_SIMPLE_PAINT_JOB_TYPES,
  DD_SIMPLE_PREP_METHODS,
  defaultTitleForJobType,
  paintJobTypeLabel,
} from "@/lib/dryDockJobs/catalog";
import type { DdSimpleJobDto } from "@/lib/dryDockJobs/types";
import { notify } from "@/lib/notify";

type PrepDraft = {
  key: string;
  areaCode: string;
  prepMethodCode: string;
  areaSqm: string;
  notes: string;
};

type CoatDraft = {
  key: string;
  areaCode: string;
  primerCoats: string;
  binderCoats: string;
  finishCoats: string;
  dftRequired: boolean;
  dftUm: string;
  notes: string;
};

type Props = {
  vesselId: string | null;
  readOnly?: boolean;
  initial?: DdSimpleJobDto | null;
  defaultCreatedByName?: string;
};

function newKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyPrep(areaCode = "topside"): PrepDraft {
  return {
    key: newKey(),
    areaCode,
    prepMethodCode: "sa2",
    areaSqm: "",
    notes: "",
  };
}

function emptyCoat(areaCode = "topside"): CoatDraft {
  return {
    key: newKey(),
    areaCode,
    primerCoats: "1",
    binderCoats: "0",
    finishCoats: "1",
    dftRequired: false,
    dftUm: "",
    notes: "",
  };
}

export function SimpleJobForm({
  vesselId,
  readOnly = false,
  initial = null,
  defaultCreatedByName = "",
}: Props) {
  const router = useRouter();
  const isEdit = Boolean(initial);
  const [jobType, setJobType] = useState(initial?.jobType ?? "hull_paint");
  const [title, setTitle] = useState(initial?.title ?? defaultTitleForJobType("hull_paint"));
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [priority, setPriority] = useState(initial?.priority ?? "medium");
  const [createdByName, setCreatedByName] = useState(
    initial?.createdByName ?? defaultCreatedByName,
  );
  const [prepLines, setPrepLines] = useState<PrepDraft[]>(
    initial?.prepLines?.length
      ? initial.prepLines.map((line) => ({
          key: line.id,
          areaCode: line.areaCode,
          prepMethodCode: line.prepMethodCode,
          areaSqm: String(line.areaSqm),
          notes: line.notes ?? "",
        }))
      : [emptyPrep()],
  );
  const [coatLines, setCoatLines] = useState<CoatDraft[]>(
    initial?.coatLines?.length
      ? initial.coatLines.map((line) => ({
          key: line.id,
          areaCode: line.areaCode,
          primerCoats: String(line.primerCoats),
          binderCoats: String(line.binderCoats),
          finishCoats: String(line.finishCoats),
          dftRequired: line.dftRequired,
          dftUm: line.dftUm != null ? String(line.dftUm) : "",
          notes: line.notes ?? "",
        }))
      : [],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const areaItems = useMemo(
    () => areasForJobType(jobType).map((a) => ({ value: a.code, label: a.label })),
    [jobType],
  );
  const jobTypeItems = DD_SIMPLE_PAINT_JOB_TYPES.map((t) => ({
    value: t.code,
    label: t.label,
  }));
  const prepItems = DD_SIMPLE_PREP_METHODS.map((m) => ({
    value: m.code,
    label: m.label,
  }));

  function onJobTypeChange(next: string) {
    setJobType(next);
    if (!isEdit || title === defaultTitleForJobType(jobType) || !title.trim()) {
      setTitle(defaultTitleForJobType(next));
    }
    const areas = areasForJobType(next);
    const fallback = areas[0]?.code ?? "general";
    setPrepLines((rows) =>
      rows.map((row) =>
        areas.some((a) => a.code === row.areaCode) ? row : { ...row, areaCode: fallback },
      ),
    );
    setCoatLines((rows) =>
      rows.map((row) =>
        areas.some((a) => a.code === row.areaCode) ? row : { ...row, areaCode: fallback },
      ),
    );
  }

  function buildPayload(submit: boolean) {
    return {
      vesselId: vesselId!,
      family: "paint" as const,
      jobType,
      title: title.trim() || paintJobTypeLabel(jobType),
      notes: notes.trim() || null,
      priority,
      createdByName: createdByName.trim() || null,
      prepLines: prepLines.map((line, index) => ({
        areaCode: line.areaCode,
        prepMethodCode: line.prepMethodCode as (typeof DD_SIMPLE_PREP_METHODS)[number]["code"],
        areaSqm: Number(line.areaSqm),
        notes: line.notes.trim() || null,
        sortOrder: index,
      })),
      coatLines: coatLines.map((line, index) => ({
        areaCode: line.areaCode,
        primerCoats: Number(line.primerCoats || 0),
        binderCoats: Number(line.binderCoats || 0),
        finishCoats: Number(line.finishCoats || 0),
        dftRequired: line.dftRequired,
        dftUm: line.dftRequired && line.dftUm ? Number(line.dftUm) : null,
        notes: line.notes.trim() || null,
        sortOrder: index,
      })),
      submit,
    };
  }

  async function save(submit: boolean) {
    if (!vesselId || readOnly) return;
    setBusy(true);
    setError(null);
    try {
      const payload = buildPayload(submit);
      const url = isEdit
        ? `/api/ship-access/simple-jobs/${initial!.id}`
        : "/api/ship-access/simple-jobs";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isEdit
            ? {
                jobType: payload.jobType,
                title: payload.title,
                notes: payload.notes,
                priority: payload.priority,
                createdByName: payload.createdByName,
                prepLines: payload.prepLines,
                coatLines: payload.coatLines,
                status: submit ? "submitted" : "draft",
              }
            : payload,
        ),
      });
      const data = (await res.json()) as { job?: DdSimpleJobDto; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Save failed");
        notify.error(data.error ?? "Save failed");
        return;
      }
      notify.success(submit ? "Job submitted" : "Job saved");
      router.push("/ship-access/dry-dock/simple-jobs");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const disabled = readOnly || busy || !vesselId;

  return (
    <div className="space-y-6">
      {!vesselId ? (
        <p className="text-sm text-muted-foreground">Select a vessel to define a job.</p>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Card>
        <CardHeader>
          <CardTitle>Paint Jobs</CardTitle>
          <CardDescription>
            Select job type, then define prep by area and Sa grade (cost driver), then coats.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Job type</p>
            <LabeledSelect
              items={jobTypeItems}
              value={jobType}
              onValueChange={onJobTypeChange}
              disabled={disabled}
            />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Priority</p>
            <LabeledSelect
              items={[
                { value: "low", label: "Low" },
                { value: "medium", label: "Medium" },
                { value: "high", label: "High" },
                { value: "critical", label: "Critical" },
              ]}
              value={priority}
              onValueChange={(v) => setPriority(v as typeof priority)}
              disabled={disabled}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <p className="text-xs font-medium text-muted-foreground">Title</p>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={disabled}
              placeholder="Job title"
            />
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Prepared by</p>
            <Input
              value={createdByName}
              onChange={(e) => setCreatedByName(e.target.value)}
              disabled={disabled}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <p className="text-xs font-medium text-muted-foreground">Notes</p>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={disabled}
              rows={3}
              placeholder="Optional scope notes"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Hull / surface preparation</CardTitle>
            <CardDescription>
              Each line is priced as area × prep grade (Sa1, Sa2, hydroblasting, …) × m².
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => setPrepLines((rows) => [...rows, emptyPrep(areaItems[0]?.value)])}
          >
            Add prep line
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {prepLines.length === 0 ? (
            <p className="text-sm text-muted-foreground">No prep lines yet.</p>
          ) : (
            prepLines.map((line, index) => (
              <div
                key={line.key}
                className="grid gap-2 rounded-md border p-3 sm:grid-cols-12 sm:items-end"
              >
                <div className="space-y-1 sm:col-span-3">
                  <p className="text-xs text-muted-foreground">Area</p>
                  <LabeledSelect
                    items={areaItems}
                    value={line.areaCode}
                    onValueChange={(v) =>
                      setPrepLines((rows) =>
                        rows.map((r, i) => (i === index ? { ...r, areaCode: v } : r)),
                      )
                    }
                    disabled={disabled}
                  />
                </div>
                <div className="space-y-1 sm:col-span-3">
                  <p className="text-xs text-muted-foreground">Prep / Sa grade</p>
                  <LabeledSelect
                    items={prepItems}
                    value={line.prepMethodCode}
                    onValueChange={(v) =>
                      setPrepLines((rows) =>
                        rows.map((r, i) => (i === index ? { ...r, prepMethodCode: v } : r)),
                      )
                    }
                    disabled={disabled}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <p className="text-xs text-muted-foreground">Area m²</p>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={line.areaSqm}
                    onChange={(e) =>
                      setPrepLines((rows) =>
                        rows.map((r, i) => (i === index ? { ...r, areaSqm: e.target.value } : r)),
                      )
                    }
                    disabled={disabled}
                  />
                </div>
                <div className="space-y-1 sm:col-span-3">
                  <p className="text-xs text-muted-foreground">Notes</p>
                  <Input
                    value={line.notes}
                    onChange={(e) =>
                      setPrepLines((rows) =>
                        rows.map((r, i) => (i === index ? { ...r, notes: e.target.value } : r)),
                      )
                    }
                    disabled={disabled}
                  />
                </div>
                <div className="sm:col-span-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={disabled || prepLines.length <= 1}
                    onClick={() => setPrepLines((rows) => rows.filter((_, i) => i !== index))}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle>Coating system</CardTitle>
            <CardDescription>Primer / Binder / Finish coat counts and DFT (optional).</CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => setCoatLines((rows) => [...rows, emptyCoat(areaItems[0]?.value)])}
          >
            Add coat line
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {coatLines.length === 0 ? (
            <p className="text-sm text-muted-foreground">No coating lines (prep-only job is allowed).</p>
          ) : (
            coatLines.map((line, index) => (
              <div key={line.key} className="space-y-2 rounded-md border p-3">
                <div className="grid gap-2 sm:grid-cols-12 sm:items-end">
                  <div className="space-y-1 sm:col-span-3">
                    <p className="text-xs text-muted-foreground">Area</p>
                    <LabeledSelect
                      items={areaItems}
                      value={line.areaCode}
                      onValueChange={(v) =>
                        setCoatLines((rows) =>
                          rows.map((r, i) => (i === index ? { ...r, areaCode: v } : r)),
                        )
                      }
                      disabled={disabled}
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <p className="text-xs text-muted-foreground">Primer</p>
                    <Input
                      type="number"
                      min={0}
                      value={line.primerCoats}
                      onChange={(e) =>
                        setCoatLines((rows) =>
                          rows.map((r, i) =>
                            i === index ? { ...r, primerCoats: e.target.value } : r,
                          ),
                        )
                      }
                      disabled={disabled}
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <p className="text-xs text-muted-foreground">Binder</p>
                    <Input
                      type="number"
                      min={0}
                      value={line.binderCoats}
                      onChange={(e) =>
                        setCoatLines((rows) =>
                          rows.map((r, i) =>
                            i === index ? { ...r, binderCoats: e.target.value } : r,
                          ),
                        )
                      }
                      disabled={disabled}
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <p className="text-xs text-muted-foreground">Finish</p>
                    <Input
                      type="number"
                      min={0}
                      value={line.finishCoats}
                      onChange={(e) =>
                        setCoatLines((rows) =>
                          rows.map((r, i) =>
                            i === index ? { ...r, finishCoats: e.target.value } : r,
                          ),
                        )
                      }
                      disabled={disabled}
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-3">
                    <p className="text-xs text-muted-foreground">DFT required</p>
                    <LabeledSelect
                      items={[
                        { value: "no", label: "No" },
                        { value: "yes", label: "Yes" },
                      ]}
                      value={line.dftRequired ? "yes" : "no"}
                      onValueChange={(v) =>
                        setCoatLines((rows) =>
                          rows.map((r, i) =>
                            i === index ? { ...r, dftRequired: v === "yes" } : r,
                          ),
                        )
                      }
                      disabled={disabled}
                    />
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-12 sm:items-end">
                  {line.dftRequired ? (
                    <div className="space-y-1 sm:col-span-2">
                      <p className="text-xs text-muted-foreground">DFT µm</p>
                      <Input
                        type="number"
                        min={0}
                        value={line.dftUm}
                        onChange={(e) =>
                          setCoatLines((rows) =>
                            rows.map((r, i) => (i === index ? { ...r, dftUm: e.target.value } : r)),
                          )
                        }
                        disabled={disabled}
                      />
                    </div>
                  ) : null}
                  <div className="space-y-1 sm:col-span-8">
                    <p className="text-xs text-muted-foreground">Notes</p>
                    <Input
                      value={line.notes}
                      onChange={(e) =>
                        setCoatLines((rows) =>
                          rows.map((r, i) => (i === index ? { ...r, notes: e.target.value } : r)),
                        )
                      }
                      disabled={disabled}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={disabled}
                      onClick={() => setCoatLines((rows) => rows.filter((_, i) => i !== index))}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {!readOnly ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={disabled} onClick={() => void save(false)}>
            Save draft
          </Button>
          <Button type="button" disabled={disabled} onClick={() => void save(true)}>
            Submit for review
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => router.push("/ship-access/dry-dock/simple-jobs")}
          >
            Cancel
          </Button>
        </div>
      ) : null}
    </div>
  );
}
