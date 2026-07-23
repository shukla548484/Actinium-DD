"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Anchor,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Ship,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fmtDate, fmtMoney, fmtPct } from "@/lib/superintendent/formatters";
import type {
  ProjectsWorkbenchDto,
  WorkbenchProjectCard,
  WorkbenchTenderCard,
} from "@/lib/projects/workbench";
import { cn } from "@/lib/utils";

type Props = {
  data: ProjectsWorkbenchDto;
  newProjectHref?: string;
};

function matchesQuery(
  q: string,
  parts: Array<string | null | undefined>,
): boolean {
  if (!q) return true;
  return parts.some((p) => p?.toLowerCase().includes(q));
}

function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Progress</span>
        <span className="font-medium text-foreground">{fmtPct(pct)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function KpiTile({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: number;
  hint?: string;
  tone?: "default" | "warn" | "ok" | "accent";
}) {
  return (
    <Card
      className={cn(
        "shadow-none",
        tone === "warn" && "border-amber-200 bg-amber-50/60",
        tone === "ok" && "border-emerald-200 bg-emerald-50/50",
        tone === "accent" && "border-sky-200 bg-sky-50/50",
      )}
    >
      <CardContent className="p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function ActiveProjectCard({ project }: { project: WorkbenchProjectCard }) {
  return (
    <Card className="shadow-none transition-colors hover:border-primary/40">
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={project.href}
                className="truncate text-base font-semibold hover:underline"
              >
                {project.name}
              </Link>
              {project.referenceCode ? (
                <span className="font-mono text-xs text-muted-foreground">
                  {project.referenceCode}
                </span>
              ) : null}
            </div>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Ship className="size-3.5 shrink-0" />
              {project.vessel.name}
              <span className="text-muted-foreground/70">({project.vessel.code})</span>
            </p>
          </div>
          <Badge variant="outline" className="shrink-0 capitalize">
            {project.statusLabel}
          </Badge>
        </div>

        <ProgressBar value={project.progressPct} />

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-0.5 text-sm">
            <p className="text-xs text-muted-foreground">Expected sailing</p>
            <p className="font-medium">{fmtDate(project.expectedSailing)}</p>
          </div>
          <div className="space-y-0.5 text-sm">
            <p className="text-xs text-muted-foreground">Budget</p>
            <p className="font-medium">
              {fmtMoney(project.approvedBudget ?? project.budgetTotal)}{" "}
              <span className="text-xs font-normal text-muted-foreground">
                {project.currency}
              </span>
            </p>
            {project.budgetVariancePct != null ? (
              <p
                className={cn(
                  "text-xs",
                  project.overBudget ? "text-destructive" : "text-emerald-700",
                )}
              >
                {project.overBudget ? "Over" : "Under"} by{" "}
                {Math.abs(project.budgetVariancePct).toFixed(0)}%
              </p>
            ) : null}
          </div>
          <div className="space-y-0.5 text-sm">
            <p className="text-xs text-muted-foreground">Yard / owner</p>
            <p className="font-medium truncate">
              {project.selectedYard ?? "Yard TBD"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {project.projectOwner ?? "Owner unassigned"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <div className="flex flex-wrap gap-2">
            {project.pendingApprovals > 0 ? (
              <Badge variant="secondary" className="gap-1">
                <ClipboardList className="size-3" />
                {project.pendingApprovals} pending approval
                {project.pendingApprovals === 1 ? "" : "s"}
              </Badge>
            ) : null}
            {project.overBudget ? (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="size-3" />
                Over budget
              </Badge>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {project.tenderHref ? (
              <Button
                size="sm"
                variant="outline"
                render={<Link href={project.tenderHref} />}
                nativeButton={false}
              >
                Tender
              </Button>
            ) : null}
            <Button size="sm" render={<Link href={project.href} />} nativeButton={false}>
              Open workspace
              <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CompletedProjectCard({ project }: { project: WorkbenchProjectCard }) {
  return (
    <Card className="shadow-none">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <Link href={project.href} className="font-semibold hover:underline">
              {project.name}
            </Link>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {project.vessel.name} · Completed {fmtDate(project.actualEnd)}
            </p>
          </div>
          <Badge
            variant="outline"
            className={cn(
              project.reviewStatus === "review_complete" &&
                "border-emerald-200 bg-emerald-50 text-emerald-800",
              project.reviewStatus === "review_pending" &&
                "border-amber-200 bg-amber-50 text-amber-900",
            )}
          >
            {project.reviewStatusLabel}
          </Badge>
        </div>

        <div className="grid gap-2 sm:grid-cols-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Final progress</p>
            <p className="font-medium">{fmtPct(project.progressPct)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Approved budget</p>
            <p className="font-medium">
              {fmtMoney(project.approvedBudget ?? project.budgetTotal)} {project.currency}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Actual / quoted</p>
            <p className="font-medium">
              {fmtMoney(project.actualTotal ?? project.quotedTotal)} {project.currency}
            </p>
            {project.budgetVariancePct != null ? (
              <p
                className={cn(
                  "text-xs",
                  project.overBudget ? "text-destructive" : "text-emerald-700",
                )}
              >
                {project.budgetVariancePct >= 0 ? "+" : ""}
                {project.budgetVariancePct.toFixed(0)}% vs approved
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            size="sm"
            variant="outline"
            render={<Link href={`${project.href}/closeout`} />}
            nativeButton={false}
          >
            Open review
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TenderRow({ tender }: { tender: WorkbenchTenderCard }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
      <div className="min-w-0">
        <Link href={tender.href} className="font-medium hover:underline">
          {tender.name}
        </Link>
        <p className="text-xs text-muted-foreground">
          {tender.vesselName ?? "Vessel TBD"}
          {tender.referenceCode ? ` · ${tender.referenceCode}` : ""}
          {" · "}
          Updated {fmtDate(tender.updatedAt)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="secondary">{tender.statusLabel}</Badge>
        <Button size="sm" variant="ghost" render={<Link href={tender.href} />} nativeButton={false}>
          Open
        </Button>
      </div>
    </div>
  );
}

export function ProjectsWorkbench({ data, newProjectHref = "/projects/new" }: Props) {
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();

  const active = useMemo(
    () =>
      data.active.filter((p) =>
        matchesQuery(q, [p.name, p.referenceCode, p.vessel.name, p.vessel.code, p.selectedYard]),
      ),
    [data.active, q],
  );
  const recent = useMemo(
    () =>
      data.recentlyCompleted.filter((p) =>
        matchesQuery(q, [p.name, p.referenceCode, p.vessel.name, p.vessel.code]),
      ),
    [data.recentlyCompleted, q],
  );
  const tenders = useMemo(
    () =>
      data.tenders.filter((t) =>
        matchesQuery(q, [t.name, t.referenceCode, t.vesselName]),
      ),
    [data.tenders, q],
  );

  const isEmpty =
    data.active.length === 0 &&
    data.recentlyCompleted.length === 0 &&
    data.tenders.length === 0;

  if (isEmpty) {
    return (
      <Card className="border-dashed shadow-none">
        <CardContent className="flex flex-col items-center py-12 text-center">
          <Anchor className="mb-3 size-8 text-muted-foreground" />
          <p className="text-base font-medium">No dry dock projects in your scope yet</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Active docking work and recently completed reviews will appear here automatically
            once projects are created for your vessels.
          </p>
          <Button className="mt-5" render={<Link href={newProjectHref} />} nativeButton={false}>
            Create your first project
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile label="Active projects" value={data.kpis.activeCount} tone="accent" />
        <KpiTile
          label="In execution"
          value={data.kpis.inExecutionCount}
          hint="Docking, execution, trials"
        />
        <KpiTile
          label="Over budget"
          value={data.kpis.overBudgetCount}
          tone={data.kpis.overBudgetCount > 0 ? "warn" : "default"}
        />
        <KpiTile
          label="Pending approvals"
          value={data.kpis.pendingApprovalsCount}
          tone={data.kpis.pendingApprovalsCount > 0 ? "warn" : "ok"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search active, completed, or tenders…"
          className="min-w-[220px] max-w-md flex-1"
        />
        <p className="text-xs text-muted-foreground">
          Completed window: last {data.meta.recentDays} days
        </p>
      </div>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Active projects</h2>
            <p className="text-sm text-muted-foreground">
              Dry dock work that needs attention now — planning through final inspection.
            </p>
          </div>
          <Badge variant="outline">{active.length}</Badge>
        </div>
        {active.length === 0 ? (
          <Card className="border-dashed shadow-none">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              {q ? "No active projects match your search." : "No active dry dock projects."}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {active.map((project) => (
              <ActiveProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Recently completed</h2>
            <p className="text-sm text-muted-foreground">
              Review status and budget outcome for projects finished in the last{" "}
              {data.meta.recentDays} days.
            </p>
          </div>
          <Badge variant="outline">{recent.length}</Badge>
        </div>
        {recent.length === 0 ? (
          <Card className="border-dashed shadow-none">
            <CardContent className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4" />
              {q ? "No completed projects match your search." : "No recently completed projects."}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {recent.map((project) => (
              <CompletedProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <Card className="shadow-none">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base">Open tenders</CardTitle>
                <CardDescription>
                  Specs and yard comparison not yet linked to a dry dock workspace.
                </CardDescription>
              </div>
              <Badge variant="secondary">{tenders.length}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {tenders.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {q ? "No tenders match your search." : "No open tenders without a workspace."}
              </p>
            ) : (
              tenders.map((tender) => <TenderRow key={tender.id} tender={tender} />)
            )}
          </CardContent>
        </Card>
      </section>

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock3 className="size-3.5" />
        <Wallet className="size-3.5" />
        Budget figures use approved budget when set, otherwise planned budget vs actual/quoted.
      </p>
    </div>
  );
}
