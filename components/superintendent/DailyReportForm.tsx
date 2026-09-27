"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Building2,
  CalendarDays,
  CircleDot,
  ClipboardList,
  FileText,
  GripVertical,
  HardHat,
  ImageIcon,
  ListChecks,
  MapPin,
  PaintBucket,
  Save,
  Send,
  Ship,
  Target,
  Trash2,
  Users,
  UserRound,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ActiveProjectBanner } from "@/components/superintendent/ActiveProjectBanner";
import { DailyReportDraftPreviewButton } from "@/components/superintendent/DailyReportDraftPreviewButton";
import { DailyReportPointPhotos, type PendingPointPhoto, type PendingPointPhotoUpload } from "@/components/superintendent/DailyReportSectionPhotos";
import { DryDockProjectSelect } from "@/components/superintendent/DryDockProjectSelect";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DatePickerField, toDateInput } from "@/components/ui/DatePickerField";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Textarea } from "@/components/ui/textarea";
import { useGoBack } from "@/hooks/useGoBack";
import {
  DAILY_REPORT_SECTION_KEYS,
  DAILY_REPORT_SECTION_LABELS,
  countFilledSections,
  daysElapsedSinceDockEntry,
  emptyDailyReportPoint,
  emptyDailyReportSections,
  pointsToWorkDone,
  type DailyReportPoint,
  type DailyReportSectionKey,
  type DailyReportSections,
} from "@/lib/superintendent/dailyReportSections";
import { fmtDate } from "@/lib/superintendent/formatters";
import { cn } from "@/lib/utils";

export type DailyReportProjectMeta = {
  id: string;
  name: string;
  referenceCode: string | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  actualStart: string | null;
  expectedSailing: string | null;
  selectedYard?: string | null;
  portLocation?: string | null;
  status?: string | null;
  vessel?: { id: string; name: string; code: string } | null;
};

export type DailyReportFormValues = {
  dryDockProjectId: string;
  reportNumber?: string | null;
  reportDate: string;
  weatherCondition: string;
  progressPct: string;
  sections: DailyReportSections;
  /** Staged attachments (create flow) — uploaded after the report is created. */
  pendingPhotos?: PendingPointPhotoUpload[];
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

const SECTION_ICONS: Record<DailyReportSectionKey, LucideIcon> = {
  deck_crew: Users,
  engine_crew: Wrench,
  third_party: HardHat,
  shipyard: Building2,
  painting: PaintBucket,
  class_attendance: ClipboardList,
};

const QUICK_NOTES = [
  "Add point-wise work details for each department.",
  "Photos are optional, but recommended for clear records.",
  "Label each image if added (e.g. area, activity, before/after).",
  "Attach reports or references only when available.",
  "Save draft regularly and submit at end of day.",
];

type SectionStatus = "Not Started" | "In Progress" | "Complete";

function sectionStatus(points: DailyReportPoint[]): SectionStatus {
  const filled = points.filter((p) => p.text.trim().length > 0);
  if (filled.length === 0) return "Not Started";
  // Complete when every non-empty row has text (all current rows filled)
  if (points.length > 0 && filled.length === points.length) return "Complete";
  return "In Progress";
}

function statusBadgeClass(status: SectionStatus) {
  if (status === "Complete") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  if (status === "In Progress") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }
  return "border-border bg-muted text-muted-foreground";
}

function overallReportStatus(sections: DailyReportSections): SectionStatus {
  const filled = countFilledSections(sections);
  if (filled === 0) return "Not Started";
  if (filled === DAILY_REPORT_SECTION_KEYS.length) return "Complete";
  return "In Progress";
}

