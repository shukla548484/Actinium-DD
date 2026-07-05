"use client";

import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ProgressReport = {
  engineVersion: string;
  phases: {
    id: number;
    name: string;
    status: string;
    targetJobCount: { min: number; max: number };
    actualJobCount?: number;
    catalogTemplateCount?: number;
    measurementCount?: number;
    checklistItemCount?: number;
  }[];
  totals: {
    catalogTemplates: number;
    dynamicTemplatesRegistered: number;
    phase1JobsGenerated: number;
    phase2JobsGenerated: number;
    phase3JobsGenerated: number;
    phase4JobsGenerated: number;
    phase5JobsGenerated: number;
    phase6JobsGenerated: number;
    phase7JobsGenerated: number;
    totalJobsGenerated: number;
    phase1Measurements: number;
    phase2Measurements: number;
    phase3Measurements: number;
    phase4Measurements: number;
    phase5Measurements: number;
    phase6Measurements: number;
    phase7Measurements: number;
    phase1ChecklistItems: number;
    phase2ChecklistItems: number;
    phase3ChecklistItems: number;
    phase4ChecklistItems: number;
    phase5ChecklistItems: number;
    phase6ChecklistItems: number;
    phase7ChecklistItems: number;
    phase5InitializedOnly?: boolean;
    phase6InitializedOnly?: boolean;
    phase7InitializedOnly?: boolean;
  };
};

const WORKBOOK_SHEETS = [
  { sheet: "jobs", label: "Jobs" },
  { sheet: "templates", label: "Templates" },
  { sheet: "measurements", label: "Measurements" },
  { sheet: "checklists", label: "Checklists" },
  { sheet: "scope", label: "Scope" },
  { sheet: "spares", label: "Spares" },
] as const;

