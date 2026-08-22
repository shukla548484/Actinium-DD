"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { fmtPct } from "@/lib/superintendent/formatters";
import type { ProjectWorkspaceSummary } from "@/lib/superintendent/engine/workspaceSummary";
import { CombinedInputReadinessPanel } from "@/components/superintendent/CombinedInputReadinessPanel";
import { ProjectDefectsExcelPanel } from "@/components/superintendent/ProjectDefectsExcelPanel";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";

type Props = {
  dryDockProjectId: string;
};

type WorkspaceLoadResult = {
  workspace: ProjectWorkspaceSummary | null;
  error: string | null;
};

async function fetchProjectWorkspace(dryDockProjectId: string): Promise<WorkspaceLoadResult> {
  try {
    const r = await fetch(`/api/superintendent/projects/${dryDockProjectId}/workspace`);
    if (!r.ok) {
      let detail = `Workspace failed to load (${r.status}).`;
      try {
        const data = (await r.json()) as { error?: string };
        if (data.error) detail = data.error;
      } catch {
        // empty or non-JSON body
      }
      return { workspace: null, error: detail };
    }
    const contentType = r.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return { workspace: null, error: "Workspace response was not JSON." };
    }
    const data = (await r.json()) as { workspace?: ProjectWorkspaceSummary; error?: string };
    if (!data.workspace) {
      return { workspace: null, error: data.error ?? "Workspace payload was empty." };
    }
    return { workspace: data.workspace, error: null };
  } catch (err) {
    return {
      workspace: null,
      error: err instanceof Error ? err.message : "Network error loading workspace.",
    };
  }
}

export function ProjectWorkspaceDashboard({ dryDockProjectId }: Props) {
  const [workspace, setWorkspace] = useState<ProjectWorkspaceSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchProjectWorkspace(dryDockProjectId);
    setWorkspace(result.workspace);
    setError(result.error);
    setLoading(false);
  }, [dryDockProjectId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !workspace && !error) {
    return <ActiniumLoadingState label="Loading project workspace…" size="sm" />;
  }

  const kpis = workspace?.kpis;
  const errorAlert = error ? (
    <Alert variant="destructive">
      <AlertTitle>Could not load the full workspace</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center gap-2">
        <span>{error} Module tabs stay available; retry to restore KPIs and scope preview.</span>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
          Retry
        </Button>
      </AlertDescription>
    </Alert>
  ) : null;

  return (
    <div className="space-y-4">
      {errorAlert}

      {kpis ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          {[
            { label: "Progress", value: fmtPct(kpis.progressPct) },
            { label: "Scope jobs", value: String(kpis.jobs) },
            { label: "Workshops", value: String(workspace?.workshops.length ?? 0) },
            { label: "Milestones", value: String(kpis.milestones) },
            { label: "Budget lines", value: String(kpis.budgetLines) },
            { label: "Survey items", value: String(kpis.surveyItems) },
            { label: "Approvals", value: String(kpis.approvals) },
            { label: "Documents", value: String(kpis.documentRequirements) },
            { label: "RFQ steps", value: String(kpis.rfqSteps) },
            { label: "Checklist", value: String(kpis.checklistItems) },
            { label: "Vessel jobs in scope", value: String(kpis.vesselJobsIntegrated) },
            { label: "Auto-imported", value: String(kpis.vesselJobsAutoImported) },
            { label: "Pending vessel bank", value: String(kpis.vesselJobsPendingBank) },
            { label: "Excel defects", value: String(kpis.importedDefects ?? 0) },
          ].map((kpi) => (
            <Card key={kpi.label} size="sm" className="gap-0 py-1.5">
              <CardHeader className="gap-0.5 px-2.5 py-0">
                <CardTitle className="text-base font-semibold leading-none tabular-nums">
                  {kpi.value}
                </CardTitle>
                <CardDescription className="text-xs leading-tight">{kpi.label}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      ) : null}

      {workspace?.workspaceProvisionedAt ? (
        <p className="text-xs text-muted-foreground">
          Workspace provisioned from template v{workspace.templateVersion} on{" "}
          {new Date(workspace.workspaceProvisionedAt).toLocaleString()}.
        </p>
      ) : null}

      <CombinedInputReadinessPanel dryDockProjectId={dryDockProjectId} compact />

      <ProjectDefectsExcelPanel
        dryDockProjectId={dryDockProjectId}
        onImported={() => {
          void fetchProjectWorkspace(dryDockProjectId).then((result) => {
            if (result.workspace) setWorkspace(result.workspace);
            setError(result.error);
          });
        }}
      />

      {workspace ? (
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
              {workspace.kpis.jobs > workspace.scopePreview.length ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  +{workspace.kpis.jobs - workspace.scopePreview.length} more jobs
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
      ) : null}

      {workspace ? (
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
      ) : null}
    </div>
  );
}
