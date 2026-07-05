import path from "node:path";
import type { ParsedMasterJobRow, ParsedMtilWorkbook } from "@/lib/mtil/import/parseWorkbook";
import { parseMtilWorkbookFile } from "@/lib/mtil/import/parseWorkbook";
import { buildWorkbookJobLibraryTree } from "@/lib/mtil/phases/shared/buildWorkbookJobLibraryTree";
import {
  buildWorkbookRuntimeFields,
  getWorkbookJobById,
  getWorkbookStats,
  getWorkbookTemplateById,
  getWorkbookTemplateByKey,
  keyToTemplateId,
  templateIdToKey,
  workbookTemplatesToDynamicDefs,
} from "@/lib/mtil/phases/shared/workbookUtils";

export const PHASE1_WORKBOOK_V04_FILENAME = "Actinium_SM_MTIL_Phase_1_Main_Propulsion_v0.4.xlsx";

export const PHASE1_WORKBOOK_V04_PATH = path.join(
  process.cwd(),
  "data/mtil",
  PHASE1_WORKBOOK_V04_FILENAME,
);

export const PHASE1_WORKBOOK_V04_VERSION = "MTIL-v0.4";

let cachedWorkbook: ParsedMtilWorkbook | null = null;

export function loadPhase1WorkbookV04(): ParsedMtilWorkbook {
  if (!cachedWorkbook) {
    cachedWorkbook = parseMtilWorkbookFile(PHASE1_WORKBOOK_V04_PATH);
  }
  return cachedWorkbook;
}

export function getPhase1WorkbookV04Stats(data: ParsedMtilWorkbook = loadPhase1WorkbookV04()) {
  return getWorkbookStats(data, {
    phase: 1,
    source: "workbook_v0.4",
    idPrefix: "ENG-ME",
    version: PHASE1_WORKBOOK_V04_VERSION,
  });
}

export function generatePhase1WorkbookJobLibraryTree(data: ParsedMtilWorkbook = loadPhase1WorkbookV04()) {
  const stats = getPhase1WorkbookV04Stats(data);
  return buildWorkbookJobLibraryTree({
    data,
    treeCode: "mtil_p1_main_propulsion_v04",
    treeName: "Main Propulsion — Engineering Repository v0.4",
    categoryCode: "main_propulsion_v04",
    categoryName: "Main Propulsion (v0.4)",
    department: "Main Propulsion",
    phase: 1,
    source: "workbook_v0.4",
    idPrefix: stats.idPrefix,
    libraryVersion: stats.libraryVersion,
    jobCount: stats.jobCount,
    catalogTemplateCount: stats.catalogTemplateCount,
  });
}

export {
  buildWorkbookRuntimeFields,
  getWorkbookJobById,
  getWorkbookTemplateById,
  getWorkbookTemplateByKey,
  keyToTemplateId,
  templateIdToKey,
  workbookTemplatesToDynamicDefs,
};

export type { ParsedMasterJobRow };
