import fs from "node:fs";
import * as XLSX from "xlsx";
import { EMDR_V40_METADATA_OVERLAY_PATH } from "@/lib/emdr/paths";

function cellStr(value: unknown): string {
  return String(value ?? "").trim();
}

export type V40JobMetadataOverlay = {
  v4RowId: number;
  sourceVersion: string;
  sourceModule: string;
  sourceFile: string;
  originalJobCode: string;
  jobCode: string;
  machineryFamily: string;
  machinerySystem: string;
  component: string;
  jobHeading: string;
  jobType: string;
  jobDescription: string;
  frequencyType: string;
  frequencyInterval: string;
  triggerBasis: string;
  criticality: string;
  pic: string;
  verifyingAuthority: string;
  dryDockScope: string;
  vesselTypeApplicability: string;
  rfqWorkshopCategory: string;
  projectSurveyType: string;
  duplicateCrossRef: string;
  remarks: string;
};

function normalizeOverlayKey(jobCode: string): string {
  return jobCode.replace(/^JOBS-/i, "").toUpperCase();
}

function parseOverlayRow(row: Record<string, unknown>): V40JobMetadataOverlay | null {
  const originalJobCode = cellStr(row["Original Job Code / ID"]);
  const jobCode = cellStr(row["Job Code"]) || originalJobCode;
  if (!jobCode) return null;

  return {
    v4RowId: Number(row["V4 Row ID"]) || 0,
    sourceVersion: cellStr(row["Source Version"]),
    sourceModule: cellStr(row["Source Module"]),
    sourceFile: cellStr(row["Source File"]),
    originalJobCode,
    jobCode,
    machineryFamily: cellStr(row["Machinery Family"]),
    machinerySystem: cellStr(row["Machinery / System"]),
    component: cellStr(row["Component / Sub-Component"]),
    jobHeading: cellStr(row["Job Heading"]),
    jobType: cellStr(row["Job Type"]),
    jobDescription: cellStr(row["Job Description / Scope"]),
    frequencyType: cellStr(row["Frequency Type"]),
    frequencyInterval: cellStr(row["Frequency Interval"]),
    triggerBasis: cellStr(row["Trigger / Basis"]),
    criticality: cellStr(row["Criticality"]),
    pic: cellStr(row["PIC"]),
    verifyingAuthority: cellStr(row["Verifying Authority"]),
    dryDockScope: cellStr(row["Dry Dock Scope"]),
    vesselTypeApplicability: cellStr(row["Vessel Type Applicability"]),
    rfqWorkshopCategory: cellStr(row["RFQ / Workshop Category"]),
    projectSurveyType: cellStr(row["Project / Survey Type"]),
    duplicateCrossRef: cellStr(row["Duplicate Control / Cross Reference"]),
    remarks: cellStr(row["Remarks"] ?? row["Final Master Remarks"]),
  };
}

export type V40MetadataOverlayIndex = {
  path: string;
  rows: V40JobMetadataOverlay[];
  byCanonicalJobId: Map<string, V40JobMetadataOverlay>;
  byOverlayKey: Map<string, V40JobMetadataOverlay>;
};

export function loadV40MetadataOverlay(path: string = EMDR_V40_METADATA_OVERLAY_PATH): V40MetadataOverlayIndex | null {
  if (!fs.existsSync(path)) return null;

  const workbook = XLSX.readFile(path);
  const sheet =
    workbook.Sheets["01_Combined_Job_Master"] ??
    workbook.Sheets[workbook.SheetNames.find((name) => /combined.*job/i.test(name)) ?? ""];
  if (!sheet) return null;

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const rows = rawRows.map(parseOverlayRow).filter((row): row is V40JobMetadataOverlay => row !== null);

  const byCanonicalJobId = new Map<string, V40JobMetadataOverlay>();
  const byOverlayKey = new Map<string, V40JobMetadataOverlay>();

  for (const row of rows) {
    const keys = new Set<string>();
    for (const code of [row.jobCode, row.originalJobCode]) {
      if (!code) continue;
      keys.add(code);
      keys.add(`JOBS-${normalizeOverlayKey(code)}`);
      keys.add(normalizeOverlayKey(code));
    }
    for (const key of keys) {
      if (!byCanonicalJobId.has(key)) byCanonicalJobId.set(key, row);
    }
    const overlayKey = normalizeOverlayKey(row.jobCode || row.originalJobCode);
    if (!byOverlayKey.has(overlayKey)) byOverlayKey.set(overlayKey, row);
  }

  return { path, rows, byCanonicalJobId, byOverlayKey };
}

export function resolveV40OverlayForJobId(
  index: V40MetadataOverlayIndex | null,
  canonicalJobId: string,
): V40JobMetadataOverlay | undefined {
  if (!index) return undefined;
  return (
    index.byCanonicalJobId.get(canonicalJobId) ??
    index.byCanonicalJobId.get(normalizeOverlayKey(canonicalJobId)) ??
    index.byOverlayKey.get(normalizeOverlayKey(canonicalJobId))
  );
}
