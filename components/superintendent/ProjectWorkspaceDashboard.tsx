"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { fmtPct } from "@/lib/superintendent/formatters";
import type { ProjectWorkspaceSummary } from "@/lib/superintendent/engine/workspaceSummary";
import { CombinedInputReadinessPanel } from "@/components/superintendent/CombinedInputReadinessPanel";

type Props = {
  dryDockProjectId: string;
};

export function ProjectWorkspaceDashboard({ dryDockProjectId }: Props) {
  const [workspace, setWorkspace] = useState<ProjectWorkspaceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch(`/api/superintendent/projects/${dryDockProjectId}/workspace`)
      .then((r) => r.json())
      .then((d: { workspace?: ProjectWorkspaceSummary }) => setWorkspace(d.workspace ?? null))
      .finally(() => setLoading(false));
  }, [dryDockProjectId]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading project workspace…</p>;
  }

  if (!workspace) return null;

  const { kpis } = workspace;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        {[
          { label: "Progress", value: fmtPct(kpis.progressPct) },
          { label: "Scope jobs", value: String(kpis.jobs) },
          { label: "Workshops", value: String(workspace.workshops.length) },
          { label: "Milestones", value: String(kpis.milestones) },
          { label: "Budget lines", value: String(kpis.budgetLines) },
          { label: "Survey items", value: String(kpis.surveyItems) },
          { label: "Approvals", value: String(kpis.approvals) },
          { label: "Documents", value: String(kpis.documentRequirements) },
          { label: "RFQ steps", value: String(kpis.rfqSteps) },
          { label: "Checklist", value: String(kpis.checklistItems) },
        ].map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xl font-semibold tabular-nums">{kpi.value}</CardTitle>
              <CardDescription>{kpi.label}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      {workspace.workspaceProvisionedAt ? (
        <p className="text-xs text-muted-foreground">
          Workspace provisioned from template v{workspace.templateVersion} on{" "}
          {new Date(workspace.workspaceProvisionedAt).toLocaleString()}.
        </p>
      ) : null}

      <CombinedInputReadinessPanel dryDockProjectId={dryDockProjectId} compact />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Scope of work (preview)</CardTitle>
            <CardDescription>Auto-generated job library for this project type.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {workspace.scopePreview.map((job) => (
                <li key={job.title} className="flex justify-between gap-2">
                  <span>{job.title}</span>
                  <span className="shrink-0 text-muted-foreground">
                    {job.workshop ?? job.category}
                  </span>
                </li>
              ))}
            </ul>
            {kpis.jobs > workspace.scopePreview.length ? (
              <p className="mt-2 text-xs text-muted-foreground">
                +{kpis.jobs - workspace.scopePreview.length} more jobs
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Workshop allocation</CardTitle>
            <CardDescription>Jobs grouped by workshop from the project template.</CardDescription>
          </CardHeader>
          <CardContent>
            {workspace.workshops.length === 0 ? (
              <p className="text-sm text-muted-foreground">No workshops assigned yet.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {workspace.workshops.map((w) => (
                  <li key={w.name} className="flex justify-between">
                    <span>{w.name}</span>
                    <span className="text-muted-foreground">{w.jobCount} jobs</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Project workspace modules</CardTitle>
          <CardDescription>
            Enabled modules for this project type — every page belongs to one module.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {workspace.modules.map((mod) => (
              <Button
                key={mod.id}
                variant="outline"
                className="h-auto justify-start px-3 py-2 text-left"
                render={<Link href={mod.href} />}
                nativeButton={false}
              >
                <span className="flex w-full flex-col gap-0.5">
                  <span className="font-medium">
                    {mod.label}
                    {mod.count != null ? ` (${mod.count})` : ""}
                  </span>
                  <span className="text-xs font-normal text-muted-foreground">{mod.description}</span>
                </span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
