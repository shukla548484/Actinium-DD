"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import {
  EntityFormActions,
  useEntityFormSubmit,
} from "@/components/superintendent/EntityListPage";
import { JobAttachmentsPanel } from "@/components/superintendent/JobAttachmentsPanel";
import { SteelRenewalScopePanel } from "@/components/superintendent/SteelRenewalScopePanel";
import { ThicknessMeasurementScopePanel } from "@/components/superintendent/ThicknessMeasurementScopePanel";
import { TankInspectionScopePanel } from "@/components/superintendent/TankInspectionScopePanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LabeledSelect } from "@/components/ui/LabeledSelect";
import { JOB_CATEGORY_ITEMS, JOB_PRIORITY_ITEMS, JOB_STATUS_ITEMS } from "@/lib/superintendent/constants";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";
import { PaintingInputJobBanner } from "@/components/superintendent/PaintingScopeJobLinks";
import {
  SeaValveInputJobBanner,
  SeaValveJobScopeSection,
} from "@/components/superintendent/SeaValveJobScopeSection";
import {
  isPaintingInputJob,
  parsePaintingAreaFromJobDescription,
} from "@/lib/superintendent/paintingScopeJobs";
import {
  buildSeaValveJobDescription,
  isSeaValveInputJob,
} from "@/lib/superintendent/seaValveScopeJobs";
import { sanitizeSeaValveValues, validateSeaValves } from "@/lib/superintendent/seaValves";
import type { InputSubmissionDto } from "@/lib/db/superintendent/inputs";
import {
  createEmptySteelRenewalLine,
  isSteelRenewalJob,
  parseSteelRenewalScope,
  serializeSteelRenewalScope,
  validateSteelRenewalScope,
  type SteelRenewalScope,
} from "@/lib/superintendent/steelRenewalScope";
import {
  createEmptyThicknessMeasurementLine,
  isThicknessMeasurementJob,
  parseThicknessMeasurementScope,
  serializeThicknessMeasurementScope,
  validateThicknessMeasurementScope,
  type ThicknessMeasurementScope,
} from "@/lib/superintendent/thicknessMeasurementScope";
import {
  createEmptyTankInspectionLine,
  isTankInspectionJob,
  parseTankInspectionScope,
  serializeTankInspectionScope,
  validateTankInspectionScope,
  type TankInspectionScope,
} from "@/lib/superintendent/tankInspectionScope";
import { PAINTING_AREA_DEFS } from "@/lib/superintendent/paintingCoating";

export const dynamic = "force-dynamic";

type Item = {
  id: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  dryDockProjectId: string;
  jobCode: string | null;
  workshop: string | null;
  description: string | null;
};

function initialSteelScope(description: string | null): SteelRenewalScope {
  const parsed = parseSteelRenewalScope(description);
  if (parsed.lines.length === 0) {
    return { ...parsed, lines: [createEmptySteelRenewalLine()] };
  }
  return parsed;
}

function initialThicknessScope(description: string | null): ThicknessMeasurementScope {
  const parsed = parseThicknessMeasurementScope(description);
  if (parsed.lines.length === 0) {
    return { ...parsed, lines: [createEmptyThicknessMeasurementLine()] };
  }
  return parsed;
}

function initialTankScope(description: string | null): TankInspectionScope {
  const parsed = parseTankInspectionScope(description);
  if (parsed.lines.length === 0) {
    return { ...parsed, lines: [createEmptyTankInspectionLine()] };
  }
  return parsed;
}

