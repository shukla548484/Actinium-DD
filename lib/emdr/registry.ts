import fs from "node:fs";
import path from "node:path";
import {
  MASTER_CODE_ENTITY_CATALOG,
  MASTER_CODE_STANDARD_VERSION,
  MASTER_EQUIPMENT_SYSTEM_CODES,
} from "@/lib/mtil/masterCodeStandard";
import {
  parseEmdrMasterCodebookIfExists,
  type ParsedEmdrMasterCodebook,
} from "@/lib/emdr/parseMasterCodebook";
import {
  parseEmdrRepositoryIndexIfExists,
  type ParsedEmdrRepositoryIndex,
} from "@/lib/emdr/parseRepositoryIndex";
import {
  isEmdrMasterRepositoryPresent,
  EMDR_CODE_STANDARD_PATH,
  EMDR_MASTER_CODEBOOK_PATH,
  EMDR_REPOSITORY_INDEX_PATH,
  EMDR_VERSION,
  MTIL_V2_WORKBOOKS_DIR,
  emdrWorkbookPath,
} from "@/lib/emdr/paths";
import { getEmdrMasterRepositoryWorkbookStats } from "@/lib/emdr/v3/v30JobLibraryTree";
import { V2_SPRINT_REGISTRY, type V2SprintDefinition } from "@/lib/mtil/v2/sprints/registry";

export type EmdrSprintAvailability = V2SprintDefinition & {
  emdrRelease: string;
  status: string;
  workbookPresent: boolean;
  workbookPath: string | null;
};

export type EmdrRegistryReport = {
  version: string;
  masterCodeStandardVersion: string;
  codeStandardPresent: boolean;
  codebookPresent: boolean;
  indexPresent: boolean;
  idFormat: string;
  codebook: ParsedEmdrMasterCodebook;
  repositoryIndex: ParsedEmdrRepositoryIndex | null;
  sprints: EmdrSprintAvailability[];
  pendingReleases: { release: string; domain: string }[];
  v30MasterRepository: {
    present: boolean;
    kind: "v33" | "v32" | "v31" | "v30" | null;
    release: string;
    jobCount: number;
    mainEngineJobCount: number;
    auxiliaryEngineJobCount: number;
    boilerJobCount?: number;
    pumpJobCount?: number;
    systemCount: number;
    supersedesV201Sprints: boolean;
  } | null;
};

function fallbackCodebook(): ParsedEmdrMasterCodebook {
  return {
    version: EMDR_VERSION,
    entityCodes: MASTER_CODE_ENTITY_CATALOG.map((row) => ({
      code: row.code,
      entity: row.label,
      purpose: row.description,
      exampleId: `${row.code}-ME-CYU-0001`,
    })),
    systemCodes: Object.entries(MASTER_EQUIPMENT_SYSTEM_CODES).map(([systemCode, systemName]) => ({
      systemCode,
      systemName,
      description: systemName,
    })),
    releaseIndex: V2_SPRINT_REGISTRY.map((s, i) => ({
      release: `V2.0.1-S${i + 1}`,
      engineeringDomain: s.name,
      status: "Completed",
      workbook: s.filename,
      sprintId: s.id,
    })),
    importOrder: [
      { order: 1, tableSheet: "Equipment Master", entityCode: "EQPM", validationRule: "Equipment Code must be unique" },
      { order: 2, tableSheet: "Component Master", entityCode: "COMP", validationRule: "Component Code must be unique and Equipment Code must exist" },
      { order: 3, tableSheet: "Template Master", entityCode: "TMPL", validationRule: "Template ID must be unique" },
      { order: 4, tableSheet: "Job Master", entityCode: "JOBS", validationRule: "Job ID unique and Template ID exists" },
      { order: 5, tableSheet: "Measurement Master", entityCode: "MEAS", validationRule: "Measurement ID unique and Template ID exists" },
      { order: 6, tableSheet: "Inspection Master", entityCode: "INSP", validationRule: "Inspection ID unique and Template ID exists" },
      { order: 7, tableSheet: "Scope Master", entityCode: "SCOP", validationRule: "Scope ID unique and Template ID exists" },
      { order: 8, tableSheet: "Tools / Instruments", entityCode: "TOOL", validationRule: "Tool ID unique" },
      { order: 9, tableSheet: "Spare / Consumable Mapping", entityCode: "SPAR/CONS", validationRule: "Job ID and Template ID exist" },
      { order: 10, tableSheet: "RFQ / Budget Mapping", entityCode: "RFQM/BDGT", validationRule: "Job ID exists" },
      { order: 11, tableSheet: "Workflow Master", entityCode: "WORK", validationRule: "Template ID exists" },
    ],
  };
}

