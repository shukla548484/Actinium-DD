"use client";

import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ClassStatusAnalysis } from "@/lib/superintendent/classStatusAnalysis";

type Attachment = {
  id: string;
  fileName: string;
  fileUrl: string;
  caption: string | null;
  createdAt: string;
};

type Props = {
  checklistItemId: string;
  requireClassStatusReport?: boolean;
  onAnalyzed?: (analysis: ClassStatusAnalysis) => void;
  onAnalysisCleared?: () => void;
};

export function ChecklistAttachmentsPanel({
  checklistItemId,
  requireClassStatusReport = false,
  onAnalyzed,
  onAnalysisCleared,
}: Props) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Attachment | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch(`/api/superintendent/checklist/${checklistItemId}/attachments`);
    if (!res.ok) return;
    const data = (await res.json()) as { attachments: Attachment[] };
    setAttachments(data.attachments);
  }

  useEffect(() => {
    void load();
  }, [checklistItemId]);

  async function analyze(attachmentId: string) {
    setAnalyzing(true);
    setError(null);
    setMessage("OpenAI reading Class Status Report PDF (full survey-status structure)…");
    try {
      const res = await fetch(
        `/api/superintendent/checklist/${checklistItemId}/analyze-class-status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ attachmentId }),
        },
      );
      const data = (await res.json()) as {
        analysis?: ClassStatusAnalysis;
        error?: string;
      };
      if (!res.ok || !data.analysis) {
        setError(data.error ?? "Analysis failed");
        setMessage(null);
        return;
      }
      setMessage("Analysis complete — review vessel, certificates, due items, and tick jobs below.");
      onAnalyzed?.(data.analysis);
    } catch {
      setError("Network error while analyzing the Class Status Report.");
      setMessage(null);
    } finally {
      setAnalyzing(false);
    }
  }

  async function removeAttachment(attachment: Attachment) {
    setDeletingId(attachment.id);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/superintendent/checklist/${checklistItemId}/attachments/${attachment.id}`,
        { method: "DELETE" },
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        clearedAnalysis?: boolean;
      };
      if (!res.ok) {
        setError(data.error ?? "Delete failed");
        return;
      }
      await load();
      setMessage(
        data.clearedAnalysis
          ? "File deleted. Previous analysis cleared — upload and analyze again."
          : "File deleted.",
      );
      if (data.clearedAnalysis) onAnalysisCleared?.();
    } catch {
      setError("Network error while deleting the file.");
    } finally {
      setDeletingId(null);
      setPendingDelete(null);
    }
  }

  async function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    if (requireClassStatusReport) {
      formData.set("caption", "Class Status Report");
    }
    const res = await fetch(`/api/superintendent/checklist/${checklistItemId}/attachments`, {
      method: "POST",
      body: formData,
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Upload failed");
      return;
    }
    const data = (await res.json()) as { attachment: Attachment };
    form.reset();
    await load();
    setMessage("Class Status Report uploaded.");
    if (requireClassStatusReport) {
      await analyze(data.attachment.id);
    }
  }

  return (
    <div className="space-y-4">
      <form className="flex flex-wrap items-end gap-3" onSubmit={(ev) => void upload(ev)}>
        <div className="space-y-1">
          <Label htmlFor={`file-${checklistItemId}`}>
            {requireClassStatusReport ? "Class Status Report *" : "Upload file"}
          </Label>
          <Input
            id={`file-${checklistItemId}`}
            name="file"
            type="file"
            accept={
              requireClassStatusReport
                ? ".pdf,.doc,.docx,.txt,application/pdf,text/plain"
                : undefined
            }
            required
          />
        </div>
        {!requireClassStatusReport ? (
          <div className="space-y-1">
            <Label htmlFor={`caption-${checklistItemId}`}>Caption</Label>
            <Input
              id={`caption-${checklistItemId}`}
              name="caption"
              placeholder="Optional"
              className="w-48"
            />
          </div>
        ) : null}
        <Button type="submit" size="sm" disabled={busy || analyzing || Boolean(deletingId)}>
          {busy ? "Uploading…" : analyzing ? "Analyzing…" : "Upload"}
        </Button>
      </form>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {attachments.length === 0 ? null : (
        <ul className="space-y-2 text-sm">
          {attachments.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2"
            >
              <div className="min-w-0">
                <a
                  href={a.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {a.fileName}
                </a>
                {a.caption ? (
                  <span className="ml-2 text-xs text-muted-foreground">{a.caption}</span>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {requireClassStatusReport ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={analyzing || Boolean(deletingId)}
                    onClick={() => void analyze(a.id)}
                  >
                    Re-analyze
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={analyzing || deletingId === a.id}
                  onClick={() => setPendingDelete(a)}
                >
                  {deletingId === a.id ? "Deleting…" : "Delete"}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog
        open={pendingDelete != null}
        onOpenChange={(open) => {
          if (!open && !deletingId) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete uploaded file?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete
                ? `Remove “${pendingDelete.fileName}”? This cannot be undone.`
                : "This cannot be undone."}
              {pendingDelete && requireClassStatusReport
                ? " If this file was used for analysis, the extracted findings will also be cleared."
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingId)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={!pendingDelete || Boolean(deletingId)}
              variant="destructive"
              onClick={(e) => {
                e.preventDefault();
                if (pendingDelete) void removeAttachment(pendingDelete);
              }}
            >
              {deletingId ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
