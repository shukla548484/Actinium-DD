"use client";

import { useCallback, useState } from "react";
import {
  EntityFormActions,
  useEntityFormSubmit,
} from "@/components/superintendent/EntityListPage";
import { ProjectIdPreviewField } from "@/components/superintendent/ProjectIdPreviewField";
import { ProjectTypeSelect } from "@/components/superintendent/ProjectTypeSelect";
import { TenderProjectSelect } from "@/components/superintendent/TenderProjectSelect";
import { VesselContextFields } from "@/components/superintendent/VesselContextFields";
import { VesselSelect } from "@/components/superintendent/VesselSelect";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePickerField, parseDateValue } from "@/components/ui/DatePickerField";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LabeledSelect } from "@/components/ui/LabeledSelect";
import {
  DD_PROJECT_CREATE_STATUS_ITEMS,
  DD_PROJECT_PRIORITY_ITEMS,
} from "@/lib/superintendent/constants";
import type { DryDockProjectType } from "@prisma/client";

type VesselReadonly = { name: string; code: string };

type Props = {
  vesselId: string;
  onVesselIdChange?: (id: string) => void;
  vesselReadonly?: VesselReadonly | null;
  /** Fallback when browser history is empty (defaults to parent URL). */
  cancelFallbackHref?: string;
  successHref: string;
};

