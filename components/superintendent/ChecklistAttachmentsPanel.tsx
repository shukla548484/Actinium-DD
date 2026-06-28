"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Attachment = {
  id: string;
  fileName: string;
  fileUrl: string;
  caption: string | null;
  createdAt: string;
};

type Props = {
  checklistItemId: string;
};

export function ChecklistAttachmentsPanel({ checklistItemId }: Props) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch(`/api/superintendent/checklist/${checklistItemId}/attachments`);
    if (!res.ok) return;
    const data = (await res.json()) as { attachments: Attachment[] };
    setAttachments(data.attachments);
  }

  useEffect(() => {
    void load();
  }, [checklistItemId]);

  async function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const form = new FormData(e.currentTarget);
    const res = await fetch(`/api/superintendent/checklist/${checklistItemId}/attachments`, {
      method: "POST",
      body: form,
    });
    setBusy(false);
    if (res.ok) {
      e.currentTarget.reset();
      await load();
    }
  }

  return (
    <div className="space-y-4">
      <form className="flex flex-wrap items-end gap-3" onSubmit={(ev) => void upload(ev)}>
        <div className="space-y-1">
          <Label htmlFor={`file-${checklistItemId}`}>Upload file</Label>
          <Input id={`file-${checklistItemId}`} name="file" type="file" required />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`caption-${checklistItemId}`}>Caption</Label>
          <Input id={`caption-${checklistItemId}`} name="caption" placeholder="Optional" className="w-48" />
        </div>
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? "Uploading…" : "Upload"}
        </Button>
      </form>

      {attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No files attached.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center justify-between rounded-md border px-3 py-2">
              <a href={a.fileUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                {a.fileName}
              </a>
              {a.caption ? <span className="text-xs text-muted-foreground">{a.caption}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
