"use client";

import { useEffect, useState } from "react";
import { ActiveProjectBanner } from "@/components/superintendent/ActiveProjectBanner";
import { DailyReportSectionPhotos } from "@/components/superintendent/DailyReportSectionPhotos";
import { DryDockProjectSelect } from "@/components/superintendent/DryDockProjectSelect";
import { EntityFormActions } from "@/components/superintendent/EntityListPage";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { DatePickerField, toDateInput } from "@/components/ui/DatePickerField";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DAILY_REPORT_SECTION_KEYS,
  DAILY_REPORT_SECTION_LABELS,
  daysElapsedSinceDockEntry,
  emptyDailyReportSections,
  type DailyReportSections,
} from "@/lib/superintendent/dailyReportSections";
import { fmtDate } from "@/lib/superintendent/formatters";

export type DailyReportProjectMeta = {
  id: string;
  name: string;
  referenceCode: string | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  actualStart: string | null;
  expectedSailing: string | null;
  vessel?: { id: string; name: string; code: string } | null;
};

export type DailyReportFormValues = {
  dryDockProjectId: string;
  reportDate: string;
  weatherCondition: string;
  progressPct: string;
  sections: DailyReportSections;
};

type Props = {
  mode: "create" | "edit";
  reportId?: string;
  initial: DailyReportFormValues;
  project?: DailyReportProjectMeta | null;
  saving: boolean;
  error: string | null;
  onSubmit: (values: DailyReportFormValues) => void;
  cancelFallbackHref?: string;
};

function HeaderStrip({
  project,
  reportDate,
}: {
  project: DailyReportProjectMeta | null | undefined;
  reportDate: string;
}) {
  if (!project) return null;

  // Dock entry = actualStart; fall back to plannedStart for display only.
  const dockEntry = project.actualStart ?? project.plannedStart;
  const projectStart = project.actualStart ?? project.plannedStart;
  const targetReady = project.expectedSailing ?? project.plannedEnd;
  const elapsed =
    reportDate && dockEntry ? daysElapsedSinceDockEntry(dockEntry, reportDate) : null;

  return (
    <div className="sticky top-0 z-10 mb-4 rounded-md border bg-background/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-sm font-medium">
            {project.name}
            {project.referenceCode ? (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {project.referenceCode}
              </span>
            ) : null}
          </p>
          {project.vessel ? (
            <p className="text-xs text-muted-foreground">
              {project.vessel.name} ({project.vessel.code})
            </p>
          ) : null}
        </div>
      </div>
      <dl className="mt-2 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Start</dt>
          <dd className="font-medium">{fmtDate(projectStart)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Dock entry</dt>
          <dd className="font-medium">{fmtDate(dockEntry)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Days elapsed</dt>
          <dd className="font-medium">{elapsed != null ? String(elapsed) : "—"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Target ready</dt>
          <dd className="font-medium">{fmtDate(targetReady)}</dd>
        </div>
      </dl>
    </div>
  );
}

export function DailyReportForm({
  mode,
  reportId,
  initial,
  project: projectProp,
  saving,
  error,
  onSubmit,
  cancelFallbackHref = "/superintendent/monitoring/daily-reports",
}: Props) {
  const [projectId, setProjectId] = useState(initial.dryDockProjectId);
  const [reportDate, setReportDate] = useState(initial.reportDate);
  const [weatherCondition, setWeatherCondition] = useState(initial.weatherCondition);
  const [progressPct, setProgressPct] = useState(initial.progressPct);
  const [sections, setSections] = useState<DailyReportSections>(initial.sections);
  const [project, setProject] = useState<DailyReportProjectMeta | null | undefined>(projectProp);

  useEffect(() => {
    setProject(projectProp);
  }, [projectProp]);

  useEffect(() => {
    if (mode === "edit") return;
    if (!projectId) {
      setProject(null);
      return;
    }
    let cancelled = false;
    void fetch(`/api/superintendent/projects/${projectId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { project?: DailyReportProjectMeta & Record<string, unknown> } | null) => {
        if (cancelled || !d?.project) return;
        const p = d.project;
        setProject({
          id: p.id,
          name: p.name,
          referenceCode: (p.referenceCode as string | null) ?? null,
          plannedStart: (p.plannedStart as string | null) ?? null,
          plannedEnd: (p.plannedEnd as string | null) ?? null,
          actualStart: (p.actualStart as string | null) ?? null,
          expectedSailing: (p.expectedSailing as string | null) ?? null,
          vessel: (p.vessel as DailyReportProjectMeta["vessel"]) ?? null,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [mode, projectId]);

  function updateSection(key: keyof DailyReportSections, workDone: string) {
    setSections((prev) => ({ ...prev, [key]: { workDone } }));
  }

  return (
    <div className="space-y-4">
      <ActiveProjectBanner />
      <HeaderStrip project={project} reportDate={reportDate} />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            dryDockProjectId: projectId,
            reportDate,
            weatherCondition,
            progressPct,
            sections,
          });
        }}
      >
        <div className="grid gap-4 rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-4">
          {mode === "create" ? (
            <div className="sm:col-span-2">
              <DryDockProjectSelect value={projectId} onChange={setProjectId} required />
            </div>
          ) : null}
          <DatePickerField
            id="reportDate"
            name="reportDate"
            label="Report date *"
            value={reportDate}
            onValueChange={setReportDate}
            required
          />
          <div className="space-y-2">
            <Label htmlFor="weatherCondition">Weather</Label>
            <Input
              id="weatherCondition"
              value={weatherCondition}
              onChange={(e) => setWeatherCondition(e.target.value)}
              placeholder="e.g. Clear, light rain"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="progressPct">Progress %</Label>
            <Input
              id="progressPct"
              type="number"
              min={0}
              max={100}
              value={progressPct}
              onChange={(e) => setProgressPct(e.target.value)}
            />
          </div>
        </div>

        {mode === "create" && !reportId ? (
          <p className="text-xs text-muted-foreground">
            Save the report to attach section photos.
          </p>
        ) : null}

        <Accordion multiple defaultValue={[...DAILY_REPORT_SECTION_KEYS]} className="rounded-md border px-3">
          {DAILY_REPORT_SECTION_KEYS.map((key) => {
            const filled = sections[key].workDone.trim().length > 0;
            return (
              <AccordionItem key={key} value={key}>
                <AccordionTrigger className="hover:no-underline">
                  <span className="flex items-center gap-2">
                    {DAILY_REPORT_SECTION_LABELS[key]}
                    {filled ? (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                        filled
                      </span>
                    ) : (
                      <span className="text-[10px] font-normal text-muted-foreground">empty</span>
                    )}
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3 pb-1">
                    <div className="space-y-1.5">
                      <Label htmlFor={`section-${key}`}>Work done</Label>
                      <Textarea
                        id={`section-${key}`}
                        rows={3}
                        value={sections[key].workDone}
                        onChange={(e) => updateSection(key, e.target.value)}
                        placeholder={
                          key === "painting"
                            ? "Painting progress for the day…"
                            : "Compact summary of work completed…"
                        }
                      />
                    </div>
                    {reportId ? (
                      <DailyReportSectionPhotos reportId={reportId} sectionKey={key} />
                    ) : null}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>

        <EntityFormActions saving={saving} cancelFallbackHref={cancelFallbackHref} />
      </form>
    </div>
  );
}

export function blankDailyReportFormValues(dryDockProjectId = ""): DailyReportFormValues {
  return {
    dryDockProjectId,
    reportDate: toDateInput(new Date().toISOString()),
    weatherCondition: "",
    progressPct: "",
    sections: emptyDailyReportSections(),
  };
}
