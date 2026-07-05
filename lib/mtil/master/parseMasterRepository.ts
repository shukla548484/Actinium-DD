import * as XLSX from "xlsx";
import fs from "node:fs";
import { cellStr } from "@/lib/mtil/import/excelValues";

export const MASTER_REPOSITORY_SHEETS = {
  dashboard: "00_Master_Dashboard",
  repository: "01_Master_Repository",
  projectTemplates: "02_Project_Templates",
  engineeringDomains: "03_Engineering_Domains",
  masterLibraries: "04_Master_Libraries",
  technicalData: "05_Technical_Data",
} as const;

export type MasterRepositoryArea = {
  sheet: string;
  area: string;
  status: string;
};

export type ParsedMasterRepository = {
  release: string | null;
  libraryVersion: string | null;
  status: string | null;
  objective: string | null;
  targetJobs: string | null;
  targetTemplates: string | null;
  frameworkOnly: boolean;
  initializedOnly: boolean;
  areas: {
    repository: MasterRepositoryArea[];
    projectTemplates: MasterRepositoryArea[];
    engineeringDomains: MasterRepositoryArea[];
    masterLibraries: MasterRepositoryArea[];
    technicalData: MasterRepositoryArea[];
  };
  frameworkAreaCount: number;
  engineeringDomainCount: number;
};

function sheetRows(workbook: XLSX.WorkBook, sheetName: string): Array<Record<string, unknown>> {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
}

function parseDashboard(workbook: XLSX.WorkBook) {
  const rows = sheetRows(workbook, MASTER_REPOSITORY_SHEETS.dashboard);
  const metrics: Record<string, string> = {};
  for (const row of rows) {
    const key = cellStr(row["Metric"]);
    if (key) metrics[key] = cellStr(row["Value"]);
  }
  return {
    release: metrics["Release"] || null,
    libraryVersion: metrics["Library Version"] || null,
    status: metrics["Status"] || null,
    objective: metrics["Objective"] || null,
    targetJobs: metrics["Target"] || null,
    targetTemplates: metrics["Target Templates"] || null,
  };
}

function parseFrameworkAreas(workbook: XLSX.WorkBook, sheetName: string): MasterRepositoryArea[] {
  return sheetRows(workbook, sheetName)
    .map((row) => {
      const area = cellStr(row["Repository Area"]);
      if (!area || area.toLowerCase() === "repository area") return null;
      return {
        sheet: sheetName,
        area,
        status: cellStr(row["Status"]) || "Framework Created",
      };
    })
    .filter((row): row is MasterRepositoryArea => row !== null);
}

function isFrameworkOnly(status: string | null): boolean {
  if (!status) return true;
  const lower = status.toLowerCase();
  return (
    lower.includes("framework") ||
    lower.includes("foundation") ||
    lower.includes("ready for detailed") ||
    lower.includes("initialized")
  );
}

export function parseMasterRepositoryBuffer(buffer: ArrayBuffer | Uint8Array): ParsedMasterRepository {
  const workbook = XLSX.read(buffer, { type: "array" });
  const dashboard = parseDashboard(workbook);

  const repository = parseFrameworkAreas(workbook, MASTER_REPOSITORY_SHEETS.repository);
  const projectTemplates = parseFrameworkAreas(workbook, MASTER_REPOSITORY_SHEETS.projectTemplates);
  const engineeringDomains = parseFrameworkAreas(workbook, MASTER_REPOSITORY_SHEETS.engineeringDomains);
  const masterLibraries = parseFrameworkAreas(workbook, MASTER_REPOSITORY_SHEETS.masterLibraries);
  const technicalData = parseFrameworkAreas(workbook, MASTER_REPOSITORY_SHEETS.technicalData);

  const frameworkAreaCount =
    repository.length +
    projectTemplates.length +
    engineeringDomains.length +
    masterLibraries.length +
    technicalData.length;

  const frameworkOnly = isFrameworkOnly(dashboard.status);

  return {
    ...dashboard,
    frameworkOnly,
    initializedOnly: frameworkOnly,
    areas: {
      repository,
      projectTemplates,
      engineeringDomains,
      masterLibraries,
      technicalData,
    },
    frameworkAreaCount,
    engineeringDomainCount: engineeringDomains.length,
  };
}

export function parseMasterRepositoryFile(path: string): ParsedMasterRepository {
  const workbook = XLSX.readFile(path);
  const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  return parseMasterRepositoryBuffer(bytes);
}

export function emptyParsedMasterRepository(): ParsedMasterRepository {
  return {
    release: null,
    libraryVersion: null,
    status: null,
    objective: null,
    targetJobs: null,
    targetTemplates: null,
    frameworkOnly: true,
    initializedOnly: true,
    areas: {
      repository: [],
      projectTemplates: [],
      engineeringDomains: [],
      masterLibraries: [],
      technicalData: [],
    },
    frameworkAreaCount: 0,
    engineeringDomainCount: 0,
  };
}

export function parseMasterRepositoryFileIfExists(path: string): ParsedMasterRepository {
  if (!fs.existsSync(path)) return emptyParsedMasterRepository();
  try {
    return parseMasterRepositoryFile(path);
  } catch {
    return emptyParsedMasterRepository();
  }
}
