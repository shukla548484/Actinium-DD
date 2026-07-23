"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
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
import { Textarea } from "@/components/ui/textarea";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";

export const dynamic = "force-dynamic";

function NewPageInner() {
  const searchParams = useSearchParams();
  const initialProjectId = searchParams.get("dryDockProjectId")?.trim() ?? "";
  const [projectId, setProjectId] = useState(initialProjectId);
  const redirectTo = projectId
    ? `/superintendent/planning/checklist?dryDockProjectId=${encodeURIComponent(projectId)}`
    : "/superintendent/planning/checklist";
  const { saving, error, submit } = useEntityFormSubmit(
    "/api/superintendent/checklist",
    "create",
    undefined,
    redirectTo,
  );

  return (
    <PageShell>
      <PageHeader title="New checklist item" description="Readiness tasks before yard entry." />

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
              void submit({
                dryDockProjectId: projectId,
                title: form.get("title") as string,
                category: (form.get("category") as string) || null,
                dueDate: (form.get("dueDate") as string) || null,
                assignedTo: (form.get("assignedTo") as string) || null,
                notes: (form.get("notes") as string) || null,
              });
            }}
          >
            <DryDockProjectSelect value={projectId} onChange={setProjectId} required />
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" name="title" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input id="category" name="category" />
            </div>
            <DatePickerField id="dueDate" name="dueDate" label="Due date" />
            <div className="space-y-2">
              <Label htmlFor="assignedTo">Assigned to</Label>
              <Input id="assignedTo" name="assignedTo" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" rows={2} />
            </div>
            <EntityFormActions saving={saving} cancelFallbackHref={redirectTo} />
          </form>
        </CardContent>
      </Card>
    </PageShell>
  );
}

export default function NewPage() {
  return (
    <Suspense
      fallback={
        <PageShell>
          <ActiniumLoadingState size="sm" />
        </PageShell>
      }
    >
      <NewPageInner />
    </Suspense>
  );
}
