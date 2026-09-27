"use client";

import { useState } from "react";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import {
  EntityFormActions,
  useEntityFormSubmit,
} from "@/components/superintendent/EntityListPage";
import { DryDockProjectSelect } from "@/components/superintendent/DryDockProjectSelect";
import { SteelRenewalScopePanel } from "@/components/superintendent/SteelRenewalScopePanel";
import { ThicknessMeasurementScopePanel } from "@/components/superintendent/ThicknessMeasurementScopePanel";
import { TankInspectionScopePanel } from "@/components/superintendent/TankInspectionScopePanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LabeledSelect } from "@/components/ui/LabeledSelect";
import { JOB_CATEGORY_ITEMS, JOB_PRIORITY_ITEMS, JOB_STATUS_ITEMS } from "@/lib/superintendent/constants";
import {
  createEmptySteelRenewalLine,
  isSteelRenewalJob,
  serializeSteelRenewalScope,
  validateSteelRenewalScope,
  type SteelRenewalScope,
} from "@/lib/superintendent/steelRenewalScope";
import {
  createEmptyThicknessMeasurementLine,
  isThicknessMeasurementJob,
  serializeThicknessMeasurementScope,
  validateThicknessMeasurementScope,
  type ThicknessMeasurementScope,
} from "@/lib/superintendent/thicknessMeasurementScope";
import {
  createEmptyTankInspectionLine,
  isTankInspectionJob,
  serializeTankInspectionScope,
  validateTankInspectionScope,
  type TankInspectionScope,
} from "@/lib/superintendent/tankInspectionScope";

export const dynamic = "force-dynamic";

export default function NewPage() {
  const [projectId, setProjectId] = useState("");
  const [category, setCategory] = useState("miscellaneous");
  const [priority, setPriority] = useState("medium");
  const [status, setStatus] = useState("planned");
  const [title, setTitle] = useState("");
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
  const [formError, setFormError] = useState<string | null>(null);
  const { saving, error, submit } = useEntityFormSubmit(
    "/api/superintendent/jobs",
    "create",
    undefined,
    "/superintendent/jobs",
  );

  const showSteelScope = isSteelRenewalJob({ category, title });
  const showThicknessScope = isThicknessMeasurementJob({ category, title });
  const showTankScope = isTankInspectionJob({ category, title });

  return (
    <PageShell>
      <PageHeader title="New record" description="Scope jobs by category and status." />

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
              }

              void submit({
                dryDockProjectId: projectId,
                title: form.get("title") as string,
                category,
                priority,
                status,
                jobCode: (form.get("jobCode") as string) || null,
                workshop: (form.get("workshop") as string) || null,
                description,
              });
            }}
          >
            <DryDockProjectSelect value={projectId} onChange={setProjectId} required />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  name="title"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    showSteelScope
                      ? "Steel Renewal"
                      : showThicknessScope
                        ? "Thickness Measurement"
                        : showTankScope
                          ? "Tank Inspection"
                          : "Job title"
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Category *</Label>
                <LabeledSelect
                  items={JOB_CATEGORY_ITEMS}
                  value={category}
                  onValueChange={(v) => setCategory(v || "miscellaneous")}
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
                  onValueChange={(v) => setPriority(v || "medium")}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <LabeledSelect
                  items={JOB_STATUS_ITEMS}
                  value={status}
                  onValueChange={(v) => setStatus(v || "planned")}
                  className="w-full"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="jobCode">Job code</Label>
                <Input id="jobCode" name="jobCode" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="workshop">Workshop</Label>
                <Input
                  id="workshop"
                  name="workshop"
                  placeholder="e.g. Hull, Machinery, Electrical"
                  defaultValue={
                    showSteelScope ? "Steel" : showThicknessScope ? "Hull" : showTankScope ? "Tank" : ""
                  }
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
            ) : (
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" rows={3} />
              </div>
            )}

            <EntityFormActions saving={saving} />
          </form>
        </CardContent>
      </Card>
    </PageShell>
  );
}