function formatStatusLabel(raw: string | null | undefined): string {
  if (!raw?.trim()) return "—";
  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function ProjectTimelineStrip({
  project,
  reportDate,
}: {
  project: DailyReportProjectMeta | null | undefined;
  reportDate: string;
}) {
  if (!project) return null;

  const dockEntry = project.actualStart ?? project.plannedStart;
  const projectStart = project.actualStart ?? project.plannedStart;
  const targetReady = project.expectedSailing ?? project.plannedEnd;
  const elapsed =
    reportDate && dockEntry ? daysElapsedSinceDockEntry(dockEntry, reportDate) : null;

  return (
    <dl className="grid gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
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
  );
}

function MetaCell({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2 rounded-lg border bg-background px-2.5 py-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <div className="text-sm font-medium leading-snug">{children}</div>
      </div>
    </div>
  );
}

function SectionPointsEditor({
  sectionKey,
  points,
  reportId,
  onChange,
  onAttachmentCountChange,
  onPendingChange,
  onPointRemoved,
}: {
  sectionKey: DailyReportSectionKey;
  points: DailyReportPoint[];
  reportId?: string;
  onChange: (points: DailyReportPoint[]) => void;
  onAttachmentCountChange: (pointId: string, count: number) => void;
  onPendingChange: (pointId: string, sectionKey: DailyReportSectionKey, pending: PendingPointPhoto[]) => void;
  onPointRemoved: (pointId: string) => void;
}) {
  function updatePoint(
    index: number,
    patch: Partial<Pick<DailyReportPoint, "text" | "report" | "remarks">>,
  ) {
    onChange(
      points.map((p, i) => {
        if (i !== index) return p;
        const next: DailyReportPoint = { ...p, ...patch };
        if (patch.report !== undefined) {
          const trimmed = patch.report.trim();
          if (trimmed) next.report = trimmed;
          else delete next.report;
        }
        if (patch.remarks !== undefined) {
          const trimmed = patch.remarks.trim();
          if (trimmed) next.remarks = trimmed;
          else delete next.remarks;
        }
        return next;
      }),
    );
  }

  function removePoint(index: number) {
    const removed = points[index];
    if (removed) onPointRemoved(removed.id);
    onChange(points.filter((_, i) => i !== index));
  }

  function movePoint(from: number, to: number) {
    if (to < 0 || to >= points.length) return;
    const next = [...points];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  }

  if (points.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
        No work points yet. Click &quot;+ Add Point&quot; to record jobs completed.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {points.map((point, index) => (
        <li
          key={point.id}
          className="rounded-lg border bg-background p-3 shadow-sm"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData("text/plain", String(index));
            e.dataTransfer.effectAllowed = "move";
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
          }}
          onDrop={(e) => {
            e.preventDefault();
            const from = Number(e.dataTransfer.getData("text/plain"));
            if (!Number.isNaN(from) && from !== index) movePoint(from, index);
          }}
        >
          <div className="flex gap-2 sm:gap-3">
            <div className="flex shrink-0 flex-col items-center gap-1 pt-1">
              <button
                type="button"
                className="cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
                aria-label="Drag to reorder"
                title="Drag to reorder"
              >
                <GripVertical className="size-4" />
              </button>
              <span className="flex size-7 items-center justify-center rounded-full border-2 border-primary text-xs font-semibold text-primary">
                {index + 1}
              </span>
            </div>

            <div className="min-w-0 flex-1 space-y-3">
              <div className="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
                <div className="space-y-1.5">
                  <Label htmlFor={`section-${sectionKey}-pt-${point.id}`}>
                    Work done <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id={`section-${sectionKey}-pt-${point.id}`}
                    value={point.text}
                    onChange={(e) => updatePoint(index, { text: e.target.value })}
                    placeholder={
                      sectionKey === "painting"
                        ? "Painting progress item…"
                        : "Describe work completed…"
                    }
                    className="min-h-[104px] resize-y"
                  />
                  {point.report?.trim() ? (
                    <p className="rounded-md border bg-muted/30 px-2 py-1 text-xs text-muted-foreground">
                      Existing reference note: {point.report.trim()}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`section-${sectionKey}-remarks-${point.id}`}>
                    Remarks (optional)
                  </Label>
                  <Textarea
                    id={`section-${sectionKey}-remarks-${point.id}`}
                    value={point.remarks ?? ""}
                    onChange={(e) => updatePoint(index, { remarks: e.target.value })}
                    placeholder="Additional notes…"
                    className="min-h-[104px] resize-y"
                  />
                </div>
              </div>

              <DailyReportPointPhotos
                reportId={reportId}
                sectionKey={sectionKey}
                pointId={point.id}
                onCountChange={(count) => onAttachmentCountChange(point.id, count)}
                onPendingChange={(pending) => onPendingChange(point.id, sectionKey, pending)}
              />
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-1 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
              aria-label="Remove point"
              onClick={() => removePoint(index)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function SummarySidebar({
  sections,
  attachmentCounts,
}: {
  sections: DailyReportSections;
  attachmentCounts: Record<string, number>;
}) {
  const departmentsReported = countFilledSections(sections);
  const openPoints = useMemo(
    () =>
      DAILY_REPORT_SECTION_KEYS.reduce((sum, key) => {
        return sum + sections[key].points.filter((p) => p.text.trim().length > 0).length;
      }, 0),
    [sections],
  );
  const attachmentsAdded = useMemo(
    () => Object.values(attachmentCounts).reduce((a, b) => a + b, 0),
    [attachmentCounts],
  );
  const referenceNotes = useMemo(
    () =>
      DAILY_REPORT_SECTION_KEYS.reduce((sum, key) => {
        return (
          sum +
          sections[key].points.filter((p) => (p.report?.trim() ?? "").length > 0).length
        );
      }, 0),
    [sections],
  );

  return (
    <aside className="space-y-4 lg:sticky lg:top-4">
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <BarChart3 className="size-4 text-primary" />
          <h3 className="text-sm font-semibold">Today&apos;s Summary</h3>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-lg border border-blue-100 bg-blue-50/80 p-2.5">
            <Users className="mb-1 size-4 text-blue-600" />
            <p className="text-lg font-semibold tabular-nums text-blue-900">
              {departmentsReported} / {DAILY_REPORT_SECTION_KEYS.length}
            </p>
            <p className="text-[11px] leading-snug text-blue-700/80">Departments Reported</p>
          </div>
          <div className="rounded-lg border border-orange-100 bg-orange-50/80 p-2.5">
            <ListChecks className="mb-1 size-4 text-orange-600" />
            <p className="text-lg font-semibold tabular-nums text-orange-900">{openPoints}</p>
            <p className="text-[11px] leading-snug text-orange-700/80">Open Points</p>
          </div>
          <div className="rounded-lg border border-sky-100 bg-sky-50/80 p-2.5">
            <ImageIcon className="mb-1 size-4 text-sky-600" />
            <p className="text-lg font-semibold tabular-nums text-sky-900">{attachmentsAdded}</p>
            <p className="text-[11px] leading-snug text-sky-700/80">Attachments</p>
          </div>
          <div className="rounded-lg border border-violet-100 bg-violet-50/80 p-2.5">
            <FileText className="mb-1 size-4 text-violet-600" />
            <p className="text-lg font-semibold tabular-nums text-violet-900">{referenceNotes}</p>
            <p className="text-[11px] leading-snug text-violet-700/80">Reference Notes</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Target className="size-4 text-primary" />
          <h3 className="text-sm font-semibold">Department Progress</h3>
        </div>
        <ul className="space-y-3">
          {DAILY_REPORT_SECTION_KEYS.map((key) => {
            const pts = sections[key].points.filter((p) => p.text.trim().length > 0);
            const total = Math.max(pts.length, sections[key].points.length, 1);
            const done = pts.length;
            const pct = sections[key].points.length === 0 ? 0 : (done / total) * 100;
            return (
              <li key={key} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-medium">{DAILY_REPORT_SECTION_LABELS[key]}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {done}/{total}
                  </span>
                </div>
                <ProgressBar value={pct} size="sm" />
              </li>
            );
          })}
        </ul>
      </div>

      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <ClipboardList className="size-4 text-primary" />
          <h3 className="text-sm font-semibold">Quick Notes</h3>
        </div>
        <ol className="list-decimal space-y-2 pl-4 text-xs leading-relaxed text-muted-foreground">
          {QUICK_NOTES.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ol>
      </div>
    </aside>
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
  const goBack = useGoBack(cancelFallbackHref);
  const [projectId, setProjectId] = useState(initial.dryDockProjectId);
  const reportNumber = initial.reportNumber?.trim() || null;
  const [reportDate, setReportDate] = useState(initial.reportDate);
  const [weatherCondition, setWeatherCondition] = useState(initial.weatherCondition);
  const [progressPct, setProgressPct] = useState(initial.progressPct);
  const [sections, setSections] = useState<DailyReportSections>(initial.sections);
  const [fetchedProject, setFetchedProject] = useState<DailyReportProjectMeta | null>(null);
  const [preparedBy, setPreparedBy] = useState<string>("—");
  const [attachmentCounts, setAttachmentCounts] = useState<Record<string, number>>({});
  const [pendingByPoint, setPendingByPoint] = useState<
    Record<string, { sectionKey: DailyReportSectionKey; items: PendingPointPhoto[] }>
  >({});
  const [openSections, setOpenSections] = useState<string[]>([...DAILY_REPORT_SECTION_KEYS]);

  const project =
    mode === "edit"
      ? (projectProp ?? null)
      : !projectId
        ? null
        : (fetchedProject ?? projectProp ?? null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { user?: { displayName?: string | null } | null } | null) => {
        if (cancelled) return;
        const name = d?.user?.displayName?.trim();
        if (name) setPreparedBy(name);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (mode === "edit" || !projectId) return;
    let cancelled = false;
    void fetch(`/api/superintendent/projects/${projectId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { project?: DailyReportProjectMeta & Record<string, unknown> } | null) => {
        if (cancelled || !d?.project) return;
        const p = d.project;
        setFetchedProject({
          id: p.id,
          name: p.name,
          referenceCode: (p.referenceCode as string | null) ?? null,
          plannedStart: (p.plannedStart as string | null) ?? null,
          plannedEnd: (p.plannedEnd as string | null) ?? null,
          actualStart: (p.actualStart as string | null) ?? null,
          expectedSailing: (p.expectedSailing as string | null) ?? null,
          selectedYard: (p.selectedYard as string | null) ?? null,
          portLocation: (p.portLocation as string | null) ?? null,
          status: (p.status as string | null) ?? null,
          vessel: (p.vessel as DailyReportProjectMeta["vessel"]) ?? null,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [mode, projectId]);

  function updateSectionPoints(key: DailyReportSectionKey, points: DailyReportPoint[]) {
    setSections((prev) => ({
      ...prev,
      [key]: { points, workDone: pointsToWorkDone(points) },
    }));
  }

  function addPoint(key: DailyReportSectionKey) {
    const next = [...sections[key].points, emptyDailyReportPoint()];
    updateSectionPoints(key, next);
    setOpenSections((prev) => (prev.includes(key) ? prev : [...prev, key]));
  }

  function handleAttachmentCountChange(pointId: string, count: number) {
    setAttachmentCounts((prev) => {
      if (prev[pointId] === count) return prev;
      return { ...prev, [pointId]: count };
    });
  }

  function handlePendingChange(
    pointId: string,
    sectionKey: DailyReportSectionKey,
    items: PendingPointPhoto[],
  ) {
    setPendingByPoint((prev) => {
      const existing = prev[pointId]?.items ?? [];
      // Don't revoke here — the photos component owns live object URLs.
      // Only drop the registry entry when empty.
      if (items.length === 0) {
        if (!(pointId in prev)) return prev;
        const next = { ...prev };
        delete next[pointId];
        return next;
      }
      // Avoid clobbering if same reference length and ids unchanged unnecessarily
      if (
        existing.length === items.length &&
        existing.every((e, i) => e.id === items[i]?.id && e.caption === items[i]?.caption)
      ) {
        return prev;
      }
      return { ...prev, [pointId]: { sectionKey, items } };
    });
  }

  function handlePointRemoved(pointId: string) {
    setPendingByPoint((prev) => {
      const entry = prev[pointId];
      if (!entry) return prev;
      // Photos component unmounts and revokes; clear registry only.
      const next = { ...prev };
      delete next[pointId];
      return next;
    });
    setAttachmentCounts((prev) => {
      if (!(pointId in prev)) return prev;
      const next = { ...prev };
      delete next[pointId];
      return next;
    });
  }

  function sectionAttachmentCount(key: DailyReportSectionKey) {
    return sections[key].points.reduce(
      (sum, p) => sum + (attachmentCounts[p.id] ?? 0),
      0,
    );
  }

  function collectPendingUploads(keptPointIds: Set<string>): PendingPointPhotoUpload[] {
    const out: PendingPointPhotoUpload[] = [];
    for (const [pointId, entry] of Object.entries(pendingByPoint)) {
      if (!keptPointIds.has(pointId)) continue;
      for (const item of entry.items) {
        out.push({
          sectionKey: entry.sectionKey,
          pointId,
          file: item.file,
          caption: item.caption,
        });
      }
    }
    return out;
  }

  function submitForm() {
    const cleaned = { ...sections };
    const keptPointIds = new Set<string>();
    for (const key of DAILY_REPORT_SECTION_KEYS) {
      const points = sections[key].points
        .map((p) => {
          const text = p.text.trim();
          const report = p.report?.trim() ?? "";
          const remarks = p.remarks?.trim() ?? "";
          return {
            id: p.id,
            text,
            ...(report ? { report } : {}),
            ...(remarks ? { remarks } : {}),
          };
        })
        .filter((p) => p.text.length > 0);
      for (const p of points) keptPointIds.add(p.id);
      cleaned[key] = { points, workDone: pointsToWorkDone(points) };
    }
    onSubmit({
      dryDockProjectId: projectId,
      reportDate,
      weatherCondition,
      progressPct,
      sections: cleaned,
      pendingPhotos: collectPendingUploads(keptPointIds),
    });
  }

  const reportStatus = overallReportStatus(sections);
  const vesselLabel = project?.vessel
    ? `${project.vessel.name}`
    : project?.name
      ? project.name
      : "—";
  const yardLabel = project?.selectedYard?.trim() || "—";
  const locationLabel = project?.portLocation?.trim() || "—";

  return (
    <div className="space-y-4">
      <ActiveProjectBanner />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submitForm();
        }}
      >
        {/* —— Header (mockup) —— */}
        <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
                Daily Progress Report
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Dry Dock Project – Point-wise Department Reporting
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => goBack()}
              >
                Cancel
              </Button>
              <DailyReportDraftPreviewButton
                reportId={reportId}
                project={project ?? null}
                reportNumber={reportNumber}
                reportDate={reportDate}
                weatherCondition={weatherCondition}
                progressPct={progressPct}
                sections={sections}
                preparedBy={preparedBy}
                pendingByPoint={pendingByPoint}
                disabled={saving}
              />
              <Button type="submit" variant="outline" disabled={saving} className="gap-1.5">
                <Save className="size-4" />
                {saving ? "Saving…" : "Save Draft"}
              </Button>
              <Button type="submit" disabled={saving} className="gap-1.5">
                <Send className="size-4" />
                {saving ? "Saving…" : "Submit Report"}
              </Button>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            <MetaCell icon={FileText} label="Report No.">
              <span className="block truncate" title={reportNumber ?? "Assigned on save"}>
                {reportNumber ?? "Assigned on save"}
              </span>
            </MetaCell>
            <MetaCell icon={Ship} label="Vessel">
              <span className="block truncate" title={vesselLabel}>
                {vesselLabel}
              </span>
            </MetaCell>
            <MetaCell icon={Building2} label="Yard">
              <span className="block truncate" title={yardLabel}>
                {yardLabel}
              </span>
            </MetaCell>
            <MetaCell icon={CalendarDays} label="Report Date">
              <DatePickerField
                id="reportDate"
                name="reportDate"
                value={reportDate}
                onValueChange={setReportDate}
                required
                className="w-full space-y-0"
              />
            </MetaCell>
            <MetaCell icon={MapPin} label="Location">
              <span className="block truncate" title={locationLabel}>
                {locationLabel}
              </span>
            </MetaCell>
            <MetaCell icon={CircleDot} label="Status">
              <Badge
                variant="outline"
                className={cn("font-medium", statusBadgeClass(reportStatus))}
              >
                {reportStatus}
              </Badge>
            </MetaCell>
            <MetaCell icon={UserRound} label="Prepared By">
              <span className="block truncate" title={preparedBy}>
                {preparedBy}
              </span>
            </MetaCell>
          </div>

          {(mode === "create" || weatherCondition !== undefined) && (
            <div className="mt-3 grid gap-3 border-t pt-3 sm:grid-cols-2 lg:grid-cols-4">
              {mode === "create" ? (
                <div className="sm:col-span-2">
                  <DryDockProjectSelect value={projectId} onChange={setProjectId} required />
                </div>
              ) : null}
              <div className="space-y-1.5">
                <Label htmlFor="weatherCondition">Weather</Label>
                <Input
                  id="weatherCondition"
                  value={weatherCondition}
                  onChange={(e) => setWeatherCondition(e.target.value)}
                  placeholder="e.g. Clear, light rain"
                />
              </div>
              <div className="space-y-1.5">
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
          )}

          <div className="mt-3">
            <ProjectTimelineStrip project={project} reportDate={reportDate} />
          </div>

          {project?.status ? (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Project status: {formatStatusLabel(project.status)}
              {project.referenceCode ? ` · ${project.referenceCode}` : ""}
            </p>
          ) : null}
        </div>

        {mode === "create" && !reportId && Object.keys(pendingByPoint).length > 0 ? (
          <p className="text-xs text-muted-foreground">
            Staged attachments will upload when you save the report.
          </p>
        ) : null}

        {/* —— Main + sidebar —— */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-3">
            <Accordion
              multiple
              value={openSections}
              onValueChange={(v) => setOpenSections(v as string[])}
              className="space-y-3"
            >
              {DAILY_REPORT_SECTION_KEYS.map((key) => {
                const Icon = SECTION_ICONS[key];
                const points = sections[key].points;
                const filledCount = points.filter((p) => p.text.trim().length > 0).length;
                const attCount = sectionAttachmentCount(key);
                const status = sectionStatus(points);
                return (
                  <AccordionItem
                    key={key}
                    value={key}
                    className="overflow-hidden rounded-xl border bg-card shadow-sm not-last:border-b-0"
                  >
                    <div className="flex items-center gap-2 px-3 py-2 sm:px-4">
                      <AccordionTrigger className="flex-1 py-1.5 hover:no-underline">
                        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2 pr-2">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Icon className="size-4" />
                          </span>
                          <span className="font-semibold">{DAILY_REPORT_SECTION_LABELS[key]}</span>
                          <Badge
                            variant="outline"
                            className={cn("text-[10px]", statusBadgeClass(status))}
                          >
                            {status}
                          </Badge>
                          <span className="flex flex-wrap items-center gap-2 text-xs font-normal text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <ListChecks className="size-3.5" />
                              {filledCount} point{filledCount === 1 ? "" : "s"}
                            </span>
                            <span className="text-border">·</span>
                            <span className="inline-flex items-center gap-1">
                              <ImageIcon className="size-3.5" />
                              {attCount} attachment{attCount === 1 ? "" : "s"}
                            </span>
                          </span>
                        </span>
                      </AccordionTrigger>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0 gap-1 border-primary/30 text-primary hover:bg-primary/5"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          addPoint(key);
                        }}
                      >
                        + Add Point
                      </Button>
                    </div>
                    <AccordionContent className="border-t px-3 pb-3 pt-3 sm:px-4">
                      <SectionPointsEditor
                        sectionKey={key}
                        points={points}
                        reportId={reportId}
                        onChange={(pts) => updateSectionPoints(key, pts)}
                        onAttachmentCountChange={handleAttachmentCountChange}
                        onPendingChange={handlePendingChange}
                        onPointRemoved={handlePointRemoved}
                      />
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>

          <div className="min-w-0">
            <SummarySidebar sections={sections} attachmentCounts={attachmentCounts} />
          </div>
        </div>
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
