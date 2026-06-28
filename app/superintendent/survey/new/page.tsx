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
import { Textarea } from "@/components/ui/textarea";
import { LabeledSelect } from "@/components/ui/LabeledSelect";
import { SURVEY_TYPE_ITEMS, SURVEY_STATUS_ITEMS } from "@/lib/superintendent/constants";
export const dynamic = "force-dynamic";

export default function NewPage() {
  const router = useRouter();
  const [projectId, setProjectId] = useState(""); const [surveyType, setSurveyType] = useState("class_survey"); const [status, setStatus] = useState("pending");
  const { saving, error, submit } = useEntityFormSubmit(
    "/api/superintendent/survey",
    "create",
    undefined,
    "/superintendent/survey",
  );

  return (
    <PageShell>
      <PageHeader title="New record" description="Survey items and class references." />

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
              void submit({ dryDockProjectId: projectId, surveyType, title: form.get("title") as string, description: (form.get("description") as string) || null, dueDate: (form.get("dueDate") as string) || null, status, classReference: (form.get("classReference") as string) || null });
            }}
          >

            <DryDockProjectSelect value={projectId} onChange={setProjectId} required />
            <div className="space-y-2">
              <Label>Survey type</Label>
              <LabeledSelect items={SURVEY_TYPE_ITEMS} value={surveyType} onValueChange={(v) => setSurveyType(v || "class_survey")} className="w-full" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" name="title" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={2} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <DatePickerField id="dueDate" name="dueDate" label="Due date" />
              <div className="space-y-2">
                <Label>Status</Label>
                <LabeledSelect items={SURVEY_STATUS_ITEMS} value={status} onValueChange={(v) => setStatus(v || "pending")} className="w-full" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="classReference">Class reference</Label>
              <Input id="classReference" name="classReference" />
            </div>
            <EntityFormActions saving={saving} />
          </form>
        </CardContent>
      </Card>
    </PageShell>
  );
}
