"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import {
  EntityFormActions,
  useEntityFormSubmit,
} from "@/components/superintendent/EntityListPage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePickerField, toDateInput } from "@/components/ui/DatePickerField";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LabeledSelect } from "@/components/ui/LabeledSelect";
import { SURVEY_TYPE_ITEMS, SURVEY_STATUS_ITEMS } from "@/lib/superintendent/constants";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";
export const dynamic = "force-dynamic";

type Item = { id: string; surveyType: string; title: string; description: string | null; dueDate: string | null; status: string; classReference: string | null; };

export default function EditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<Item | null>(null);
  const [surveyType, setSurveyType] = useState("class_survey"); const [status, setStatus] = useState("pending");
  const { saving, error, submit } = useEntityFormSubmit(
    "/api/superintendent/survey",
    "edit",
    id,
    "/superintendent/survey",
  );

  useEffect(() => {
    void fetch(`/api/superintendent/survey/${id}`)
      .then((r) => r.json())
      .then((d) => {
        const row = d.surveyItem;
        if (row) {
          setItem(row);
          setSurveyType(row.surveyType); setStatus(row.status);
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

  return (
    <PageShell>
      <PageHeader title="Edit record" description={item.title} />

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
              void submit({ surveyType, title: form.get("title") as string, description: (form.get("description") as string) || null, dueDate: (form.get("dueDate") as string) || null, status, classReference: (form.get("classReference") as string) || null });
            }}
          >

            <div className="space-y-2">
              <Label>Survey type</Label>
              <LabeledSelect items={SURVEY_TYPE_ITEMS} value={surveyType} onValueChange={(v) => setSurveyType(v || item.surveyType)} className="w-full" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" name="title" defaultValue={item.title} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" rows={2} defaultValue={item.description ?? ""} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <DatePickerField
                id="dueDate"
                name="dueDate"
                label="Due date"
                defaultValue={toDateInput(item.dueDate)}
              />
              <div className="space-y-2">
                <Label>Status</Label>
                <LabeledSelect items={SURVEY_STATUS_ITEMS} value={status} onValueChange={(v) => setStatus(v || item.status)} className="w-full" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="classReference">Class reference</Label>
              <Input id="classReference" name="classReference" defaultValue={item.classReference ?? ""} />
            </div>
            <EntityFormActions saving={saving} />
          </form>
        </CardContent>
      </Card>
    </PageShell>
  );
}
