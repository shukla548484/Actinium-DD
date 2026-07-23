"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import {
  EntityFormActions,
  useEntityFormSubmit,
} from "@/components/superintendent/EntityListPage";
import { ChecklistAttachmentsPanel } from "@/components/superintendent/ChecklistAttachmentsPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePickerField, toDateInput } from "@/components/ui/DatePickerField";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";

export const dynamic = "force-dynamic";

type Item = {
  id: string;
  dryDockProjectId: string;
  title: string;
  category: string | null;
  isCompleted: boolean;
  dueDate: string | null;
  assignedTo: string | null;
  notes: string | null;
};

function EditPageInner() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<Item | null>(null);
  const [completed, setCompleted] = useState(false);

  const redirectTo = useMemo(() => {
    const projectId =
      searchParams.get("dryDockProjectId")?.trim() || item?.dryDockProjectId;
    if (projectId) {
      return `/superintendent/planning/checklist?dryDockProjectId=${encodeURIComponent(projectId)}`;
    }
    return "/superintendent/planning/checklist";
  }, [searchParams, item?.dryDockProjectId]);

  const { saving, error, submit } = useEntityFormSubmit(
    "/api/superintendent/checklist",
    "edit",
    id,
    redirectTo,
  );

  useEffect(() => {
    void fetch(`/api/superintendent/checklist/${id}`)
      .then((r) => r.json())
      .then((d) => {
        const row = d.checklistItem as Item | undefined;
        if (row) {
          setItem(row);
          setCompleted(row.isCompleted);
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
      <PageHeader title="Edit checklist item" description={item.title} />

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
                title: form.get("title") as string,
                category: (form.get("category") as string) || null,
                isCompleted: completed,
                dueDate: (form.get("dueDate") as string) || null,
                assignedTo: (form.get("assignedTo") as string) || null,
                notes: (form.get("notes") as string) || null,
              });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" name="title" defaultValue={item.title} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input id="category" name="category" defaultValue={item.category ?? ""} />
            </div>
            <DatePickerField
              id="dueDate"
              name="dueDate"
              label="Due date"
              defaultValue={toDateInput(item.dueDate)}
            />
            <div className="space-y-2">
              <Label htmlFor="assignedTo">Assigned to</Label>
              <Input
                id="assignedTo"
                name="assignedTo"
                defaultValue={item.assignedTo ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                rows={2}
                defaultValue={item.notes ?? ""}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isCompleted"
                name="isCompleted"
                checked={completed}
                onChange={(e) => setCompleted(e.target.checked)}
              />
              <Label htmlFor="isCompleted">Completed</Label>
            </div>
            <EntityFormActions
              saving={saving}
              onCancel={() => router.push(redirectTo)}
              cancelFallbackHref={redirectTo}
            />
          </form>
        </CardContent>
      </Card>

      <div className="mt-4">
        <ChecklistAttachmentsPanel checklistItemId={item.id} />
      </div>
    </PageShell>
  );
}

export default function EditPage() {
  return (
    <Suspense
      fallback={
        <PageShell>
          <ActiniumLoadingState size="sm" />
        </PageShell>
      }
    >
      <EditPageInner />
    </Suspense>
  );
}
