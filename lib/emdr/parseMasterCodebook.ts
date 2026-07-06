import * as XLSX from "xlsx";
import fs from "node:fs";
import { EMDR_MASTER_CODEBOOK_PATH } from "@/lib/emdr/paths";

export type EmdrEntityCodeRow = {
  code: string;
  entity: string;
  purpose: string;
  exampleId: string;
};

export type EmdrSystemCodeRow = {
  systemCode: string;
  systemName: string;
  description: string;
};

export type EmdrReleaseIndexRow = {
  release: string;
  engineeringDomain: string;
  status: "Completed" | "Pending" | "In Progress" | string;
  workbook: string;
  sprintId?: string;
};

export type EmdrImportOrderRow = {
  order: number;
  tableSheet: string;
  entityCode: string;
  validationRule: string;
};

export type ParsedEmdrMasterCodebook = {
  version: string;
  entityCodes: EmdrEntityCodeRow[];
  systemCodes: EmdrSystemCodeRow[];
  releaseIndex: EmdrReleaseIndexRow[];
  importOrder: EmdrImportOrderRow[];
};

function cellStr(value: unknown): string {
  return String(value ?? "").trim();
}

function sheetRows(workbook: XLSX.WorkBook, sheetName: string): Array<Record<string, unknown>> {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
}

const RELEASE_TO_SPRINT_ID: Record<string, string> = {
  "V2.0.1-S1": "v201-s1",
  "V2.0.1-S2": "v201-s2",
  "V2.0.1-S3": "v201-s3",
  "V2.0.1-S4": "v201-s4",
  "V2.0.1-S5": "v201-s5",
};

export function parseEmdrMasterCodebookBuffer(buffer: ArrayBuffer | Uint8Array): ParsedEmdrMasterCodebook {
  const workbook = XLSX.read(buffer, { type: "array" });

  const entityCodes: EmdrEntityCodeRow[] = sheetRows(workbook, "01_Entity_Codes")
    .map((row) => ({
      code: cellStr(row["4 Letter Code"]),
      entity: cellStr(row["Entity"]),
      purpose: cellStr(row["Purpose"]),
      exampleId: cellStr(row["Example ID"]),
    }))
    .filter((r) => r.code);

  const systemCodes: EmdrSystemCodeRow[] = sheetRows(workbook, "02_System_Codes")
    .map((row) => ({
      systemCode: cellStr(row["System Code"]),
      systemName: cellStr(row["System Name"]),
      description: cellStr(row["Description"]),
    }))
    .filter((r) => r.systemCode);

  const releaseIndex: EmdrReleaseIndexRow[] = sheetRows(workbook, "03_Release_Index")
    .map((row) => {
      const release = cellStr(row["Release"]);
      return {
        release,
        engineeringDomain: cellStr(row["Engineering Domain"]),
        status: cellStr(row["Status"]) || "Pending",
        workbook: cellStr(row["Workbook"]),
        sprintId: RELEASE_TO_SPRINT_ID[release],
      };
    })
    .filter((r) => r.release);

  const importOrder: EmdrImportOrderRow[] = sheetRows(workbook, "04_Import_Order")
    .map((row) => ({
      order: Number(row["Order"]) || 0,
      tableSheet: cellStr(row["Table / Sheet"]),
      entityCode: cellStr(row["Entity Code"]),
      validationRule: cellStr(row["Validation Rule"]),
    }))
    .filter((r) => r.order > 0)
    .sort((a, b) => a.order - b.order);

  return {
    version: "V2.0",
    entityCodes,
    systemCodes,
    releaseIndex,
    importOrder,
  };
}

export function parseEmdrMasterCodebookFile(path: string): ParsedEmdrMasterCodebook {
  const workbook = XLSX.readFile(path);
  const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  return parseEmdrMasterCodebookBuffer(bytes);
}

export function parseEmdrMasterCodebookIfExists(
  path: string = EMDR_MASTER_CODEBOOK_PATH,
): ParsedEmdrMasterCodebook | null {
  if (!fs.existsSync(path)) return null;
  try {
    return parseEmdrMasterCodebookFile(path);
  } catch {
    return null;
  }
}
