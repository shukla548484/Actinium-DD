"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Attachment = {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType: string | null;
  caption: string | null;
  createdAt: string;
};

const ACCEPT =
  ".pdf,.png,.jpg,.jpeg,.webp,.gif,.bmp,.xlsx,.xls,.csv,application/pdf,image/*,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv";

function fileKindLabel(mimeType: string | null, name: string): string {
  if (mimeType?.startsWith("image/")) return "Image";
  if (mimeType?.includes("pdf") || /\.pdf$/i.test(name)) return "PDF";
  if (
    mimeType?.includes("spreadsheet") ||
    mimeType?.includes("excel") ||
    /\.xlsx?$/i.test(name) ||
    /\.csv$/i.test(name)
  ) {
    return "Excel";
  }
  return "File";
}

export function JobAttachmentsPanel({ jobId }: { jobId: string }) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [caption, setCaption] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/superintendent/jobs/${jobId}/attachments`);
    if (res.ok) {
      const d = (await res.json()) as { attachments: Attachment[] };
      setAttachments(d.attachments ?? []);
    }
  }, [jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function uploadFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(fileList)) {
        const fd = new FormData();
        fd.set("file", file);
        if (caption.trim()) fd.set("caption", caption.trim());
        await fetch(`/api/superintendent/jobs/${jobId}/attachments`, {
          method: "POST",
          body: fd,
        });
      }
      setCaption("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      await load();
    } finally {
      setUploading(false);
    }
  }

  async function remove(attachmentId: string) {
    if (!confirm("Remove this attachment?")) return;
    await fetch(`/api/superintendent/jobs/${jobId}/attachments/${attachmentId}`, {
      method: "DELETE",
    });
    await load();
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Attach photos, PDFs, and Excel sheets. You can upload multiple files at once.
      </p>
      <ul className="space-y-2 text-sm">
        {attachments.length === 0 ? (
          <li className="text-muted-foreground">No attachments yet.</li>
        ) : (
          attachments.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/10 px-3 py-2"
            >
              <div className="min-w-0">
                <a
                  href={a.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  {a.fileName}
                </a>
                <p className="text-xs text-muted-foreground">
                  {fileKindLabel(a.mimeType, a.fileName)}
                  {a.caption ? ` · ${a.caption}` : null}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => void remove(a.id)}>
                Remove
              </Button>
            </li>
          ))
        )}
      </ul>
      <div className="flex flex-wrap items-end gap-2 rounded-md border bg-muted/20 p-3">
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          disabled={uploading}
          onChange={(e) => void uploadFiles(e.target.files)}
        />
        <div className="min-w-[12rem] flex-1 space-y-1">
          <Label htmlFor={`job-caption-${jobId}`}>Caption (optional, applies to batch)</Label>
          <Input
            id={`job-caption-${jobId}`}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="e.g. Shell renewal sketches"
            disabled={uploading}
          />
        </div>
        <Button type="button" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
          {uploading ? "Uploading…" : "Add files"}
        </Button>
      </div>
    </div>
  );
}
