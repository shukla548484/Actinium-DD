"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatProjectTypeLabel } from "@/lib/superintendent/engine/projectTypes";
import type { DryDockProjectType } from "@prisma/client";
import { fmtDate } from "@/lib/superintendent/formatters";

type PreviousProject = {
  id: string;
  name: string;
  referenceCode: string | null;
  projectType: DryDockProjectType;
  status: string;
  plannedStart: string | null;
  plannedEnd: string | null;
};

type Props = {
  projectId: string;
};

export function CopyScopePanel({ projectId }: Props) {
  const router = useRouter();
  const [projects, setProjects] = useState<PreviousProject[]>([]);
  const [sourceId, setSourceId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch(`/api/superintendent/projects/${projectId}/previous-projects`)
      .then((r) => r.json())
      .then((d: { projects?: PreviousProject[] }) => setProjects(d.projects ?? []));
  }, [projectId]);

  async function handleCopy() {
    if (!sourceId) return;
    if (
      !window.confirm(
        "Replace this project's scope (jobs, checklist, milestones, survey, budget, approvals) with the selected project?",
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/superintendent/projects/${projectId}/copy-scope`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceProjectId: sourceId }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = (await res.json()) as { error?: string };
      setError(d.error ?? "Copy failed");
      return;
    }
    router.refresh();
  }

  if (projects.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Copy previous scope</CardTitle>
        <CardDescription>
          Copy scope from a previous dry dock on the same vessel (Section 9 — reusable templates).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label>Previous project</Label>
          <Select value={sourceId || null} onValueChange={(v) => setSourceId(v ?? "")}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select previous project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.referenceCode ?? p.name} — {formatProjectTypeLabel(p.projectType)} (
                  {fmtDate(p.plannedStart)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button type="button" disabled={!sourceId || busy} onClick={() => void handleCopy()}>
          {busy ? "Copying…" : "Copy scope to this project"}
        </Button>
      </CardContent>
    </Card>
  );
}
