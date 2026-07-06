"use client";

import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";
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
    phase8JobsGenerated: number;
    phase10JobsGenerated: number;
    phase10FrameworkAreas?: number;
    totalJobsGenerated: number;
    phase1Measurements: number;
    phase2Measurements: number;
    phase3Measurements: number;
    phase4Measurements: number;
    phase5Measurements: number;
    phase6Measurements: number;
    phase7Measurements: number;
    phase8Measurements: number;
    phase1ChecklistItems: number;
    phase2ChecklistItems: number;
    phase3ChecklistItems: number;
    phase4ChecklistItems: number;
    phase5ChecklistItems: number;
    phase6ChecklistItems: number;
    phase7ChecklistItems: number;
    phase8ChecklistItems: number;
    phase5InitializedOnly?: boolean;
    phase6InitializedOnly?: boolean;
    phase7InitializedOnly?: boolean;
    phase8InitializedOnly?: boolean;
    phase10FrameworkOnly?: boolean;
    phase10InitializedOnly?: boolean;
    masterRepoRelease?: string;
    masterRepoVersion?: string;
  };
  v2?: {
    engineVersion: string;
    libraryVersion: string;
    r0FrameworkComplete: boolean;
    databaseTargets: {
      jobs: { min: number; max: number };
      dynamicTemplates: { min: number; max: number };
      inspectionPoints: { min: number; max: number };
      measurementParameters: { min: number; max: number };
      spareMaterialMappings: { min: number; max: number };
      rfqBudgetMappings: { min: number; max: number };
    };
    deliverables: string[];
    domains: {
      release: string;
      name: string;
      status: string;
      targetJobCount: { min: number; max: number };
      actualJobCount: number;
      r0BaselineJobCount: number;
      percentJobsComplete: number;
      coverageAreas: string[];
    }[];
    totals: {
      targetJobsMin: number;
      targetJobsMax: number;
      actualJobs: number;
      percentJobsToTargetMin: number;
    };
  };
};

type EmdrReport = {
  version: string;
  codebookPresent: boolean;
  indexPresent: boolean;
  idFormat: string;
  sprints: {
    id: string;
    sprintCode: string;
    name: string;
    emdrRelease: string;
    status: string;
    workbookPresent: boolean;
  }[];
  pendingReleases: { release: string; domain: string }[];
  codebook: {
    entityCodes: { code: string; entity: string }[];
    systemCodes: { systemCode: string; systemName: string }[];
    importOrder: { order: number; tableSheet: string; entityCode: string }[];
  };
};

const MASTER_REPO_SHEETS = [
  { sheet: "dashboard", label: "Dashboard" },
  { sheet: "repository", label: "Repository" },
  { sheet: "projectTemplates", label: "Projects" },
  { sheet: "engineeringDomains", label: "Domains" },
  { sheet: "masterLibraries", label: "Libraries" },
  { sheet: "technicalData", label: "Technical" },
] as const;

const WORKBOOK_SHEETS = [
  { sheet: "jobs", label: "Jobs" },
  { sheet: "templates", label: "Templates" },
  { sheet: "measurements", label: "Measurements" },
  { sheet: "checklists", label: "Checklists" },
  { sheet: "scope", label: "Scope" },
  { sheet: "spares", label: "Spares" },
] as const;

type V3Report = {
  kind: "v33" | "v32" | "v31" | "v30" | null;
  release: string | null;
  workbookPresent: boolean;
  seeded: boolean;
  stats: {
    jobCount: number;
    mainEngineJobCount: number;
    auxiliaryEngineJobCount: number;
    boilerJobCount?: number;
    pumpJobCount?: number;
    systemCount: number;
    mainEngineSystemCount: number;
    auxiliaryEngineSystemCount: number;
    boilerSystemCount?: number;
    pumpSystemCount?: number;
    catalogTemplateCount: number;
    measurementCount: number;
    checklistItemCount: number;
    mergedBundle?: boolean;
  };
  systems: {
    systemCode: string;
    systemName: string;
    jobCount: number;
    status: string;
    machineryFamily?: string;
  }[];
};

