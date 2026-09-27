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
  sectionHasWork,
  sectionPoints,
  type DailyReportPoint,
  type DailyReportSections,
} from "@/lib/superintendent/dailyReportSections";
import { fmtDate, fmtPct } from "@/lib/superintendent/formatters";
import {
  dailyReportFileKindLabel,
  isDailyReportImageAttachment,
  isDailyReportPdfAttachment,
} from "@/components/superintendent/DailyReportSectionPhotos";

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
  reportNumber: string;
  reportDate: string;
  weatherCondition: string | null;
  progressPct: number | null;
  sections: DailyReportSections;
};

type ReportAttachment = {
  id: string;
  fileUrl: string;
  fileName: string;
  mimeType: string | null;
  caption: string | null;
  pointId: string | null;
  sectionKey: string;
};

function attachmentsForPoint(attachments: ReportAttachment[], point: DailyReportPoint): ReportAttachment[] {
  return attachments.filter((item) => item.pointId === point.id);
}

function orphanSectionAttachments(attachments: ReportAttachment[], points: DailyReportPoint[]): ReportAttachment[] {
  const ids = new Set(points.map((p) => p.id));
  return attachments.filter((item) => !item.pointId || !ids.has(item.pointId));
}

function AttachmentReferenceList({ attachments }: { attachments: ReportAttachment[] }) {
  if (attachments.length === 0) return null;
  return (
    <div className="rounded border bg-muted/20 p-2 text-xs">
      <p className="mb-1 font-medium">Report / Reference attachments</p>
      <ul className="space-y-1">
        {attachments.map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-2">
            <span className="min-w-0">
              <a href={item.fileUrl} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                {item.caption?.trim() || item.fileName}
              </a>
              <span className="ml-1 text-muted-foreground">({dailyReportFileKindLabel(item)})</span>
            </span>
            <span className="shrink-0 text-muted-foreground">{item.fileName}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PdfReferencePages({ attachments }: { attachments: ReportAttachment[] }) {
  const pdfs = attachments.filter(isDailyReportPdfAttachment);
  if (pdfs.length === 0) return null;
  return (
    <div className="space-y-3">
      {pdfs.map((item) => (
        <section key={`pdf-${item.id}`} className="break-before-page space-y-2" style={{ breakBefore: "page" }}>
          <h3 className="border-b pb-2 text-base font-semibold">
            {item.caption?.trim() || item.fileName}
          </h3>
          <object
            data={item.fileUrl}
            type="application/pdf"
            className="h-[780px] w-full rounded border print:h-[950px]"
          >
            <p className="text-sm text-muted-foreground">
              PDF preview is not available. Open: <a href={item.fileUrl}>{item.fileName}</a>
            </p>
          </object>
        </section>
      ))}
    </div>
  );
}

export default function DailyReportPrintPage() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<Report | null>(null);
  const [project, setProject] = useState<ProjectMeta | null>(null);
  const [attachmentsBySection, setAttachmentsBySection] = useState<Record<string, ReportAttachment[]>>(
    {},
  );

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
            attachments: {
              id: string;
              sectionKey: string;
              pointId: string | null;
              fileUrl: string;
              fileName: string;
              mimeType: string | null;
              caption: string | null;
            }[];
          };
          const map: Record<string, ReportAttachment[]> = {};
          for (const a of attData.attachments ?? []) {
            (map[a.sectionKey] ??= []).push({
              id: a.id,
              sectionKey: a.sectionKey,
              pointId: a.pointId ?? null,
              fileUrl: a.fileUrl,
              fileName: a.fileName,
              mimeType: a.mimeType,
              caption: a.caption,
            });
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

  const sectionsWithContent = DAILY_REPORT_SECTION_KEYS.filter((key) => {
    const attachments = attachmentsBySection[key] ?? [];
    return sectionHasWork(report.sections[key]) || attachments.length > 0;
  });

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
        {/* —— Page 1: header + brief overview —— */}
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
              <dt className="text-muted-foreground">Report number</dt>
              <dd className="font-semibold">{report.reportNumber}</dd>
            </div>
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

        <section className="space-y-3">
          <h2 className="text-base font-semibold">Brief overview</h2>
          {sectionsWithContent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No section activity recorded.</p>
          ) : (
            <div className="space-y-3">
              {sectionsWithContent.map((key) => {
                const points = sectionPoints(report.sections[key]);
                const attachments = attachmentsBySection[key] ?? [];
                const photoCount = attachments.filter(isDailyReportImageAttachment).length;
                const documentCount = attachments.length - photoCount;
                return (
                  <div key={`brief-${key}`} className="break-inside-avoid text-sm">
                    <p className="font-medium">{DAILY_REPORT_SECTION_LABELS[key]}</p>
                    {points.length > 0 ? (
                      <ul className="mt-0.5 list-disc space-y-0.5 pl-5 text-muted-foreground">
                        {points.map((pt) => (
                          <li key={pt.id}>
                            {pt.text.trim()}
                            {pt.report?.trim() ? (
                              <span className="text-muted-foreground/80">
                                {" "}
                                — {pt.report.trim()}
                              </span>
                            ) : null}
                            {pt.remarks?.trim() ? (
                              <span className="text-muted-foreground/80">
                                {" "}
                                ({pt.remarks.trim()})
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-0.5 text-muted-foreground">No work points.</p>
                    )}
                    {photoCount > 0 || documentCount > 0 ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {photoCount > 0 ? `${photoCount} photo${photoCount === 1 ? "" : "s"}` : ""}
                        {photoCount > 0 && documentCount > 0 ? " · " : ""}
                        {documentCount > 0 ? `${documentCount} report/reference file${documentCount === 1 ? "" : "s"}` : ""}
                        {" — see section page"}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* —— Final pages: one section per page (per-point text/report/images) —— */}
        {sectionsWithContent.map((key) => {
          const points = sectionPoints(report.sections[key]);
          const attachments = attachmentsBySection[key] ?? [];
          const orphans = orphanSectionAttachments(attachments, points);
          return (
            <section
              key={`detail-${key}`}
              className="space-y-4 break-before-page pt-2"
              style={{ breakBefore: "page" }}
            >
              <h2 className="border-b pb-2 text-lg font-semibold">
                {DAILY_REPORT_SECTION_LABELS[key]}
              </h2>

              {points.length > 0 ? (
                <ol className="space-y-5">
                  {points.map((pt, i) => {
                    const pointAttachments = attachmentsForPoint(attachments, pt);
                    const pointPhotos = pointAttachments.filter(isDailyReportImageAttachment);
                    const pointDocuments = pointAttachments.filter((item) => !isDailyReportImageAttachment(item));
                    return (
                      <li key={pt.id} className="break-inside-avoid space-y-2">
                        <div className="flex gap-2 text-sm leading-relaxed">
                          <span className="shrink-0 font-medium text-muted-foreground">
                            {i + 1}.
                          </span>
                          <div className="min-w-0 space-y-1">
                            <p className="font-medium">{pt.text.trim()}</p>
                            {pt.report?.trim() ? (
                              <p className="text-muted-foreground">
                                <span className="font-medium text-foreground/80">Report: </span>
                                {pt.report.trim()}
                              </p>
                            ) : null}
                            {pt.remarks?.trim() ? (
                              <p className="text-muted-foreground">
                                <span className="font-medium text-foreground/80">Remarks: </span>
                                {pt.remarks.trim()}
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <AttachmentReferenceList attachments={pointDocuments} />
                        {pointPhotos.length > 0 ? (
                          <div className="ml-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                            {pointPhotos.map((p) => (
                              <figure key={p.fileUrl} className="break-inside-avoid space-y-1">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={p.fileUrl}
                                  alt={p.caption || p.fileName}
                                  className="h-36 w-full rounded border object-cover"
                                />
                                <figcaption className="text-xs leading-snug">
                                  {p.caption?.trim() ? (
                                    <span className="font-medium">{p.caption.trim()}</span>
                                  ) : (
                                    <span className="text-muted-foreground">{p.fileName}</span>
                                  )}
                                </figcaption>
                              </figure>
                            ))}
                          </div>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="text-sm text-muted-foreground">No work recorded.</p>
              )}

              {orphans.length > 0 ? (
                <div className="space-y-2 border-t pt-3">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Other section attachments
                  </h3>
                  <AttachmentReferenceList attachments={orphans.filter((item) => !isDailyReportImageAttachment(item))} />
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {orphans.filter(isDailyReportImageAttachment).map((p) => (
                      <figure key={p.fileUrl} className="break-inside-avoid space-y-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={p.fileUrl}
                          alt={p.caption || p.fileName}
                          className="h-36 w-full rounded border object-cover"
                        />
                        <figcaption className="text-xs leading-snug">
                          {p.caption?.trim() ? (
                            <span className="font-medium">{p.caption.trim()}</span>
                          ) : (
                            <span className="text-muted-foreground">{p.fileName}</span>
                          )}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                </div>
              ) : null}

              <PdfReferencePages attachments={attachments.filter((item) => !isDailyReportImageAttachment(item))} />
            </section>
          );
        })}
      </article>
    </PageShell>
  );
}
