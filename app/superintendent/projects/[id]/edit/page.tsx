"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import {
  EntityFormActions,
  useEntityFormSubmit,
} from "@/components/superintendent/EntityListPage";
import { TenderProjectSelect } from "@/components/superintendent/TenderProjectSelect";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePickerField, parseDateValue } from "@/components/ui/DatePickerField";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LabeledSelect } from "@/components/ui/LabeledSelect";
import {
  DD_STATUS_TRANSITIONS,
  getStatusLabel,
} from "@/lib/superintendent/engine/statusWorkflow";
import type { DryDockProjectStatus } from "@prisma/client";
import { useMemo } from "react";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";
export const dynamic = "force-dynamic";

type ProjectForm = {
  name: string;
  referenceCode: string | null;
  status: string;
  vesselId: string;
  projectId: string | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  selectedYard: string | null;
  budgetTotal: number | null;
  quotedTotal: number | null;
  actualTotal: number | null;
  progressPct: number | null;
  notes: string | null;
};

function toDateInput(value: string | null): string {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

export default function EditProjectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<ProjectForm | null>(null);
  const [status, setStatus] = useState("planning");
  const [projectId, setProjectId] = useState("");
  const [plannedStart, setPlannedStart] = useState("");
  const [plannedEnd, setPlannedEnd] = useState("");
  const [actualStart, setActualStart] = useState("");
  const [actualEnd, setActualEnd] = useState("");
  const statusItems = useMemo(() => {
    const current = status as DryDockProjectStatus;
    const allowed = DD_STATUS_TRANSITIONS[current] ?? [];
    const values = new Set<DryDockProjectStatus>([current, ...allowed]);
    return [...values].map((v) => ({ value: v, label: getStatusLabel(v) }));
  }, [status]);
  const { saving, error, submit } = useEntityFormSubmit(
    "/api/superintendent/projects",
    "edit",
    id,
    `/superintendent/projects/${id}`,
  );

  useEffect(() => {
    void fetch(`/api/superintendent/projects/${id}`)
      .then((r) => r.json())
      .then((d) => {
        const p = d.project;
        if (p) {
          setProject(p);
          setStatus(p.status);
          setProjectId(p.projectId ?? "");
          setPlannedStart(toDateInput(p.plannedStart));
          setPlannedEnd(toDateInput(p.plannedEnd));
          setActualStart(toDateInput(p.actualStart));
          setActualEnd(toDateInput(p.actualEnd));
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

  if (!project) {
    return (
      <PageShell>
        <p className="text-sm text-destructive">Project not found.</p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader title="Edit project" description={project.name} />

      <Card>
        <CardHeader>
          <CardTitle>Project details</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              void submit({
                projectId: projectId || null,
                name: form.get("name") as string,
                status,
                plannedStart: plannedStart || null,
                plannedEnd: plannedEnd || null,
                actualStart: actualStart || null,
                actualEnd: actualEnd || null,
                selectedYard: (form.get("selectedYard") as string) || null,
                budgetTotal: form.get("budgetTotal") ? Number(form.get("budgetTotal")) : null,
                quotedTotal: form.get("quotedTotal") ? Number(form.get("quotedTotal")) : null,
                actualTotal: form.get("actualTotal") ? Number(form.get("actualTotal")) : null,
                progressPct: form.get("progressPct") ? Number(form.get("progressPct")) : null,
                notes: (form.get("notes") as string) || null,
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="name">Project name *</Label>
              <Input id="name" name="name" defaultValue={project.name} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="projectId">Project ID</Label>
              <Input
                id="projectId"
                value={project.referenceCode ?? "—"}
                disabled
                readOnly
                className="font-mono"
              />
            </div>
            {project.vesselId ? (
              <TenderProjectSelect
                vesselId={project.vesselId}
                value={projectId}
                onChange={setProjectId}
              />
            ) : null}
            <div className="space-y-2">
              <Label>Status</Label>
              <LabeledSelect items={statusItems} value={status} onValueChange={setStatus} className="w-full" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <DatePickerField
                id="plannedStart"
                name="plannedStart"
                label="Planned start"
                value={plannedStart}
                onValueChange={setPlannedStart}
                toDate={parseDateValue(plannedEnd)}
              />
              <DatePickerField
                id="plannedEnd"
                name="plannedEnd"
                label="Planned end"
                value={plannedEnd}
                onValueChange={setPlannedEnd}
                fromDate={parseDateValue(plannedStart)}
              />
              <DatePickerField
                id="actualStart"
                name="actualStart"
                label="Actual start"
                value={actualStart}
                onValueChange={setActualStart}
                toDate={parseDateValue(actualEnd)}
              />
              <DatePickerField
                id="actualEnd"
                name="actualEnd"
                label="Actual end"
                value={actualEnd}
                onValueChange={setActualEnd}
                fromDate={parseDateValue(actualStart)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="selectedYard">Selected yard</Label>
              <Input id="selectedYard" name="selectedYard" defaultValue={project.selectedYard ?? ""} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="budgetTotal">Budget total</Label>
                <Input id="budgetTotal" name="budgetTotal" type="number" defaultValue={project.budgetTotal ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quotedTotal">Quoted total</Label>
                <Input id="quotedTotal" name="quotedTotal" type="number" defaultValue={project.quotedTotal ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="actualTotal">Actual total</Label>
                <Input id="actualTotal" name="actualTotal" type="number" defaultValue={project.actualTotal ?? ""} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="progressPct">Progress %</Label>
              <Input id="progressPct" name="progressPct" type="number" min={0} max={100} defaultValue={project.progressPct ?? ""} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={3} defaultValue={project.notes ?? ""} />
            </div>
            <EntityFormActions saving={saving} />
          </form>
        </CardContent>
      </Card>
    </PageShell>
  );
}