export function MtilProgressPanel() {
  const [data, setData] = useState<ProgressReport | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch("/api/admin/mtil/progress")
      .then((r) => r.json())
      .then((d: { progress?: ProgressReport }) => setData(d.progress ?? null));
  }, []);

  async function seedPhase1() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/mtil/phase1?source=all", { method: "POST" });
    const body = (await res.json()) as {
      matrix?: { inserted?: boolean; jobCount?: number };
      workbookV04?: { inserted?: boolean; jobCount?: number; libraryVersion?: string };
      error?: string;
    };
    setBusy(false);
    if (!res.ok) {
      setMsg(body.error ?? "Seed failed");
      return;
    }
    setMsg(
      `Phase 1 seeded — matrix: ${body.matrix?.jobCount ?? 0} jobs, v0.4 workbook: ${body.workbookV04?.jobCount ?? 0} jobs (${body.workbookV04?.libraryVersion ?? "MTIL-v0.4"}).`,
    );
  }

  async function seedPhase2() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/mtil/phase2?source=all", { method: "POST" });
    const body = (await res.json()) as {
      matrix?: { inserted?: boolean; jobCount?: number };
      workbookV05?: { inserted?: boolean; jobCount?: number; libraryVersion?: string };
      error?: string;
    };
    setBusy(false);
    if (!res.ok) {
      setMsg(body.error ?? "Seed failed");
      return;
    }
    setMsg(
      `Phase 2 seeded — matrix: ${body.matrix?.jobCount ?? 0} jobs, v0.5 workbook: ${body.workbookV05?.jobCount ?? 0} jobs (${body.workbookV05?.libraryVersion ?? "MTIL-v0.5"}).`,
    );
  }

  async function seedPhase3() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/mtil/phase3?source=all", { method: "POST" });
    const body = (await res.json()) as {
      matrix?: { inserted?: boolean; jobCount?: number };
      workbookV06?: { inserted?: boolean; jobCount?: number; libraryVersion?: string };
      error?: string;
    };
    setBusy(false);
    if (!res.ok) {
      setMsg(body.error ?? "Seed failed");
      return;
    }
    setMsg(
      `Phase 3 seeded — matrix: ${body.matrix?.jobCount ?? 0} jobs, v0.6 workbook: ${body.workbookV06?.jobCount ?? 0} jobs (${body.workbookV06?.libraryVersion ?? "MTIL-v0.6"}).`,
    );
  }

  async function seedPhase4() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/mtil/phase4", { method: "POST" });
    const body = (await res.json()) as {
      workbookV07?: { inserted?: boolean; jobCount?: number; libraryVersion?: string };
      error?: string;
    };
    setBusy(false);
    if (!res.ok) {
      setMsg(body.error ?? "Seed failed");
      return;
    }
    setMsg(
      `Phase 4 seeded — v0.7 workbook: ${body.workbookV07?.jobCount ?? 0} jobs (${body.workbookV07?.libraryVersion ?? "MTIL-v0.7"}).`,
    );
  }

  async function seedPhase5() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/mtil/phase5", { method: "POST" });
    const body = (await res.json()) as {
      workbookV08?: {
        inserted?: boolean;
        jobCount?: number;
        libraryVersion?: string;
        initializedOnly?: boolean;
      };
      error?: string;
    };
    setBusy(false);
    if (!res.ok) {
      setMsg(body.error ?? "Seed failed");
      return;
    }
    const w = body.workbookV08;
    setMsg(
      w?.initializedOnly
        ? `Phase 5 registered — v0.8 initialized (schema ready, 0 jobs until library expanded).`
        : `Phase 5 seeded — v0.8 workbook: ${w?.jobCount ?? 0} jobs (${w?.libraryVersion ?? "MTIL-v0.8"}).`,
    );
  }

  async function seedPhase6() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/mtil/phase6", { method: "POST" });
    const body = (await res.json()) as {
      workbookV09?: {
        inserted?: boolean;
        jobCount?: number;
        libraryVersion?: string;
        initializedOnly?: boolean;
      };
      error?: string;
    };
    setBusy(false);
    if (!res.ok) {
      setMsg(body.error ?? "Seed failed");
      return;
    }
    const w = body.workbookV09;
    setMsg(
      w?.initializedOnly
        ? `Phase 6 registered — v0.9 initialized (schema ready, 0 jobs until library populated).`
        : `Phase 6 seeded — v0.9 workbook: ${w?.jobCount ?? 0} jobs (${w?.libraryVersion ?? "MTIL-v0.9"}).`,
    );
  }

  async function seedPhase7() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/mtil/phase7", { method: "POST" });
    const body = (await res.json()) as {
      workbookV10?: {
        inserted?: boolean;
        jobCount?: number;
        libraryVersion?: string;
        initializedOnly?: boolean;
      };
      error?: string;
    };
    setBusy(false);
    if (!res.ok) {
      setMsg(body.error ?? "Seed failed");
      return;
    }
    const w = body.workbookV10;
    setMsg(
      w?.initializedOnly
        ? `Phase 7 registered — v1.0 initialized (schema ready, 0 jobs until library populated).`
        : `Phase 7 seeded — v1.0 workbook: ${w?.jobCount ?? 0} jobs (${w?.libraryVersion ?? "MTIL-v1.0"}).`,
    );
  }

  if (!data) return <p className="text-sm text-muted-foreground">Loading MTIL progress…</p>;

  return (
    <div className="space-y-4">
      {msg ? (
        <Alert>
          <AlertDescription>{msg}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0">
          <div>
            <CardTitle className="text-base">MTIL Template Engine v{data.engineVersion}</CardTitle>
            <CardDescription>
              {data.totals.totalJobsGenerated} jobs · {data.totals.catalogTemplates} catalog templates ·{" "}
              {data.totals.phase1Measurements +
                data.totals.phase2Measurements +
                data.totals.phase3Measurements +
                (data.totals.phase4Measurements ?? 0) +
                (data.totals.phase5Measurements ?? 0) +
                (data.totals.phase6Measurements ?? 0) +
                (data.totals.phase7Measurements ?? 0)}{" "}
              measurements ·{" "}
              {data.totals.phase1ChecklistItems +
                data.totals.phase2ChecklistItems +
                data.totals.phase3ChecklistItems +
                (data.totals.phase4ChecklistItems ?? 0) +
                (data.totals.phase5ChecklistItems ?? 0) +
                (data.totals.phase6ChecklistItems ?? 0) +
                (data.totals.phase7ChecklistItems ?? 0)}{" "}
              checklist items
              {data.totals.phase5InitializedOnly ? " · P5 initialized" : ""}
              {data.totals.phase6InitializedOnly ? " · P6 initialized" : ""}
              {data.totals.phase7InitializedOnly ? " · P7 initialized" : ""}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" disabled={busy} onClick={() => void seedPhase1()}>
              {busy ? "Seeding…" : "Seed Phase 1 to DB"}
            </Button>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => void seedPhase2()}>
              {busy ? "Seeding…" : "Seed Phase 2 to DB"}
            </Button>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => void seedPhase3()}>
              {busy ? "Seeding…" : "Seed Phase 3 to DB"}
            </Button>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => void seedPhase4()}>
              {busy ? "Seeding…" : "Seed Phase 4 to DB"}
            </Button>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => void seedPhase5()}>
              {busy ? "Seeding…" : "Seed Phase 5 to DB"}
            </Button>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => void seedPhase6()}>
              {busy ? "Seeding…" : "Seed Phase 6 to DB"}
            </Button>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => void seedPhase7()}>
              {busy ? "Seeding…" : "Seed Phase 7 to DB"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const res = await fetch("/api/admin/mtil/job-catalog", { method: "POST" });
                const body = (await res.json()) as {
                  phase1?: { templates?: number; masterJobs?: number };
                  phase2?: { templates?: number; masterJobs?: number };
                  phase3?: { templates?: number; masterJobs?: number };
                  workbooks?: {
                    phase4V07?: { jobCount?: number };
                    phase5V08?: { jobCount?: number; initializedOnly?: boolean };
                    phase6V09?: { jobCount?: number; initializedOnly?: boolean };
                    phase7V10?: { jobCount?: number; initializedOnly?: boolean };
                  };
                  error?: string;
                };
                setBusy(false);
                const wb = body.workbooks;
                setMsg(
                  res.ok
                    ? `Job catalog synced: P4 ${wb?.phase4V07?.jobCount ?? 0} jobs, P5 ${wb?.phase5V08?.initializedOnly ? "initialized" : `${wb?.phase5V08?.jobCount ?? 0} jobs`}, P6 ${wb?.phase6V09?.initializedOnly ? "initialized" : `${wb?.phase6V09?.jobCount ?? 0} jobs`}, P7 ${wb?.phase7V10?.initializedOnly ? "initialized" : `${wb?.phase7V10?.jobCount ?? 0} jobs`}.`
                    : body.error ?? "Job catalog sync failed",
                );
              }}
            >
              Sync Job Catalog DB
            </Button>
            <Button
              variant="outline"
              size="sm"
              render={<a href="/admin/job-catalog" />}
              nativeButton={false}
            >
              View catalog tables
            </Button>
            {WORKBOOK_SHEETS.map(({ sheet, label }) => (
              <Button
                key={`p1v04-${sheet}`}
                variant="outline"
                size="sm"
                render={
                  <a href={`/api/admin/mtil/phase1?format=csv&source=v04&sheet=${sheet}`} download />
                }
                nativeButton={false}
              >
                P1 v0.4 {label}
              </Button>
            ))}
            {WORKBOOK_SHEETS.map(({ sheet, label }) => (
              <Button
                key={`p1-${sheet}`}
                variant="outline"
                size="sm"
                render={
                  <a href={`/api/admin/mtil/phase1?format=csv&sheet=${sheet}`} download />
                }
                nativeButton={false}
              >
                P1 matrix {label}
              </Button>
            ))}
            {WORKBOOK_SHEETS.map(({ sheet, label }) => (
              <Button
                key={`p2v05-${sheet}`}
                variant="outline"
                size="sm"
                render={
                  <a href={`/api/admin/mtil/phase2?format=csv&source=v05&sheet=${sheet}`} download />
                }
                nativeButton={false}
              >
                P2 v0.5 {label}
              </Button>
            ))}
            {WORKBOOK_SHEETS.map(({ sheet, label }) => (
              <Button
                key={`p2-${sheet}`}
                variant="outline"
                size="sm"
                render={
                  <a href={`/api/admin/mtil/phase2?format=csv&sheet=${sheet}`} download />
                }
                nativeButton={false}
              >
                P2 matrix {label}
              </Button>
            ))}
            {WORKBOOK_SHEETS.map(({ sheet, label }) => (
              <Button
                key={`p3v06-${sheet}`}
                variant="outline"
                size="sm"
                render={
                  <a href={`/api/admin/mtil/phase3?format=csv&source=v06&sheet=${sheet}`} download />
                }
                nativeButton={false}
              >
                P3 v0.6 {label}
              </Button>
            ))}
            {WORKBOOK_SHEETS.map(({ sheet, label }) => (
              <Button
                key={`p3-${sheet}`}
                variant="outline"
                size="sm"
                render={
                  <a href={`/api/admin/mtil/phase3?format=csv&sheet=${sheet}`} download />
                }
                nativeButton={false}
              >
                P3 matrix {label}
              </Button>
            ))}
            {WORKBOOK_SHEETS.map(({ sheet, label }) => (
              <Button
                key={`p4v07-${sheet}`}
                variant="outline"
                size="sm"
                render={
                  <a href={`/api/admin/mtil/phase4?format=csv&sheet=${sheet}`} download />
                }
                nativeButton={false}
              >
                P4 v0.7 {label}
              </Button>
            ))}
            {!data.totals.phase5InitializedOnly
              ? WORKBOOK_SHEETS.map(({ sheet, label }) => (
                  <Button
                    key={`p5v08-${sheet}`}
                    variant="outline"
                    size="sm"
                    render={
                      <a href={`/api/admin/mtil/phase5?format=csv&sheet=${sheet}`} download />
                    }
                    nativeButton={false}
                  >
                    P5 v0.8 {label}
                  </Button>
                ))
              : null}
            {!data.totals.phase6InitializedOnly
              ? WORKBOOK_SHEETS.map(({ sheet, label }) => (
                  <Button
                    key={`p6v09-${sheet}`}
                    variant="outline"
                    size="sm"
                    render={
                      <a href={`/api/admin/mtil/phase6?format=csv&sheet=${sheet}`} download />
                    }
                    nativeButton={false}
                  >
                    P6 v0.9 {label}
                  </Button>
                ))
              : null}
            {!data.totals.phase7InitializedOnly
              ? WORKBOOK_SHEETS.map(({ sheet, label }) => (
                  <Button
                    key={`p7v10-${sheet}`}
                    variant="outline"
                    size="sm"
                    render={
                      <a href={`/api/admin/mtil/phase7?format=csv&sheet=${sheet}`} download />
                    }
                    nativeButton={false}
                  >
                    P7 v1.0 {label}
                  </Button>
                ))
              : null}
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Phase delivery plan</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Phase</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Jobs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.phases.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.id}</TableCell>
                  <TableCell>{p.name}</TableCell>
                  <TableCell className="capitalize">{p.status.replace(/_/g, " ")}</TableCell>
                  <TableCell className="tabular-nums">
                    {p.actualJobCount != null
                      ? `${p.actualJobCount} / ${p.targetJobCount.min}–${p.targetJobCount.max}`
                      : `— / ${p.targetJobCount.min}–${p.targetJobCount.max}`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