export function getEmdrCodebook(): ParsedEmdrMasterCodebook {
  return parseEmdrMasterCodebookIfExists() ?? fallbackCodebook();
}

export function getEmdrRepositoryIndex(): ParsedEmdrRepositoryIndex | null {
  return parseEmdrRepositoryIndexIfExists();
}

export function getEmdrEntityCodes() {
  return getEmdrCodebook().entityCodes;
}

export function getEmdrSystemCodes() {
  return getEmdrCodebook().systemCodes;
}

export function getEmdrImportOrder() {
  return getEmdrCodebook().importOrder;
}

/** Prefer EMDR bundle workbooks, fall back to legacy data/mtil/v2 copy. */
export function resolveSprintWorkbookPath(sprint: V2SprintDefinition): string {
  const emdrPath = emdrWorkbookPath(sprint.filename);
  if (fs.existsSync(emdrPath)) return emdrPath;
  return path.join(MTIL_V2_WORKBOOKS_DIR, sprint.filename);
}

export function getEmdrRegistryReport(): EmdrRegistryReport {
  const codebook = getEmdrCodebook();
  const repositoryIndex = getEmdrRepositoryIndex();
  const releaseBySprintId = new Map(
    codebook.releaseIndex.filter((r) => r.sprintId).map((r) => [r.sprintId!, r]),
  );

  const sprints: EmdrSprintAvailability[] = V2_SPRINT_REGISTRY.map((sprint) => {
    const releaseRow = releaseBySprintId.get(sprint.id);
    const workbookPath = resolveSprintWorkbookPath(sprint);
    const workbookPresent = fs.existsSync(workbookPath);
    return {
      ...sprint,
      emdrRelease: releaseRow?.release ?? sprint.id,
      status: workbookPresent ? "Completed" : (releaseRow?.status ?? "Pending"),
      workbookPresent,
      workbookPath: workbookPresent ? workbookPath : null,
    };
  });

  const pendingReleases = codebook.releaseIndex
    .filter((r) => {
      const sprint = V2_SPRINT_REGISTRY.find((s) => s.id === r.sprintId);
      if (sprint && fs.existsSync(resolveSprintWorkbookPath(sprint))) return false;
      return r.status.toLowerCase() === "pending" || !r.workbook;
    })
    .map((r) => ({ release: r.release, domain: r.engineeringDomain }));

  const emdrStats = isEmdrMasterRepositoryPresent() ? getEmdrMasterRepositoryWorkbookStats() : null;

  return {
    version: EMDR_VERSION,
    masterCodeStandardVersion: MASTER_CODE_STANDARD_VERSION,
    codeStandardPresent: fs.existsSync(EMDR_CODE_STANDARD_PATH),
    codebookPresent: fs.existsSync(EMDR_MASTER_CODEBOOK_PATH),
    indexPresent: fs.existsSync(EMDR_REPOSITORY_INDEX_PATH),
    idFormat: "<EntityCode>-<SystemCode>-<SubSystemCode>-<RunningNumber>",
    codebook,
    repositoryIndex,
    sprints,
    pendingReleases,
    v30MasterRepository: emdrStats?.workbookPresent
      ? {
          present: true,
          kind: emdrStats.kind,
          release: emdrStats.release ?? "V3.0-ME-100",
          jobCount: emdrStats.jobCount,
          mainEngineJobCount: emdrStats.mainEngineJobCount,
          auxiliaryEngineJobCount: emdrStats.auxiliaryEngineJobCount,
          boilerJobCount: emdrStats.boilerJobCount,
          pumpJobCount: emdrStats.pumpJobCount,
          systemCount: emdrStats.systemCount,
          supersedesV201Sprints: true,
        }
      : null,
  };
}
