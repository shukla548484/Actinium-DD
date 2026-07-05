"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { VesselJobAttachmentMeta } from "@/lib/db/vesselJobAttachments";

type Props = {
  vesselJobId: string;
  readOnly?: boolean;
};

export function VesselJobAttachmentsPanel({ vesselJobId, readOnly }: Props) {
  const [attachments, setAttachments] = useState<VesselJobAttachmentMeta[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/ship-access/vessel-jobs/${vesselJobId}/attachments`);
    if (!res.ok) return;
    const data = (await res.json()) as { attachments?: VesselJobAttachmentMeta[] };
    setAttachments(data.attachments ?? []);
  }, [vesselJobId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const form = new FormData(e.currentTarget);
    const res = await fetch(`/api/ship-access/vessel-jobs/${vesselJobId}/attachments`, {
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
      {!readOnly ? (
        <form className="flex flex-wrap items-end gap-3" onSubmit={(ev) => void upload(ev)}>
          <div className="space-y-1">
            <Label htmlFor={`vj-file-${vesselJobId}`}>Photo / file</Label>
            <Input
              id={`vj-file-${vesselJobId}`}
              name="file"
              type="file"
              accept="image/*,video/*,.pdf"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`vj-caption-${vesselJobId}`}>Caption</Label>
            <Input
              id={`vj-caption-${vesselJobId}`}
              name="caption"
              placeholder="Optional"
              className="w-48"
            />
          </div>
          <Button type="submit" size="sm" disabled={busy}>
            {busy ? "Uploading…" : "Upload"}
          </Button>
        </form>
      ) : null}

      {attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No photos or attachments yet.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center justify-between rounded-md border px-3 py-2">
              <a
                href={a.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
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

/** Upload pending files after a job is created (wizard flow). */
export async function uploadPendingVesselJobFiles(
  vesselJobId: string,
  files: File[],
): Promise<number> {
  let uploaded = 0;
  for (const file of files) {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api/ship-access/vessel-jobs/${vesselJobId}/attachments`, {
      method: "POST",
      body: form,
    });
    if (res.ok) uploaded += 1;
  }
  return uploaded;
}
