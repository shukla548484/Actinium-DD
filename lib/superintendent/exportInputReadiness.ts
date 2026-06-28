import * as XLSX from "xlsx";
import type { CombinedInputReadinessReport, InputReadinessReport } from "@/lib/db/superintendent/inputs";
import { INPUT_PAGE_LABELS } from "@/lib/superintendent/inputCatalog/constants";
import { getInputSectionDef } from "@/lib/superintendent/inputCatalog";

const STATUS_LABEL: Record<string, string> = {
  missing: "Not started",
  draft: "Draft",
  submitted: "Submitted",
  reviewed: "Reviewed",
  approved: "Approved",
  rejected: "Rejected",
  inactive: "Inactive",
};

export function inputReadinessToWorkbook(
  report: InputReadinessReport,
  meta: { projectName: string; referenceCode: string | null; vesselName: string },
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  const summaryRows: (string | number)[][] = [
    ["Pre-dock readiness report"],
    ["Project", meta.projectName],
    ["Reference", meta.referenceCode ?? ""],
    ["Vessel", meta.vesselName],
    ["Project type", report.projectType],
    ["Page", report.pageKey],
    [],
    ["Overall completion %", report.completionPct],
    ["Sections complete", `${report.completedSections}/${report.totalSections}`],
    ["Mandatory complete", `${report.mandatoryCompleted}/${report.mandatorySections}`],
    ["Pending review", report.pendingReview],
    ["Approved", report.approved],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), "Summary");

  const detailHeader = ["Section", "Mandatory", "Status"];
  const detailRows: (string | number)[][] = [
    detailHeader,
    ...report.sections.map((s) => [
      s.label,
      s.mandatory ? "Yes" : "No",
      STATUS_LABEL[s.status] ?? s.status,
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(detailRows), "Sections");

  return wb;
}

export function inputReadinessToBuffer(
  report: InputReadinessReport,
  meta: { projectName: string; referenceCode: string | null; vesselName: string },
): Buffer {
  const wb = inputReadinessToWorkbook(report, meta);
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

export function combinedReadinessToWorkbook(
  report: CombinedInputReadinessReport,
  meta: { projectName: string; referenceCode: string | null; vesselName: string },
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const { overall } = report;

  const summaryRows: (string | number)[][] = [
    ["Combined input readiness report"],
    ["Project", meta.projectName],
    ["Reference", meta.referenceCode ?? ""],
    ["Vessel", meta.vesselName],
    ["Project type", report.projectType],
    [],
    ["Overall completion %", overall.completionPct],
    ["Sections complete", `${overall.completedSections}/${overall.totalSections}`],
    ["Mandatory complete", `${overall.mandatoryCompleted}/${overall.mandatorySections}`],
    ["Pending review", overall.pendingReview],
    ["Approved", overall.approved],
    [],
    ["Role", "Complete", "Mandatory", "Pending review", "Approved", "Completion %"],
    ...Object.entries(report.byPage).map(([key, page]) => [
      INPUT_PAGE_LABELS[page!.pageKey] ?? key,
      `${page!.completedSections}/${page!.totalSections}`,
      `${page!.mandatoryCompleted}/${page!.mandatorySections}`,
      page!.pendingReview,
      page!.approved,
      page!.completionPct,
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), "Summary");

  for (const page of Object.values(report.byPage)) {
    if (!page || page.totalSections === 0) continue;
    const sheetName = (INPUT_PAGE_LABELS[page.pageKey] ?? page.pageKey).slice(0, 31);
    const rows: (string | number)[][] = [
      ["Section", "Mandatory", "Status"],
      ...page.sections.map((s) => [
        s.label,
        s.mandatory ? "Yes" : "No",
        STATUS_LABEL[s.status] ?? s.status,
      ]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sheetName);
  }

  return wb;
}

export function combinedReadinessToBuffer(
  report: CombinedInputReadinessReport,
  meta: { projectName: string; referenceCode: string | null; vesselName: string },
): Buffer {
  const wb = combinedReadinessToWorkbook(report, meta);
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

/** Resolve section label from catalog when building combined reports. */
export function sectionLabel(sectionKey: string): string {
  return getInputSectionDef(sectionKey)?.label ?? sectionKey;
}
