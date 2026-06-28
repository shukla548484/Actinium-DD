"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { BudgetVsQuotePanel } from "@/components/superintendent/BudgetVsQuotePanel";
import { CopyScopePanel } from "@/components/superintendent/CopyScopePanel";
import { ProjectActionsBar } from "@/components/superintendent/ProjectActionsBar";
import { ProjectStatusStepper } from "@/components/superintendent/ProjectStatusStepper";
import { ProjectWorkspaceDashboard } from "@/components/superintendent/ProjectWorkspaceDashboard";
import { fmtDate, fmtMoney, fmtPct } from "@/lib/superintendent/formatters";
import {
  projectBudgetHref,
  projectInProjectHref,
  projectRelatedLinks,
} from "@/lib/superintendent/engine/workspaceLinks";
import { formatProjectTypeLabel } from "@/lib/superintendent/engine/projectTypes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

type ProjectDetail = {
  id: string;
  name: string;
  referenceCode: string | null;
  projectType: string;
  priority: string;
  status: string;
  plannedStart: string | null;
  plannedEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  selectedYard: string | null;
  budgetTotal: number | null;
  quotedTotal: number | null;
  actualTotal: number | null;
  progressPct: number | null;
  notes: string | null;
  vessel: { id: string; name: string; code: string; imoNumber: string | null };
  tenderProject: { id: string; name: string } | null;
  _count: {
    jobs: number;
    budgetLines: number;
    checklistItems: number;
    milestones: number;
    risks: number;
    variations: number;
    dailyReports: number;
    delays: number;
    surveyItems: number;
    sparesItems: number;
    approvals: number;
  };
};

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch(`/api/superintendent/projects/${id}`)
      .then((r) => r.json())
      .then((d) => setProject(d.project ?? null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <PageShell>
        <p className="text-sm text-muted-foreground">Loading project…</p>
      </PageShell>
    );
  }

  if (!project) {
    return (
      <PageShell>
        <p className="text-sm text-destructive">Project not found.</p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title={project.name}
        description={`${project.vessel.name} (${project.vessel.code}) · ${project.status.replace(/_/g, " ")}`}
        actions={
          <ProjectActionsBar
            projectId={project.id}
            projectName={project.name}
            status={project.status}
          />
        }
      />

      <ProjectStatusStepper status={project.status} className="mb-4" />

      <ProjectWorkspaceDashboard dryDockProjectId={project.id} />

      <CopyScopePanel projectId={project.id} />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Project type:</span>{" "}
              {formatProjectTypeLabel(project.projectType as Parameters<typeof formatProjectTypeLabel>[0])}
            </p>
            <p><span className="text-muted-foreground">Priority:</span> {project.priority}</p>
            <p><span className="text-muted-foreground">Project ID:</span> {project.referenceCode ?? "—"}</p>
            <p><span className="text-muted-foreground">Progress:</span> {fmtPct(project.progressPct)}</p>
            <p><span className="text-muted-foreground">Planned:</span> {fmtDate(project.plannedStart)} – {fmtDate(project.plannedEnd)}</p>
            <p><span className="text-muted-foreground">Selected yard:</span> {project.selectedYard ?? "—"}</p>
            {project.tenderProject ? (
              <p>
                <span className="text-muted-foreground">Tender project:</span>{" "}
                <Link href={`/projects/${project.tenderProject.id}`} className="text-primary hover:underline">
                  {project.tenderProject.name}
                </Link>
              </p>
            ) : null}
            {project.notes ? (
              <p><span className="text-muted-foreground">Notes:</span> {project.notes}</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Budget</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Budget:</span> {fmtMoney(project.budgetTotal)}</p>
            <p><span className="text-muted-foreground">Quoted:</span> {fmtMoney(project.quotedTotal)}</p>
            <p><span className="text-muted-foreground">Actual:</span> {fmtMoney(project.actualTotal)}</p>
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                render={<Link href={projectBudgetHref(project.id)} />}
                nativeButton={false}
              >
                Budget lines ({project._count.budgetLines})
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="ml-2"
                render={<Link href={projectInProjectHref(project.id, "scope")} />}
                nativeButton={false}
              >
                Jobs ({project._count.jobs})
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Related records</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {projectRelatedLinks(project.id).map((item) => {
            const countKey = {
              Checklist: project._count.checklistItems,
              Milestones: project._count.milestones,
              Risks: project._count.risks,
              Variations: project._count.variations,
              "Daily reports": project._count.dailyReports,
              Delays: project._count.delays,
              Survey: project._count.surveyItems,
              Spares: project._count.sparesItems,
              Approvals: project._count.approvals,
            }[item.label];
            return (
              <Button
                key={item.href}
                variant="outline"
                size="sm"
                render={<Link href={item.href} />}
                nativeButton={false}
              >
                {item.label} ({countKey})
              </Button>
            );
          })}
        </CardContent>
      </Card>

      <BudgetVsQuotePanel
        dryDockProjectId={project.id}
        tenderProjectId={project.tenderProject?.id}
      />
    </PageShell>
  );
}