export function MtilProgressPanel() {
  const [data, setData] = useState<ProgressReport | null>(null);
  const [emdr, setEmdr] = useState<EmdrReport | null>(null);
  const [v3, setV3] = useState<V3Report | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void Promise.all([
      fetch("/api/admin/mtil/progress").then(async (r) => {
        if (!r.ok) return null;
        return (await r.json()) as { progress?: ProgressReport };
      }),
      fetch("/api/admin/emdr").then(async (r) => (r.ok ? r.json() : null)),
      fetch("/api/admin/mtil/v3/master-repository").then(async (r) => (r.ok ? r.json() : null)),
    ]).then(([progressBody, emdrBody, v3Body]) => {
      setData(progressBody?.progress ?? null);
      setEmdr((emdrBody as EmdrReport | null) ?? null);
      setV3((v3Body as V3Report | null) ?? null);
    });
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

  async function seedPhase8() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/mtil/phase8", { method: "POST" });
    const body = (await res.json()) as {
      workbookV11?: {
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
    const w = body.workbookV11;
    setMsg(
      w?.initializedOnly
        ? `Phase 8 registered — v1.1 initialized (schema ready, 0 jobs until library populated).`
        : `Phase 8 seeded — v1.1 workbook: ${w?.jobCount ?? 0} jobs (${w?.libraryVersion ?? "MTIL-v1.1"}).`,
    );
  }

  async function seedMasterRepository() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/mtil/master-repository", { method: "POST" });
    const body = (await res.json()) as {
      masterRepoV12?: {
        inserted?: boolean;
        jobCount?: number;
        frameworkAreas?: number;
        libraryVersion?: string;
        release?: string;
        frameworkOnly?: boolean;
      };
      error?: string;
    };
    setBusy(false);
    if (!res.ok) {
      setMsg(body.error ?? "Seed failed");
      return;
    }
    const m = body.masterRepoV12;
    setMsg(
      m?.frameworkOnly
        ? `Master repository registered — ${m.release ?? "R0.9"} ${m.libraryVersion ?? "MTIL-v1.2"} framework (${m.frameworkAreas ?? 0} areas, 0 jobs until populated).`
        : `Master repository seeded — ${m?.jobCount ?? 0} jobs (${m?.libraryVersion ?? "MTIL-v1.2"}).`,
    );
  }

  async function seedV30MasterRepository() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/mtil/v3/master-repository", { method: "POST" });
    const body = (await res.json()) as {
      ok?: boolean;
      kind?: "v33" | "v32" | "v31" | "v30";
      jobCount?: number;
      mainEngineJobCount?: number;
      auxiliaryEngineJobCount?: number;
      boilerJobCount?: number;
      pumpJobCount?: number;
      systemCount?: number;
      linkedNodes?: number;
      retiredSupersededNodes?: number;
      deactivatedV201Jobs?: number;
      error?: string;
    };
    setBusy(false);
    if (!res.ok) {
      setMsg(body.error ?? "EMDR master repository seed failed");
      return;
    }
    const supplementPart = [
      body.auxiliaryEngineJobCount && body.auxiliaryEngineJobCount > 0
        ? `${body.auxiliaryEngineJobCount} AE`
        : null,
      body.boilerJobCount && body.boilerJobCount > 0 ? `${body.boilerJobCount} BLR` : null,
      body.pumpJobCount && body.pumpJobCount > 0 ? `${body.pumpJobCount} PMP` : null,
    ]
      .filter(Boolean)
      .join(" + ");
    const jobPart = supplementPart
      ? ` (${body.mainEngineJobCount ?? 0} ME + ${supplementPart})`
      : "";
    const versionLabel =
      body.kind === "v33"
        ? "V3.3"
        : body.kind === "v32"
          ? "V3.2"
          : body.kind === "v31"
            ? "V3.1"
            : "V3.0";
    setMsg(
      `EMDR ${versionLabel} seeded — ${body.jobCount ?? 0} jobs${jobPart} across ${body.systemCount ?? 0} systems, ${body.linkedNodes ?? 0} library nodes linked. Retired ${body.retiredSupersededNodes ?? 0} superseded tree nodes and deactivated ${body.deactivatedV201Jobs ?? 0} legacy sprint jobs.`,
    );
    void fetch("/api/admin/mtil/v3/master-repository")
      .then((r) => r.json())
      .then((v3Body) => setV3(v3Body as V3Report));
  }

  async function seedV201Sprints() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/mtil/v2/sprints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sprintId: "all" }),
    });
    const body = (await res.json()) as {
      ok?: boolean;
      totalJobs?: number;
      totalLinked?: number;
      sprints?: { sprintId: string; jobCount: number; sprintCode?: string }[];
      error?: string;
    };
    setBusy(false);
    if (!res.ok) {
      setMsg(body.error ?? "V2.0.1 sprint seed failed");
      return;
    }
    const codes = body.sprints?.map((s) => s.sprintCode ?? s.sprintId).join(", ") ?? "all";
    setMsg(
      `V2.0.1 sprints seeded — ${body.totalJobs ?? 0} jobs (${codes}), ${body.totalLinked ?? 0} library nodes linked.`,
    );
  }

  if (!data) return <ActiniumLoadingState label="Loading MTIL progress…" size="sm" />;

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
              R0.x baseline · {data.totals.totalJobsGenerated} jobs seeded · V2.0 target{" "}
              {data.v2?.totals.targetJobsMin.toLocaleString() ?? "4,000"}–
              {data.v2?.totals.targetJobsMax.toLocaleString() ?? "5,000"} ·{" "}
              {data.totals.phase1Measurements +
                data.totals.phase2Measurements +
                data.totals.phase3Measurements +
                (data.totals.phase4Measurements ?? 0) +
                (data.totals.phase5Measurements ?? 0) +
                (data.totals.phase6Measurements ?? 0) +
                (data.totals.phase7Measurements ?? 0) +
                (data.totals.phase8Measurements ?? 0)}{" "}
              measurements ·{" "}
              {data.totals.phase1ChecklistItems +
                data.totals.phase2ChecklistItems +
                data.totals.phase3ChecklistItems +
                (data.totals.phase4ChecklistItems ?? 0) +
                (data.totals.phase5ChecklistItems ?? 0) +
                (data.totals.phase6ChecklistItems ?? 0) +
                (data.totals.phase7ChecklistItems ?? 0) +
                (data.totals.phase8ChecklistItems ?? 0)}{" "}
              checklist items
              {data.totals.phase5InitializedOnly ? " · P5 initialized" : ""}
              {data.totals.phase6InitializedOnly ? " · P6 initialized" : ""}
              {data.totals.phase7InitializedOnly ? " · P7 initialized" : ""}
              {data.totals.phase8InitializedOnly ? " · P8 initialized" : ""}
              {data.totals.phase10FrameworkOnly ? ` · Master ${data.totals.masterRepoRelease ?? "R0.9"} framework (${data.totals.phase10FrameworkAreas ?? 0} areas)` : ""}
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
            <Button variant="outline" size="sm" disabled={busy} onClick={() => void seedPhase8()}>
              {busy ? "Seeding…" : "Seed Phase 8 to DB"}
            </Button>
            <Button variant="outline" size="sm" disabled={busy} onClick={() => void seedMasterRepository()}>
              {busy ? "Seeding…" : "Seed Master Repo to DB"}
            </Button>
            {v3?.workbookPresent ? (
              <Button size="sm" disabled={busy} onClick={() => void seedV30MasterRepository()}>
                {busy
                  ? "Seeding…"
                  : v3.kind === "v33"
                    ? "Seed V3.3 ME+AE+Boilers+Pumps Master Repository"
                    : v3.kind === "v32"
                      ? "Seed V3.2 ME+AE+Boilers Master Repository"
                      : v3.kind === "v31"
                        ? "Seed V3.1 ME+AE Master Repository"
                        : "Seed V3.0 ME 100% Master Repository"}
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              disabled={busy || Boolean(v3?.workbookPresent)}
              title={
                v3?.workbookPresent
                  ? "EMDR V3 master repository replaces V2.0.1 sprint workbooks to avoid duplicate Main Engine jobs"
                  : undefined
              }
              onClick={() => void seedV201Sprints()}
            >
              {busy ? "Seeding…" : "Seed V2.0.1 Sprints (S1–S5) to DB"}
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
                    phase8V11?: { jobCount?: number; initializedOnly?: boolean };
                    masterRepoV12?: { jobCount?: number; frameworkAreas?: number; frameworkOnly?: boolean };
                  };
                  error?: string;
                };
                setBusy(false);
                const wb = body.workbooks;
                setMsg(
                  res.ok
                    ? `Job catalog synced: P4 ${wb?.phase4V07?.jobCount ?? 0} jobs, P5 ${wb?.phase5V08?.initializedOnly ? "initialized" : `${wb?.phase5V08?.jobCount ?? 0} jobs`}, P6 ${wb?.phase6V09?.initializedOnly ? "initialized" : `${wb?.phase6V09?.jobCount ?? 0} jobs`}, P7 ${wb?.phase7V10?.initializedOnly ? "initialized" : `${wb?.phase7V10?.jobCount ?? 0} jobs`}, P8 ${wb?.phase8V11?.initializedOnly ? "initialized" : `${wb?.phase8V11?.jobCount ?? 0} jobs`}, Master ${wb?.masterRepoV12?.frameworkOnly ? `framework (${wb?.masterRepoV12?.frameworkAreas ?? 0} areas)` : `${wb?.masterRepoV12?.jobCount ?? 0} jobs`}.`
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
            {!data.totals.phase8InitializedOnly
              ? WORKBOOK_SHEETS.map(({ sheet, label }) => (
                  <Button
                    key={`p8v11-${sheet}`}
                    variant="outline"
                    size="sm"
                    render={
                      <a href={`/api/admin/mtil/phase8?format=csv&sheet=${sheet}`} download />
                    }
                    nativeButton={false}
                  >
                    P8 v1.1 {label}
                  </Button>
                ))
              : null}
            {MASTER_REPO_SHEETS.map(({ sheet, label }) => (
              <Button
                key={`master-v12-${sheet}`}
                variant="outline"
                size="sm"
                render={
                  <a href={`/api/admin/mtil/master-repository?format=csv&sheet=${sheet}`} download />
                }
                nativeButton={false}
              >
                Master {label}
              </Button>
            ))}
          </div>
        </CardHeader>
      </Card>

      {v3?.workbookPresent ? (
        <Card className="border-sky-500/30">
          <CardHeader>
            <CardTitle className="text-base">
              EMDR{" "}
              {v3.kind === "v33"
                ? "V3.3 — Main Engine + Auxiliary Engine + Boilers + Pumps"
                : v3.kind === "v32"
                  ? "V3.2 — Main Engine + Auxiliary Engine + Boilers"
                  : v3.kind === "v31"
                    ? "V3.1 — Main Engine + Auxiliary Engine"
                    : "V3.0 — Main Engine 100%"}
            </CardTitle>
            <CardDescription>
              {v3.stats.jobCount.toLocaleString()} jobs
              {(v3.stats.auxiliaryEngineJobCount > 0 ||
                (v3.stats.boilerJobCount ?? 0) > 0 ||
                (v3.stats.pumpJobCount ?? 0) > 0) && (
                <>
                  {" "}
                  (
                  {[
                    v3.stats.mainEngineJobCount > 0
                      ? `${v3.stats.mainEngineJobCount.toLocaleString()} ME`
                      : null,
                    v3.stats.auxiliaryEngineJobCount > 0
                      ? `${v3.stats.auxiliaryEngineJobCount.toLocaleString()} AE`
                      : null,
                    (v3.stats.boilerJobCount ?? 0) > 0
                      ? `${v3.stats.boilerJobCount!.toLocaleString()} BLR`
                      : null,
                    (v3.stats.pumpJobCount ?? 0) > 0
                      ? `${v3.stats.pumpJobCount!.toLocaleString()} PMP`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" + ")}
                  )
                </>
              )}{" "}
              · {v3.stats.systemCount} systems
              {(v3.stats.auxiliaryEngineSystemCount > 0 ||
                (v3.stats.boilerSystemCount ?? 0) > 0 ||
                (v3.stats.pumpSystemCount ?? 0) > 0) && (
                <>
                  {" "}
                  (
                  {[
                    v3.stats.mainEngineSystemCount > 0
                      ? `${v3.stats.mainEngineSystemCount} ME`
                      : null,
                    v3.stats.auxiliaryEngineSystemCount > 0
                      ? `${v3.stats.auxiliaryEngineSystemCount} AE`
                      : null,
                    (v3.stats.boilerSystemCount ?? 0) > 0
                      ? `${v3.stats.boilerSystemCount} BLR`
                      : null,
                    (v3.stats.pumpSystemCount ?? 0) > 0
                      ? `${v3.stats.pumpSystemCount} PMP`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" + ")}
                  )
                </>
              )}{" "}
              · {v3.stats.catalogTemplateCount} templates ·{" "}
              {v3.stats.measurementCount.toLocaleString()} measurements ·{" "}
              {v3.seeded ? "Seeded to DB" : "Workbook ready — seed to load picker"}
              {v3.stats.mergedBundle
                ? v3.kind === "v33"
                  ? " · merged V3.1 + V3.3 bundle"
                  : " · merged V3.1 + V3.2 bundle"
                : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-0 pb-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Family</TableHead>
                  <TableHead>System Code</TableHead>
                  <TableHead>System</TableHead>
                  <TableHead>Jobs</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {v3.systems.map((s) => (
                  <TableRow key={`${s.systemCode}-${s.systemName}`}>
                    <TableCell>{s.machineryFamily ?? "Main Engine"}</TableCell>
                    <TableCell>{s.systemCode}</TableCell>
                    <TableCell>{s.systemName}</TableCell>
                    <TableCell>{s.jobCount}</TableCell>
                    <TableCell className="capitalize">{s.status.toLowerCase()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="px-4 text-xs text-muted-foreground">
              {v3.kind === "v33"
                ? "V3.3 merges V3.1 (ME+AE) with the V3.3 boilers + pumps supplement — seeding retires older Main Engine trees and deactivates legacy sprint job IDs."
                : v3.kind === "v32"
                  ? "V3.2 merges V3.1 (ME+AE) with the V3.2 boilers supplement — seeding retires older Main Engine trees and deactivates legacy sprint job IDs."
                  : v3.kind === "v31"
                    ? "V3.1 supersedes V3.0 and V2.0.1 sprint workbooks — seeding retires older Main Engine trees and deactivates legacy sprint job IDs."
                    : "Supersedes V2.0.1 sprint workbooks (S1–S5) for Main Engine — seeding V3 retires the older library tree and deactivates overlapping sprint job IDs."}
            </p>
          </CardContent>
        </Card>
      ) : null}

      {emdr ? (
        <Card className="border-emerald-500/30">
          <CardHeader>
            <CardTitle className="text-base">
              EMDR {emdr.version} — Engineering Master Data Repository
            </CardTitle>
            <CardDescription>
              {emdr.codebookPresent ? "Codebook loaded" : "Codebook fallback"} ·{" "}
              {emdr.indexPresent ? "Index loaded" : "Index pending"} · {emdr.idFormat} ·{" "}
              {emdr.codebook.entityCodes.length} entity codes · {emdr.codebook.systemCodes.length}{" "}
              system codes · {emdr.codebook.importOrder.length} import stages
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-0 pb-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Release</TableHead>
                  <TableHead>Domain</TableHead>
                  <TableHead>Workbook</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {emdr.sprints.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.emdrRelease}</TableCell>
                    <TableCell>{s.name}</TableCell>
                    <TableCell>{s.workbookPresent ? "Present" : "Missing"}</TableCell>
                    <TableCell className="capitalize">{s.status.toLowerCase()}</TableCell>
                  </TableRow>
                ))}
                {emdr.pendingReleases.map((p) => (
                  <TableRow key={p.release}>
                    <TableCell>{p.release}</TableCell>
                    <TableCell>{p.domain}</TableCell>
                    <TableCell>—</TableCell>
                    <TableCell className="text-muted-foreground">Pending (supplied later)</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">R0.x phase delivery (framework complete)</CardTitle>
          <CardDescription>
            Repository structure frozen — V2.0 upgrades each domain to production-grade libraries.
          </CardDescription>
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

      {data.v2 ? (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="text-base">
              MTIL v{data.v2.engineVersion} — Production Engineering Database
            </CardTitle>
            <CardDescription>
              {data.v2.libraryVersion} · {data.v2.totals.actualJobs.toLocaleString()} /{" "}
              {data.v2.totals.targetJobsMin.toLocaleString()}–{data.v2.totals.targetJobsMax.toLocaleString()} jobs (
              {data.v2.totals.percentJobsToTargetMin}% of minimum target) · Target:{" "}
              {data.v2.databaseTargets.inspectionPoints.min.toLocaleString()}+ inspection points ·{" "}
              {data.v2.databaseTargets.measurementParameters.min.toLocaleString()}+ measurements ·{" "}
              {data.v2.databaseTargets.spareMaterialMappings.min.toLocaleString()}+ spare mappings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 p-0 pb-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Release</TableHead>
                  <TableHead>Domain</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>R0 baseline</TableHead>
                  <TableHead>V2 target</TableHead>
                  <TableHead>Progress</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.v2.domains.map((d) => (
                  <TableRow key={d.release}>
                    <TableCell className="font-mono text-xs">{d.release}</TableCell>
                    <TableCell>{d.name}</TableCell>
                    <TableCell className="capitalize">{d.status.replace(/_/g, " ")}</TableCell>
                    <TableCell className="tabular-nums">{d.r0BaselineJobCount}</TableCell>
                    <TableCell className="tabular-nums">
                      {d.targetJobCount.min.toLocaleString()}
                      {d.targetJobCount.max !== d.targetJobCount.min
                        ? `–${d.targetJobCount.max.toLocaleString()}`
                        : ""}
                    </TableCell>
                    <TableCell className="tabular-nums">{d.percentJobsComplete}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="px-6 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Per-release deliverables</p>
              <p>{data.v2.deliverables.join(" · ")}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
