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

export const PHASE2_WORKBOOK_V05_FILENAME = "Actinium_SM_MTIL_Phase_2_Auxiliary_Machinery_v0.5.xlsx";

export const PHASE2_WORKBOOK_V05_PATH = path.join(
  process.cwd(),
  "data/mtil",
  PHASE2_WORKBOOK_V05_FILENAME,
);

export const PHASE2_WORKBOOK_V05_VERSION = "MTIL-v0.5";

let cachedWorkbook: ParsedMtilWorkbook | null = null;

export function loadPhase2WorkbookV05(): ParsedMtilWorkbook {
  if (!cachedWorkbook) {
    cachedWorkbook = parseMtilWorkbookFile(PHASE2_WORKBOOK_V05_PATH);
  }
  return cachedWorkbook;
}

export function getPhase2WorkbookV05Stats(data: ParsedMtilWorkbook = loadPhase2WorkbookV05()) {
  return getWorkbookStats(data, {
    phase: 2,
    source: "workbook_v0.5",
    idPrefix: "ENG-AUX",
    version: PHASE2_WORKBOOK_V05_VERSION,
  });
}

export function generatePhase2WorkbookJobLibraryTree(data: ParsedMtilWorkbook = loadPhase2WorkbookV05()) {
  const stats = getPhase2WorkbookV05Stats(data);
  return buildWorkbookJobLibraryTree({
    data,
    treeCode: "mtil_p2_auxiliary_v05",
    treeName: "Auxiliary Machinery — Engineering Repository v0.5",
    categoryCode: "auxiliary_machinery_v05",
    categoryName: "Auxiliary Machinery (v0.5)",
    department: "Auxiliary Machinery",
    phase: 2,
    source: "workbook_v0.5",
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
