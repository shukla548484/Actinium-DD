"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { fmtPct } from "@/lib/superintendent/formatters";
import type { ProjectWorkspaceSummary } from "@/lib/superintendent/engine/workspaceSummary";
import { workspaceModuleHref } from "@/lib/superintendent/engine/workspaceNav";
import { projectPlanningHref } from "@/lib/superintendent/engine/workspaceLinks";
import { CombinedInputReadinessPanel } from "@/components/superintendent/CombinedInputReadinessPanel";
import { ProjectDefectsExcelPanel } from "@/components/superintendent/ProjectDefectsExcelPanel";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";

function projectVesselJobsHref(dryDockProjectId: string) {
  return `/superintendent/projects/${dryDockProjectId}/inputs/vessel/jobs`;
}

function projectExcelDefectsHref(dryDockProjectId: string) {
  return `/superintendent/projects/${dryDockProjectId}#excel-defects`;
}

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
            {
              label: "Progress",
              value: fmtPct(kpis.progressPct),
              href: workspaceModuleHref("daily_progress", dryDockProjectId),
            },
            {
              label: "Scope jobs",
              value: String(kpis.jobs),
              href: workspaceModuleHref("scope", dryDockProjectId),
            },
            {
              label: "Workshops",
              value: String(workspace?.workshops.length ?? 0),
              href: workspaceModuleHref("workshops", dryDockProjectId),
            },
            {
              label: "Milestones",
              value: String(kpis.milestones),
              href: workspaceModuleHref("timeline", dryDockProjectId),
            },
            {
              label: "Budget lines",
              value: String(kpis.budgetLines),
              href: workspaceModuleHref("budget", dryDockProjectId),
            },
            {
              label: "Survey items",
              value: String(kpis.surveyItems),
              href: workspaceModuleHref("survey", dryDockProjectId),
            },
            {
              label: "Approvals",
              value: String(kpis.approvals),
              href: workspaceModuleHref("approvals", dryDockProjectId),
            },
            {
              label: "Documents",
              value: String(kpis.documentRequirements),
              href: workspaceModuleHref("documents", dryDockProjectId),
            },
            {
              label: "RFQ steps",
              value: String(kpis.rfqSteps),
              href: workspaceModuleHref("rfq", dryDockProjectId),
            },
            {
              label: "Checklist",
              value: String(kpis.checklistItems),
              href: projectPlanningHref(dryDockProjectId, "checklist"),
            },
            {
              label: "Vessel jobs in scope",
              value: String(kpis.vesselJobsIntegrated),
              href: projectVesselJobsHref(dryDockProjectId),
            },
            {
              label: "Auto-imported",
              value: String(kpis.vesselJobsAutoImported),
              href: projectVesselJobsHref(dryDockProjectId),
            },
            {
              label: "Pending vessel bank",
              value: String(kpis.vesselJobsPendingBank),
              href: projectVesselJobsHref(dryDockProjectId),
            },
            {
              label: "Excel defects",
              value: String(kpis.importedDefects ?? 0),
              href: projectExcelDefectsHref(dryDockProjectId),
            },
          ].map((kpi) => (
            <Link
              key={kpi.label}
              href={kpi.href}
              aria-label={`View ${kpi.label}: ${kpi.value}`}
              className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <Card
                size="sm"
                className="h-full cursor-pointer gap-0 py-1.5 transition-colors group-hover:bg-muted/40 group-focus-visible:bg-muted/40"
              >
                <CardHeader className="gap-0.5 px-2.5 py-0">
                  <CardTitle className="text-base font-semibold leading-none tabular-nums">
                    {kpi.value}
                  </CardTitle>
                  <CardDescription className="text-xs leading-tight">{kpi.label}</CardDescription>
                </CardHeader>
              </Card>
            </Link>
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
