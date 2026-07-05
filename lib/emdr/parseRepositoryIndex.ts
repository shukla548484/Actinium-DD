import * as XLSX from "xlsx";
import fs from "node:fs";
import { EMDR_REPOSITORY_INDEX_PATH } from "@/lib/emdr/paths";

export type EmdrRepositoryFolderRow = {
  folder: string;
  purpose: string;
  status: string;
};

export type EmdrSprintProgressRow = {
  sprint: string;
  domain: string;
  status: string;
};

export type ParsedEmdrRepositoryIndex = {
  version: string;
  folders: EmdrRepositoryFolderRow[];
  sprintProgress: EmdrSprintProgressRow[];
};

function cellStr(value: unknown): string {
  return String(value ?? "").trim();
}

function sheetRows(workbook: XLSX.WorkBook, sheetName: string): Array<Record<string, unknown>> {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
}

export function parseEmdrRepositoryIndexBuffer(buffer: ArrayBuffer | Uint8Array): ParsedEmdrRepositoryIndex {
  const workbook = XLSX.read(buffer, { type: "array" });

  const folders: EmdrRepositoryFolderRow[] = sheetRows(workbook, "Repository_Index")
    .map((row) => ({
      folder: cellStr(row["Folder"]),
      purpose: cellStr(row["Purpose"]),
      status: cellStr(row["Status"]),
    }))
    .filter((r) => r.folder);

  const sprintProgress: EmdrSprintProgressRow[] = sheetRows(workbook, "Sprint_Progress")
    .map((row) => ({
      sprint: cellStr(row["Sprint"]),
      domain: cellStr(row["Domain"]),
      status: cellStr(row["Status"]),
    }))
    .filter((r) => r.sprint);

  return { version: "V2.0", folders, sprintProgress };
}

export function parseEmdrRepositoryIndexFile(path: string): ParsedEmdrRepositoryIndex {
  const workbook = XLSX.readFile(path);
  const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  return parseEmdrRepositoryIndexBuffer(bytes);
}

export function parseEmdrRepositoryIndexIfExists(
  path: string = EMDR_REPOSITORY_INDEX_PATH,
): ParsedEmdrRepositoryIndex | null {
  if (!fs.existsSync(path)) return null;
  try {
    return parseEmdrRepositoryIndexFile(path);
  } catch {
    return null;
  }
}