export function DryDockProjectCreateForm({
  vesselId,
  onVesselIdChange,
  vesselReadonly,
  cancelFallbackHref,
  successHref,
}: Props) {
  const [projectId, setProjectId] = useState("");
  const [projectType, setProjectType] = useState<DryDockProjectType>("special_survey");
  const [priority, setPriority] = useState("medium");
  const [status, setStatus] = useState("draft");
  const [plannedStart, setPlannedStart] = useState("");
  const [plannedEnd, setPlannedEnd] = useState("");
  const [expectedSailing, setExpectedSailing] = useState("");
  const [classSociety, setClassSociety] = useState("");
  const handleClassSociety = useCallback((v: string) => setClassSociety(v), []);
  const { saving, error, submit } = useEntityFormSubmit(
    "/api/superintendent/projects",
    "create",
    undefined,
    successHref,
  );

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        void submit({
          vesselId,
          projectId: projectId || null,
          name: form.get("name") as string,
          projectType,
          priority,
          status,
          plannedStart: plannedStart || null,
          plannedEnd: plannedEnd || null,
          expectedSailing: expectedSailing || null,
          selectedYard: (form.get("selectedYard") as string) || null,
          shipyardCountry: (form.get("shipyardCountry") as string) || null,
          dockType: (form.get("dockType") as string) || null,
          currency: (form.get("currency") as string) || "USD",
          budgetTotal: form.get("budgetTotal") ? Number(form.get("budgetTotal")) : null,
          approvedBudget: form.get("approvedBudget") ? Number(form.get("approvedBudget")) : null,
          contingencyBudget: form.get("contingencyBudget")
            ? Number(form.get("contingencyBudget"))
            : null,
          offHireCost: form.get("offHireCost") ? Number(form.get("offHireCost")) : null,
          dryDockDays: form.get("dryDockDays") ? Number(form.get("dryDockDays")) : null,
          classSociety: (form.get("classSociety") as string) || classSociety || null,
          surveyType: (form.get("surveyType") as string) || null,
          mainScope: (form.get("mainScope") as string) || null,
          dockingReason: (form.get("dockingReason") as string) || null,
          portLocation: (form.get("portLocation") as string) || null,
          projectOwner: (form.get("projectOwner") as string) || null,
          notes: (form.get("notes") as string) || null,
        });
      }}
    >
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>Vessel & linkage</CardTitle>
            <CardDescription>Assigned vessel and optional tender project link.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {vesselReadonly !== undefined ? (
              <div className="space-y-2">
                <Label>Vessel</Label>
                <Input
                  value={
                    vesselReadonly
                      ? `${vesselReadonly.name} (${vesselReadonly.code})`
                      : "Loading…"
                  }
                  disabled
                  readOnly
                />
              </div>
            ) : (
              <VesselSelect
                value={vesselId}
                onChange={onVesselIdChange ?? (() => {})}
                required
              />
            )}
            <TenderProjectSelect
              vesselId={vesselId}
              value={projectId}
              onChange={setProjectId}
            />
            <VesselContextFields vesselId={vesselId} onClassSociety={handleClassSociety} />
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader>
            <CardTitle>Project identity</CardTitle>
            <CardDescription>Name, auto-generated ID, and initial status.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Project name *</Label>
              <Input id="name" name="name" required />
            </div>
            <ProjectIdPreviewField vesselId={vesselId} />
            <ProjectTypeSelect value={projectType} onChange={setProjectType} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Priority</Label>
                <LabeledSelect
                  items={DD_PROJECT_PRIORITY_ITEMS}
                  value={priority}
                  onValueChange={setPriority}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <LabeledSelect
                  items={DD_PROJECT_CREATE_STATUS_ITEMS}
                  value={status}
                  onValueChange={setStatus}
                  className="w-full"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
            <CardDescription>Planned dry dock window.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <DatePickerField
                id="plannedStart"
                name="plannedStart"
                label="Planned start"
                value={plannedStart}
                onValueChange={setPlannedStart}
                placeholder="Select start date"
                toDate={parseDateValue(plannedEnd)}
              />
              <DatePickerField
                id="plannedEnd"
                name="plannedEnd"
                label="Planned completion"
                value={plannedEnd}
                onValueChange={setPlannedEnd}
                placeholder="Select end date"
                fromDate={parseDateValue(plannedStart)}
              />
              <DatePickerField
                id="expectedSailing"
                name="expectedSailing"
                label="Expected sailing date"
                value={expectedSailing}
                onValueChange={setExpectedSailing}
                fromDate={parseDateValue(plannedEnd)}
              />
              <div className="space-y-2">
                <Label htmlFor="dryDockDays">Dry dock duration (days)</Label>
                <Input id="dryDockDays" name="dryDockDays" type="number" min={0} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader>
            <CardTitle>Commercial</CardTitle>
            <CardDescription>Shipyard selection and budget.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="selectedYard">Shipyard</Label>
                <Input id="selectedYard" name="selectedYard" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shipyardCountry">Country</Label>
                <Input id="shipyardCountry" name="shipyardCountry" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="portLocation">Port / location</Label>
                <Input id="portLocation" name="portLocation" placeholder="e.g. Singapore" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="projectOwner">Project owner</Label>
                <Input id="projectOwner" name="projectOwner" placeholder="Owner / operator contact" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dockType">Dock type</Label>
                <Input id="dockType" name="dockType" placeholder="e.g. Graving dock, Floating dock" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Input id="currency" name="currency" defaultValue="USD" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label htmlFor="budgetTotal">Budget total</Label>
                <Input id="budgetTotal" name="budgetTotal" type="number" min={0} step="0.01" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="approvedBudget">Approved budget</Label>
                <Input id="approvedBudget" name="approvedBudget" type="number" min={0} step="0.01" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contingencyBudget">Contingency budget</Label>
                <Input id="contingencyBudget" name="contingencyBudget" type="number" min={0} step="0.01" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="offHireCost">Off-hire cost</Label>
                <Input id="offHireCost" name="offHireCost" type="number" min={0} step="0.01" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="h-full md:col-span-2">
          <CardHeader>
            <CardTitle>Survey & technical</CardTitle>
            <CardDescription>Class, survey scope, and docking rationale.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="classSociety">Class society</Label>
              <Input id="classSociety" name="classSociety" value={classSociety} onChange={(e) => setClassSociety(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="surveyType">Survey type</Label>
              <Input id="surveyType" name="surveyType" placeholder="e.g. Special Survey" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="mainScope">Main scope</Label>
              <Textarea id="mainScope" name="mainScope" rows={2} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="dockingReason">Docking reason</Label>
              <Textarea id="dockingReason" name="dockingReason" rows={2} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Remarks</CardTitle>
          <CardDescription>Additional context for this dry dock project.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="notes" className="sr-only">
              Notes
            </Label>
            <Textarea id="notes" name="notes" rows={4} />
          </div>
        </CardContent>
      </Card>

      <EntityFormActions saving={saving} cancelFallbackHref={cancelFallbackHref} />
    </form>
  );
}
