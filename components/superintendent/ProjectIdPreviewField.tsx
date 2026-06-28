"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  vesselId: string;
};

export function ProjectIdPreviewField({ vesselId }: Props) {
  const [projectCode, setProjectCode] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!vesselId) {
      setProjectCode("");
      return;
    }

    let cancelled = false;
    setLoading(true);
    void fetch(`/api/superintendent/projects/preview-code?vesselId=${encodeURIComponent(vesselId)}`)
      .then((r) => r.json())
      .then((d: { projectCode?: string }) => {
        if (!cancelled) setProjectCode(d.projectCode ?? "");
      })
      .catch(() => {
        if (!cancelled) setProjectCode("");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [vesselId]);

  return (
    <div className="space-y-2">
      <Label htmlFor="projectIdPreview">Project ID</Label>
      <Input
        id="projectIdPreview"
        value={loading ? "Generating…" : projectCode || "Select a vessel first"}
        disabled
        readOnly
        className="font-mono"
      />
      <p className="text-xs text-muted-foreground">
        Auto-generated from vessel code. Assigned when the project is saved.
      </p>
    </div>
  );
}