export default function EditPage() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<Item | null>(null);
  const [category, setCategory] = useState("miscellaneous");
  const [priority, setPriority] = useState("medium");
  const [status, setStatus] = useState("planned");
  const [steelScope, setSteelScope] = useState<SteelRenewalScope>({
    lines: [createEmptySteelRenewalLine()],
    notes: "",
  });
  const [thicknessScope, setThicknessScope] = useState<ThicknessMeasurementScope>({
    lines: [createEmptyThicknessMeasurementLine()],
    notes: "",
  });
  const [tankScope, setTankScope] = useState<TankInspectionScope>({
    lines: [createEmptyTankInspectionLine()],
    notes: "",
  });
  const [seaValveValues, setSeaValveValues] = useState<Record<string, unknown>>({ valves: [] });
  const [seaValveEnteredByName, setSeaValveEnteredByName] = useState("");
  const [seaValveSubmission, setSeaValveSubmission] = useState<InputSubmissionDto | null>(null);
  const [inputSaving, setInputSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const { saving, error, submit } = useEntityFormSubmit(
    "/api/superintendent/jobs",
    "edit",
    id,
    "/superintendent/jobs",
  );

  useEffect(() => {
    void fetch(`/api/superintendent/jobs/${id}`)
      .then((r) => r.json())
      .then((d) => {
        const row = d.job as Item | undefined;
        if (row) {
          setItem(row);
          setCategory(row.category);
          setPriority(row.priority);
          setStatus(row.status);
          if (isSteelRenewalJob(row)) {
            setSteelScope(initialSteelScope(row.description));
          }
          if (isThicknessMeasurementJob(row)) {
            setThicknessScope(initialThicknessScope(row.description));
          }
          if (isTankInspectionJob(row)) {
            setTankScope(initialTankScope(row.description));
          }
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <PageShell>
        <ActiniumLoadingState size="sm" />
      </PageShell>
    );
  }

  if (!item) {
    return (
      <PageShell>
        <p className="text-sm text-destructive">Record not found.</p>
      </PageShell>
    );
  }

  const showSteelScope = isSteelRenewalJob({ ...item, category });
  const showThicknessScope = isThicknessMeasurementJob(item);
  const showTankScope = isTankInspectionJob({ ...item, category });
  const showSeaValveScope = isSeaValveInputJob(item);
  const showPaintingBanner = isPaintingInputJob(item.description);
  const dryDockProjectId = item.dryDockProjectId;
  const seaValveLocked =
    seaValveSubmission?.status === "approved" ||
    seaValveSubmission?.status === "inactive";

  async function saveSeaValveInput(): Promise<string | null> {
    const payloadValues = sanitizeSeaValveValues(seaValveValues);
    const validationError = validateSeaValves(payloadValues);
    if (validationError) {
      setFormError(validationError);
      return null;
    }

    setInputSaving(true);
    try {
      const res = await fetch(
        `/api/superintendent/projects/${dryDockProjectId}/inputs/sea_valves`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sectionKey: "sea_valves",
            valuesJson: payloadValues,
            enteredByRole: "vessel",
            enteredByName: seaValveEnteredByName.trim() || null,
            status: seaValveSubmission?.status ?? "draft",
          }),
        },
      );
      const data = (await res.json()) as { submission?: InputSubmissionDto; error?: string };
      if (!res.ok) {
        setFormError(data.error ?? "Failed to save sea valves");
        return null;
      }
      if (data.submission) {
        setSeaValveSubmission(data.submission);
        setSeaValveValues(data.submission.valuesJson ?? payloadValues);
      }
      return buildSeaValveJobDescription(payloadValues);
    } catch {
      setFormError("Failed to save sea valves");
      return null;
    } finally {
      setInputSaving(false);
    }
  }

  const savingAll = saving || inputSaving;

  return (
    <PageShell>
      <PageHeader title="Edit record" description={item.title} />

      {showPaintingBanner ? (
        <PaintingInputJobBanner
          dryDockProjectId={item.dryDockProjectId}
          areaLabel={
            PAINTING_AREA_DEFS.find(
              (d) => d.id === parsePaintingAreaFromJobDescription(item.description),
            )?.label
          }
        />
      ) : null}

      {showSeaValveScope ? <SeaValveInputJobBanner dryDockProjectId={dryDockProjectId} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          {error || formError ? (
            <p className="mb-4 text-sm text-destructive">{formError ?? error}</p>
          ) : null}
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setFormError(null);
              const form = new FormData(e.currentTarget);

              void (async () => {
                let description = (form.get("description") as string) || null;

                if (showSteelScope) {
                  const validationError = validateSteelRenewalScope(steelScope);
                  if (validationError) {
                    setFormError(validationError);
                    return;
                  }
                  description = serializeSteelRenewalScope(steelScope);
                } else if (showThicknessScope) {
                  const validationError = validateThicknessMeasurementScope(thicknessScope);
                  if (validationError) {
                    setFormError(validationError);
                    return;
                  }
                  description = serializeThicknessMeasurementScope(thicknessScope);
                } else if (showTankScope) {
                  const validationError = validateTankInspectionScope(tankScope);
                  if (validationError) {
                    setFormError(validationError);
                    return;
                  }
                  description = serializeTankInspectionScope(tankScope);
                } else if (showSeaValveScope) {
                  const nextDescription = await saveSeaValveInput();
                  if (!nextDescription) return;
                  description = nextDescription;
                }

                await submit({
                  title: form.get("title") as string,
                  category,
                  priority,
                  status,
                  jobCode: (form.get("jobCode") as string) || null,
                  workshop: (form.get("workshop") as string) || null,
                  description,
                });
              })();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input id="title" name="title" defaultValue={item.title} required />
              </div>
              <div className="space-y-2">
                <Label>Category *</Label>
                <LabeledSelect
                  items={JOB_CATEGORY_ITEMS}
                  value={category}
                  onValueChange={(v) => setCategory(v || item.category)}
                  className="w-full"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Priority</Label>
                <LabeledSelect
                  items={JOB_PRIORITY_ITEMS}
                  value={priority}
                  onValueChange={(v) => setPriority(v || item.priority)}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <LabeledSelect
                  items={JOB_STATUS_ITEMS}
                  value={status}
                  onValueChange={(v) => setStatus(v || item.status)}
                  className="w-full"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="jobCode">Job code</Label>
                <Input id="jobCode" name="jobCode" defaultValue={item.jobCode ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="workshop">Workshop</Label>
                <Input
                  id="workshop"
                  name="workshop"
                  defaultValue={item.workshop ?? ""}
                  placeholder="e.g. Hull, Machinery, Electrical"
                />
              </div>
            </div>

            {showSteelScope ? (
              <SteelRenewalScopePanel scope={steelScope} onChange={setSteelScope} />
            ) : showThicknessScope ? (
              <ThicknessMeasurementScopePanel
                scope={thicknessScope}
                onChange={setThicknessScope}
              />
            ) : showTankScope ? (
              <TankInspectionScopePanel scope={tankScope} onChange={setTankScope} />
            ) : showSeaValveScope ? (
              <SeaValveJobScopeSection
                dryDockProjectId={dryDockProjectId}
                values={seaValveValues}
                onChange={setSeaValveValues}
                enteredByName={seaValveEnteredByName}
                onEnteredByNameChange={setSeaValveEnteredByName}
                disabled={seaValveLocked}
                onSubmissionLoaded={setSeaValveSubmission}
              />
            ) : (
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  rows={3}
                  defaultValue={item.description ?? ""}
                />
              </div>
            )}

            <EntityFormActions saving={savingAll} />
          </form>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Photos & attachments</CardTitle>
        </CardHeader>
        <CardContent>
          <JobAttachmentsPanel jobId={id} />
        </CardContent>
      </Card>
    </PageShell>
  );
}
