"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";
import {
  DAILY_REPORT_SECTION_KEYS,
  DAILY_REPORT_SECTION_LABELS,
  daysElapsedSinceDockEntry,
  type DailyReportSections,
} from "@/lib/superintendent/dailyReportSections";
import { fmtDate, fmtPct } from "@/lib/superintendent/formatters";

export const dynamic = "force-dynamic";

type ProjectMeta = {
  name: string;
  referenceCode: string | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  actualStart: string | null;
  expectedSailing: string | null;
  vessel?: { name: string; code: string } | null;
};

type Report = {
  id: string;
  reportDate: string;
  weatherCondition: string | null;
  progressPct: number | null;
  sections: DailyReportSections;
};

export default function DailyReportPrintPage() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<Report | null>(null);
  const [project, setProject] = useState<ProjectMeta | null>(null);
  const [attachmentsBySection, setAttachmentsBySection] = useState<
    Record<string, { fileUrl: string; fileName: string }[]>
  >({});

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/superintendent/daily-reports/${id}`);
        const d = (await res.json()) as { dailyReport?: Report; project?: ProjectMeta };
        if (d.dailyReport) setReport(d.dailyReport);
        if (d.project) setProject(d.project);

        const attRes = await fetch(`/api/superintendent/daily-reports/${id}/attachments`);
        if (attRes.ok) {
          const attData = (await attRes.json()) as {
            attachments: { sectionKey: string; fileUrl: string; fileName: string }[];
          };
          const map: Record<string, { fileUrl: string; fileName: string }[]> = {};
          for (const a of attData.attachments ?? []) {
            (map[a.sectionKey] ??= []).push({ fileUrl: a.fileUrl, fileName: a.fileName });
          }
          setAttachmentsBySection(map);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <PageShell>
        <ActiniumLoadingState size="sm" />
      </PageShell>
    );
  }

  if (!report) {
    return (
      <PageShell>
        <p className="text-sm text-destructive">Record not found.</p>
      </PageShell>
    );
  }

  const dockEntry = project?.actualStart ?? project?.plannedStart ?? null;
  const projectStart = project?.actualStart ?? project?.plannedStart ?? null;
  const targetReady = project?.expectedSailing ?? project?.plannedEnd ?? null;
  const elapsed = dockEntry ? daysElapsedSinceDockEntry(dockEntry, report.reportDate) : null;

  return (
    <PageShell>
      <PageHeader
        title="Daily report"
        description={fmtDate(report.reportDate)}
        actions={
          <div className="flex gap-2 print:hidden">
            <Button
              variant="outline"
              render={<Link href={`/superintendent/monitoring/daily-reports/${id}/edit`} />}
              nativeButton={false}
            >
              Edit
            </Button>
            <Button type="button" onClick={() => window.print()}>
              Print / PDF
            </Button>
          </div>
        }
      />

      <article className="mx-auto max-w-3xl space-y-6 print:max-w-none">
        <header className="space-y-2 border-b pb-4">
          <h1 className="text-xl font-semibold">
            {project?.name ?? "Daily report"}
            {project?.referenceCode ? (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {project.referenceCode}
              </span>
            ) : null}
          </h1>
          {project?.vessel ? (
            <p className="text-sm text-muted-foreground">
              {project.vessel.name} ({project.vessel.code})
            </p>
          ) : null}
          <dl className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Report date</dt>
              <dd className="font-medium">{fmtDate(report.reportDate)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Weather</dt>
              <dd className="font-medium">{report.weatherCondition?.trim() || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Progress</dt>
              <dd className="font-medium">{fmtPct(report.progressPct)}</dd>
            </div>
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
        </header>

        {DAILY_REPORT_SECTION_KEYS.map((key) => {
          const work = report.sections[key].workDone.trim();
          const photos = attachmentsBySection[key] ?? [];
          if (!work && photos.length === 0) return null;
          return (
            <section key={key} className="space-y-2 break-inside-avoid">
              <h2 className="text-base font-semibold">{DAILY_REPORT_SECTION_LABELS[key]}</h2>
              {work ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{work}</p>
              ) : (
                <p className="text-sm text-muted-foreground">No work recorded.</p>
              )}
              {photos.length > 0 ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {photos.map((p) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={p.fileUrl}
                      src={p.fileUrl}
                      alt={p.fileName}
                      className="h-32 w-full rounded border object-cover"
                    />
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}
      </article>
    </PageShell>
  );
}
