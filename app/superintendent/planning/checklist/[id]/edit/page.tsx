"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import {
  EntityFormActions,
  useEntityFormSubmit,
} from "@/components/superintendent/EntityListPage";
import { ChecklistAttachmentsPanel } from "@/components/superintendent/ChecklistAttachmentsPanel";
import { ClassStatusConfirmationPanel } from "@/components/superintendent/ClassStatusConfirmationPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePickerField, toDateInput } from "@/components/ui/DatePickerField";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";
import { Button } from "@/components/ui/button";
import {
  parseStoredClassStatusAnalysis,
  type ClassStatusAnalysis,
} from "@/lib/superintendent/classStatusAnalysis";

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
  classStatusAnalysis?: unknown;
};

function isClassStatusItem(title: string): boolean {
  const t = title.toLowerCase();
  return t.includes("class status") || t.includes("class documentation");
}

function EditPageInner() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<Item | null>(null);
  const [completed, setCompleted] = useState(false);
  const [analysis, setAnalysis] = useState<ClassStatusAnalysis | null>(null);
  const [confirmSaving, setConfirmSaving] = useState(false);
  const [creatingJobs, setCreatingJobs] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [createMessage, setCreateMessage] = useState<string | null>(null);

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

  const classStatusMode = item ? isClassStatusItem(item.title) : false;

  useEffect(() => {
    void fetch(`/api/superintendent/checklist/${id}`)
      .then((r) => r.json())
      .then((d) => {
        const row = d.checklistItem as Item | undefined;
        if (row) {
          setItem(row);
          setCompleted(row.isCompleted);
          setAnalysis(parseStoredClassStatusAnalysis(row.classStatusAnalysis));
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function saveConfirmations(opts?: { markComplete?: boolean }) {
    if (!analysis) return;
    setConfirmSaving(true);
    setConfirmError(null);
    setCreateMessage(null);
    try {
      const res = await fetch(
        `/api/superintendent/checklist/${id}/analyze-class-status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            analysis,
            markComplete: Boolean(opts?.markComplete),
          }),
        },
      );
      const data = (await res.json()) as {
        analysis?: ClassStatusAnalysis;
        error?: string;
      };
      if (!res.ok) {
        setConfirmError(data.error ?? "Failed to save confirmations");
        return;
      }
      if (data.analysis) setAnalysis(data.analysis);
      if (opts?.markComplete) setCompleted(true);
      setCreateMessage(
        opts?.markComplete ? "Saved and marked complete." : "Ticks and CAP saved.",
      );
    } catch {
      setConfirmError("Network error while saving confirmations");
    } finally {
      setConfirmSaving(false);
    }
  }

  async function createSelectedJobs() {
    if (!analysis) return;
    setCreatingJobs(true);
    setConfirmError(null);
    setCreateMessage(null);
    try {
      // Persist ticks first so server uses latest attend flags if lineIds omitted
      const saveRes = await fetch(
        `/api/superintendent/checklist/${id}/analyze-class-status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ analysis }),
        },
      );
      const saveData = (await saveRes.json()) as {
        analysis?: ClassStatusAnalysis;
        error?: string;
      };
      if (!saveRes.ok) {
        setConfirmError(saveData.error ?? "Save ticks before creating jobs");
        return;
      }
      if (saveData.analysis) setAnalysis(saveData.analysis);

      const lineIds = [
        ...analysis.jobs,
        ...analysis.cocs,
        ...analysis.otherItems,
      ]
        .filter((r) => r.attend)
        .map((r) => r.id);

      const res = await fetch(
        `/api/superintendent/checklist/${id}/create-jobs-from-class-status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lineIds }),
        },
      );
      const data = (await res.json()) as {
        analysis?: ClassStatusAnalysis;
        createdCount?: number;
        skippedCount?: number;
        error?: string;
      };
      if (!res.ok) {
        setConfirmError(data.error ?? "Failed to create jobs");
        return;
      }
      if (data.analysis) setAnalysis(data.analysis);
      setCompleted(true);
      setCreateMessage(
        `Created ${data.createdCount ?? 0} job(s)` +
          (data.skippedCount ? ` (${data.skippedCount} already existed)` : "") +
          ". Open Jobs to review.",
      );
    } catch {
      setConfirmError("Network error while creating jobs");
    } finally {
      setCreatingJobs(false);
    }
  }

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
      <PageHeader
        title={classStatusMode ? "Class status upload" : "Edit checklist item"}
        description={classStatusMode ? undefined : item.title}
      />

      {classStatusMode ? (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Class Status Report</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ChecklistAttachmentsPanel
                checklistItemId={item.id}
                requireClassStatusReport
                onAnalyzed={(next) => {
                  setAnalysis(next);
                  setCreateMessage(null);
                  setConfirmError(null);
                  setCompleted(true);
                }}
                onAnalysisCleared={() => {
                  setAnalysis(null);
                  setCreateMessage(null);
                  setConfirmError(null);
                  setCompleted(false);
                }}
              />
            </CardContent>
          </Card>

          {analysis ? (
            <ClassStatusConfirmationPanel
              analysis={analysis}
              onChange={setAnalysis}
              onSave={(opts) => void saveConfirmations(opts)}
              onCreateJobs={() => void createSelectedJobs()}
              dryDockProjectId={item.dryDockProjectId}
              saving={confirmSaving}
              creatingJobs={creatingJobs}
              error={confirmError}
              createMessage={createMessage}
            />
          ) : null}

          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={() => router.push(redirectTo)}>
              Back to list
            </Button>
          </div>
        </div>
      ) : (
        <>
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
                  <Input
                    id="category"
                    name="category"
                    defaultValue={item.category ?? ""}
                  />
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
        </>
      )}
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
