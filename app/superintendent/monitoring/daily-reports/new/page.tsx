"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import {
  EntityFormActions,
  useEntityFormSubmit,
} from "@/components/superintendent/EntityListPage";
import { DryDockProjectSelect } from "@/components/superintendent/DryDockProjectSelect";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePickerField } from "@/components/ui/DatePickerField";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";


export const dynamic = "force-dynamic";

export default function NewPage() {
  const router = useRouter();
  const [projectId, setProjectId] = useState("");
  const { saving, error, submit } = useEntityFormSubmit(
    "/api/superintendent/daily-reports",
    "create",
    undefined,
    "/superintendent/monitoring/daily-reports",
  );

  return (
    <PageShell>
      <PageHeader title="New record" description="Yard daily progress and manpower." />

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              void submit({ dryDockProjectId: projectId, reportDate: form.get("reportDate") as string, completedWork: (form.get("completedWork") as string) || null, plannedWork: (form.get("plannedWork") as string) || null, manpowerCount: form.get("manpowerCount") ? Number(form.get("manpowerCount")) : null, progressPct: form.get("progressPct") ? Number(form.get("progressPct")) : null });
            }}
          >

            <DryDockProjectSelect value={projectId} onChange={setProjectId} required />
            <DatePickerField id="reportDate" name="reportDate" label="Report date *" required />
            <div className="space-y-2">
              <Label htmlFor="completedWork">Completed work</Label>
              <Textarea id="completedWork" name="completedWork" rows={2} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="plannedWork">Planned work</Label>
              <Textarea id="plannedWork" name="plannedWork" rows={2} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="manpowerCount">Manpower count</Label>
                <Input id="manpowerCount" name="manpowerCount" type="number" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="progressPct">Progress %</Label>
                <Input id="progressPct" name="progressPct" type="number" min={0} max={100} />
              </div>
            </div>
            <EntityFormActions saving={saving} />
          </form>
        </CardContent>
      </Card>
    </PageShell>
  );
}
