"use client";

import { useCallback, useEffect, useState } from "react";
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

export function JobAttachmentsPanel({ jobId }: { jobId: string }) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);

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

  async function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setUploading(true);
    await fetch(`/api/superintendent/jobs/${jobId}/attachments`, {
      method: "POST",
      body: fd,
    });
    setUploading(false);
    form.reset();
    await load();
  }

  async function remove(attachmentId: string) {
    if (!confirm("Remove this attachment?")) return;
    await fetch(`/api/superintendent/jobs/${jobId}/attachments/${attachmentId}`, {
      method: "DELETE",
    });
    await load();
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <h3 className="font-medium">Photos & attachments</h3>
      <ul className="space-y-2 text-sm">
        {attachments.length === 0 ? (
          <li className="text-muted-foreground">No attachments yet.</li>
        ) : (
          attachments.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-2">
              <a href={a.fileUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                {a.fileName}
              </a>
              <Button variant="ghost" size="sm" onClick={() => void remove(a.id)}>
                Remove
              </Button>
            </li>
          ))
        )}
      </ul>
      <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => void upload(e)}>
        <div className="space-y-1">
          <Label htmlFor="file">File</Label>
          <Input id="file" name="file" type="file" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="caption">Caption</Label>
          <Input id="caption" name="caption" placeholder="Optional" className="w-48" />
        </div>
        <Button type="submit" disabled={uploading}>
          {uploading ? "Uploading…" : "Upload"}
        </Button>
      </form>
    </div>
  );
}
