"use client";

import { useState } from "react";
import { Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PendingPointPhoto } from "@/components/superintendent/DailyReportSectionPhotos";
import {
  DAILY_REPORT_SECTION_KEYS,
  DAILY_REPORT_SECTION_LABELS,
  type DailyReportSectionKey,
  type DailyReportSections,
} from "@/lib/superintendent/dailyReportSections";
import { fmtDate } from "@/lib/superintendent/formatters";

type DraftProject = {
  name: string;
  referenceCode: string | null;
  plannedStart: string | null;
  plannedEnd: string | null;
  actualStart: string | null;
  expectedSailing: string | null;
  selectedYard?: string | null;
  portLocation?: string | null;
  vessel?: { name: string; code: string } | null;
} | null;

type PendingByPoint = Record<
  string,
  { sectionKey: DailyReportSectionKey; items: PendingPointPhoto[] }
>;

type StoredAttachment = {
  id: string;
  sectionKey: string;
  pointId: string | null;
  fileName: string;
  fileUrl: string;
  mimeType: string | null;
  caption: string | null;
};

type PreviewAttachment = {
  id: string;
  pointId: string;
  sectionKey: string;
  fileName: string;
  caption: string;
  kind: "photo" | "document";
  src: string | null;
  pages?: string[];
};

type Props = {
  reportId?: string;
  project: DraftProject;
  reportNumber?: string | null;
  reportDate: string;
  weatherCondition: string;
  progressPct: string;
  sections: DailyReportSections;
  preparedBy: string;
  pendingByPoint: PendingByPoint;
  disabled?: boolean;
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isStoredImage(item: StoredAttachment): boolean {
  return (
    item.mimeType?.startsWith("image/") === true ||
    /\.(png|jpe?g|jfif|webp|gif|bmp|heic|heif|avif|tiff?)$/i.test(item.fileName)
  );
}

function readFileAsDataUrl(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

async function buildPendingAttachments(pendingByPoint: PendingByPoint): Promise<PreviewAttachment[]> {
  const result: PreviewAttachment[] = [];
  for (const [pointId, entry] of Object.entries(pendingByPoint)) {
    for (const item of entry.items) {
      const src =
        item.kind === "photo"
          ? item.previewUrl || (await readFileAsDataUrl(item.file))
          : null;
      let pages: string[] | undefined;
      if (item.kind === "document") {
        const formData = new FormData();
        formData.set("file", item.file);
        const response = await fetch(
          "/api/superintendent/daily-reports/document-preview",
          { method: "POST", body: formData },
        );
        if (!response.ok) throw new Error("Document conversion failed");
        const data = (await response.json()) as { token: string; pages: number };
        pages = Array.from(
          { length: data.pages },
          (_, index) =>
            `/api/superintendent/daily-reports/document-preview?token=${encodeURIComponent(
              data.token,
            )}&page=${index + 1}`,
        );
      }
      result.push({
        id: item.id,
        pointId,
        sectionKey: entry.sectionKey,
        fileName: item.file.name,
        caption: item.caption.trim(),
        kind: item.kind,
        src,
        pages,
      });
    }
  }
  return result;
}

function renderAttachmentBlock(items: PreviewAttachment[]): string {
  const photos = items.filter((item) => item.kind === "photo");
  const documents = items.filter((item) => item.kind === "document");
  const documentsHtml =
    documents.length > 0
      ? `<div class="references">
          <div class="subheading">Report / Reference</div>
          <ul>
            ${documents
              .map(
                (item) =>
                  `<li><strong>${escapeHtml(item.caption || item.fileName)}</strong>${
                    item.caption ? ` <span>(${escapeHtml(item.fileName)})</span>` : ""
                  }</li>`,
              )
              .join("")}
          </ul>
        </div>`
      : "";
  const photosHtml =
    photos.length > 0
      ? `<div class="photo-grid">
          ${photos
            .map((item) => {
              const image = item.src
                ? `<img src="${escapeHtml(item.src)}" alt="${escapeHtml(item.caption || item.fileName)}" />`
                : `<div class="photo-missing">Preview unavailable</div>`;
              return `<figure>
                ${image}
                <figcaption>${escapeHtml(item.caption || item.fileName)}</figcaption>
              </figure>`;
            })
            .join("")}
        </div>`
      : "";
  return documentsHtml + photosHtml;
}

function renderDocumentAppendix(items: PreviewAttachment[]): string {
  const documents = items.filter((item) => item.kind === "document");
  return documents
    .flatMap((item) =>
      (item.pages ?? []).map(
        (src, index) => `<section class="document-page">
          <div class="document-heading">
            <strong>${escapeHtml(item.caption || item.fileName)}</strong>
            <span>Attachment page ${index + 1} of ${item.pages?.length ?? 0}</span>
          </div>
          <img src="${escapeHtml(src)}" alt="${escapeHtml(
            `${item.fileName}, page ${index + 1}`,
          )}" />
        </section>`,
      ),
    )
    .join("");
}

function renderDraftHtml(input: {
  project: DraftProject;
  reportNumber?: string | null;
  reportDate: string;
  weatherCondition: string;
  progressPct: string;
  sections: DailyReportSections;
  preparedBy: string;
  attachments: PreviewAttachment[];
}): string {
  const {
    project,
    reportNumber,
    reportDate,
    weatherCondition,
    progressPct,
    sections,
    preparedBy,
    attachments,
  } = input;
  const sectionsWithContent = DAILY_REPORT_SECTION_KEYS.filter((key) => {
    const hasWork = sections[key].points.some(
      (point) => point.text.trim() || point.remarks?.trim() || point.report?.trim(),
    );
    return hasWork || attachments.some((item) => item.sectionKey === key);
  });

  const documentAppendix = renderDocumentAppendix(attachments);

  const overview =
    sectionsWithContent.length === 0
      ? '<p class="empty">No activity has been entered in this draft.</p>'
      : sectionsWithContent
          .map((key) => {
            const points = sections[key].points.filter(
              (point) => point.text.trim() || point.remarks?.trim() || point.report?.trim(),
            );
            const count = attachments.filter((item) => item.sectionKey === key).length;
            return `<div class="overview-row">
              <div>
                <strong>${escapeHtml(DAILY_REPORT_SECTION_LABELS[key])}</strong>
                <span>${points.length} work point${points.length === 1 ? "" : "s"}</span>
              </div>
              <span>${count} attachment${count === 1 ? "" : "s"}</span>
            </div>`;
          })
          .join("");

  const details = sectionsWithContent
    .map((key) => {
      const points = sections[key].points.filter(
        (point) => point.text.trim() || point.remarks?.trim() || point.report?.trim(),
      );
      const knownPointIds = new Set(points.map((point) => point.id));
      const sectionAttachments = attachments.filter((item) => item.sectionKey === key);
      const pointRows = points
        .map((point, index) => {
          const pointAttachments = sectionAttachments.filter((item) => item.pointId === point.id);
          return `<div class="point">
            <div class="point-title">
              <span class="point-number">${index + 1}</span>
              <div>
                <div class="work-text">${escapeHtml(point.text.trim() || "Work description pending")}</div>
                ${
                  point.report?.trim()
                    ? `<p><strong>Reference:</strong> ${escapeHtml(point.report.trim())}</p>`
                    : ""
                }
                ${
                  point.remarks?.trim()
                    ? `<p><strong>Remarks:</strong> ${escapeHtml(point.remarks.trim())}</p>`
                    : ""
                }
              </div>
            </div>
            ${renderAttachmentBlock(pointAttachments)}
          </div>`;
        })
        .join("");
      const otherAttachments = sectionAttachments.filter(
        (item) => !item.pointId || !knownPointIds.has(item.pointId),
      );
      return `<section class="section-page">
        <h2>${escapeHtml(DAILY_REPORT_SECTION_LABELS[key])}</h2>
        ${pointRows || '<p class="empty">No work points entered.</p>'}
        ${
          otherAttachments.length > 0
            ? `<div class="other-attachments"><h3>Other section attachments</h3>${renderAttachmentBlock(
                otherAttachments,
              )}</div>`
            : ""
        }
      </section>`;
    })
    .join("");

  const vessel = project?.vessel
    ? `${project.vessel.name} (${project.vessel.code})`
    : project?.name || "-";
  const start = project?.actualStart ?? project?.plannedStart ?? null;
  const target = project?.expectedSailing ?? project?.plannedEnd ?? null;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Draft Daily Report - ${escapeHtml(reportDate)}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #edf2f5; color: #172033; font-family: Arial, Helvetica, sans-serif; font-size: 12px; line-height: 1.45; }
    .toolbar { position: sticky; top: 0; z-index: 5; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 20px; background: #102a43; color: white; }
    .toolbar strong { font-size: 14px; }
    .toolbar button { border: 0; border-radius: 6px; background: white; color: #102a43; padding: 9px 14px; font-weight: 700; cursor: pointer; }
    .page { position: relative; width: min(210mm, calc(100% - 32px)); min-height: 277mm; margin: 20px auto; padding: 15mm; background: white; box-shadow: 0 5px 24px rgba(15, 23, 42, .12); overflow: hidden; }
    .watermark { position: absolute; right: 15mm; top: 12mm; border: 2px solid #c23b3b; color: #c23b3b; padding: 4px 10px; font-size: 12px; font-weight: 800; letter-spacing: 1px; transform: rotate(-4deg); }
    h1 { margin: 0 100px 3px 0; font-size: 22px; color: #102a43; }
    .subtitle { margin: 0; color: #526579; }
    .meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 18px 0; }
    .meta div { border: 1px solid #d8e0e8; padding: 8px; min-height: 48px; }
    .meta span { display: block; margin-bottom: 3px; color: #6b7c8e; font-size: 9px; font-weight: 700; text-transform: uppercase; }
    h2 { margin: 0 0 12px; border-bottom: 2px solid #2b6cb0; padding-bottom: 6px; color: #163a5f; font-size: 17px; }
    h3 { margin: 12px 0 6px; font-size: 13px; }
    .overview-row { display: flex; justify-content: space-between; gap: 16px; border-bottom: 1px solid #e4e9ee; padding: 9px 0; }
    .overview-row div { display: flex; gap: 10px; }
    .overview-row span { color: #607286; }
    .section-page { break-before: page; page-break-before: always; }
    .point { break-inside: avoid; margin-bottom: 18px; border-bottom: 1px solid #e4e9ee; padding-bottom: 14px; }
    .point-title { display: grid; grid-template-columns: 26px 1fr; gap: 8px; }
    .point-number { display: flex; width: 24px; height: 24px; align-items: center; justify-content: center; border: 1px solid #2b6cb0; border-radius: 50%; color: #2b6cb0; font-weight: 700; }
    .work-text { white-space: pre-wrap; font-size: 13px; font-weight: 700; }
    .point p { margin: 4px 0 0; color: #4d6073; white-space: pre-wrap; }
    .subheading { margin-bottom: 4px; font-weight: 700; }
    .references { margin: 9px 0 0 32px; border-left: 3px solid #7b61b3; background: #f7f5fb; padding: 8px 10px; }
    .references ul { margin: 4px 0 0; padding-left: 18px; }
    .references span { color: #68798a; }
    .photo-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 10px 0 0 32px; }
    figure { margin: 0; break-inside: avoid; }
    figure img, .photo-missing { display: block; width: 100%; height: 120px; border: 1px solid #cfdae4; background: #f4f7f9; object-fit: cover; }
    .photo-missing { display: flex; align-items: center; justify-content: center; color: #778899; font-size: 10px; }
    figcaption { padding-top: 4px; color: #4d6073; font-size: 10px; overflow-wrap: anywhere; }
    .empty { color: #718096; font-style: italic; }
    .other-attachments { break-inside: avoid; border-top: 1px solid #d8e0e8; padding-top: 6px; }
    .document-page { break-before: page; page-break-before: always; }
    .document-heading { display: flex; justify-content: space-between; gap: 12px; border-bottom: 1px solid #d8e0e8; padding-bottom: 6px; margin-bottom: 8px; font-size: 10px; }
    .document-heading span { color: #718096; }
    .document-page img { display: block; width: 100%; max-height: 255mm; object-fit: contain; }
    .footer { margin-top: 24px; border-top: 1px solid #d8e0e8; padding-top: 8px; color: #718096; font-size: 10px; }
    @media print {
      body { background: white; }
      .toolbar { display: none; }
      .page { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; overflow: visible; }
      .section-page { padding-top: 2mm; }
      .watermark { right: 0; top: 0; }
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    @media (max-width: 760px) {
      .meta { grid-template-columns: repeat(2, 1fr); }
      .photo-grid { grid-template-columns: repeat(2, 1fr); margin-left: 0; }
      .page { padding: 18px; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div><strong>Draft PDF Preview</strong><div>Review the report before saving.</div></div>
    <button id="print-draft" type="button">Print / Save PDF</button>
  </div>
  <main class="page">
    <div class="watermark">DRAFT</div>
    <header>
      <h1>Daily Progress Report</h1>
      <p class="subtitle">${escapeHtml(project?.name || "Dry Dock Project")}${
        project?.referenceCode ? ` - ${escapeHtml(project.referenceCode)}` : ""
      }</p>
    </header>
    <div class="meta">
      <div><span>Report Number</span><strong>${escapeHtml(reportNumber || "Assigned on save")}</strong></div>
      <div><span>Vessel</span><strong>${escapeHtml(vessel)}</strong></div>
      <div><span>Yard</span><strong>${escapeHtml(project?.selectedYard || "-")}</strong></div>
      <div><span>Report Date</span><strong>${escapeHtml(fmtDate(reportDate))}</strong></div>
      <div><span>Weather</span><strong>${escapeHtml(weatherCondition.trim() || "-")}</strong></div>
      <div><span>Progress</span><strong>${escapeHtml(progressPct.trim() ? `${progressPct}%` : "-")}</strong></div>
      <div><span>Prepared By</span><strong>${escapeHtml(preparedBy)}</strong></div>
      <div><span>Location</span><strong>${escapeHtml(project?.portLocation || "-")}</strong></div>
      <div><span>Project Start</span><strong>${escapeHtml(fmtDate(start))}</strong></div>
      <div><span>Target Ready</span><strong>${escapeHtml(fmtDate(target))}</strong></div>
    </div>
    <h2>Brief Overview</h2>
    ${overview}
    ${details}
    ${documentAppendix}
    <div class="footer">Draft preview generated from the current unsaved report. Review before submission.</div>
  </main>
</body>
</html>`;
}

export function DailyReportDraftPreviewButton({
  reportId,
  project,
  reportNumber,
  reportDate,
  weatherCondition,
  progressPct,
  sections,
  preparedBy,
  pendingByPoint,
  disabled,
}: Props) {
  const [preparing, setPreparing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  async function openPreview() {
    setPreviewError(null);
    const previewWindow = window.open("", "_blank");
    if (!previewWindow) {
      setPreviewError("Allow pop-ups for this site to open the draft PDF preview.");
      return;
    }

    previewWindow.document.write(
      '<!doctype html><title>Preparing draft preview</title><p style="font-family:Arial;padding:24px">Preparing draft PDF preview...</p>',
    );
    setPreparing(true);

    try {
      const pending = await buildPendingAttachments(pendingByPoint);
      let stored: PreviewAttachment[] = [];

      if (reportId) {
        const response = await fetch(
          `/api/superintendent/daily-reports/${reportId}/attachments`,
        );
        if (response.ok) {
          const data = (await response.json()) as { attachments?: StoredAttachment[] };
          stored = await Promise.all(
            (data.attachments ?? []).map(async (item) => {
              const image = isStoredImage(item);
              let pages: string[] | undefined;
              if (!image) {
                const metaResponse = await fetch(
                  `/api/superintendent/daily-reports/${reportId}/attachments/${item.id}/document-pages?meta=1`,
                );
                if (!metaResponse.ok) throw new Error("Document conversion failed");
                const meta = (await metaResponse.json()) as { pages: number };
                pages = Array.from(
                  { length: meta.pages },
                  (_, index) =>
                    `/api/superintendent/daily-reports/${reportId}/attachments/${item.id}/document-pages?page=${index + 1}`,
                );
              }
              return {
                id: item.id,
                pointId: item.pointId ?? "",
                sectionKey: item.sectionKey,
                fileName: item.fileName,
                caption: item.caption?.trim() ?? "",
                kind: image ? ("photo" as const) : ("document" as const),
                src: image
                  ? `/api/superintendent/daily-reports/${reportId}/attachments/${item.id}/preview`
                  : null,
                pages,
              };
            }),
          );
        }
      }

      previewWindow.document.open();
      previewWindow.document.write(
        renderDraftHtml({
          project,
          reportNumber,
          reportDate,
          weatherCondition,
          progressPct,
          sections,
          preparedBy,
          attachments: [...stored, ...pending],
        }),
      );
      previewWindow.document.close();
      const printButton = previewWindow.document.getElementById(
        "print-draft",
      ) as HTMLButtonElement | null;
      const previewImages = Array.from(previewWindow.document.images);
      if (printButton) {
        printButton.disabled = true;
        printButton.textContent = "Preparing pages...";
      }
      await Promise.all(
        previewImages.map(
          (image) =>
            new Promise<void>((resolve) => {
              if (image.complete) {
                resolve();
                return;
              }
              image.addEventListener("load", () => resolve(), { once: true });
              image.addEventListener("error", () => resolve(), { once: true });
            }),
        ),
      );
      if (printButton) {
        printButton.disabled = false;
        printButton.textContent = "Print / Save PDF";
        printButton.addEventListener("click", () => previewWindow.print());
      }
    } catch {
      previewWindow.close();
      setPreviewError("The draft preview could not be prepared. Please try again.");
    } finally {
      setPreparing(false);
    }
  }

  return (
    <div className="flex flex-col items-start">
      <Button
        type="button"
        variant="outline"
        disabled={disabled || preparing}
        className="gap-1.5"
        onClick={() => void openPreview()}
      >
        {preparing ? <Loader2 className="size-4 animate-spin" /> : <Eye className="size-4" />}
        {preparing ? "Preparing..." : "Preview Draft PDF"}
      </Button>
      {previewError ? (
        <p className="mt-1 max-w-64 text-xs text-destructive">{previewError}</p>
      ) : null}
    </div>
  );
}
