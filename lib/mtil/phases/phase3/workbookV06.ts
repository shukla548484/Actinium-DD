import path from "node:path";
import type { ParsedMasterJobRow, ParsedMtilWorkbook } from "@/lib/mtil/import/parseWorkbook";
import { parseMtilWorkbookFileIfExists } from "@/lib/mtil/import/parseWorkbook";
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

export const PHASE3_WORKBOOK_V06_FILENAME = "Actinium_SM_MTIL_Phase_3_Pumps_Valves_Piping_v0.6.xlsx";

export const PHASE3_WORKBOOK_V06_PATH = path.join(
  process.cwd(),
  "data/mtil",
  PHASE3_WORKBOOK_V06_FILENAME,
);

export const PHASE3_WORKBOOK_V06_VERSION = "MTIL-v0.6";

let cachedWorkbook: ParsedMtilWorkbook | null = null;

export function loadPhase3WorkbookV06(): ParsedMtilWorkbook {
  if (!cachedWorkbook) {
    cachedWorkbook = parseMtilWorkbookFileIfExists(PHASE3_WORKBOOK_V06_PATH);
  }
  return cachedWorkbook;
}

export function getPhase3WorkbookV06Stats(data: ParsedMtilWorkbook = loadPhase3WorkbookV06()) {
  return getWorkbookStats(data, {
    phase: 3,
    source: "workbook_v0.6",
    idPrefix: "ENG-PVP",
    version: PHASE3_WORKBOOK_V06_VERSION,
  });
}

export function generatePhase3WorkbookJobLibraryTree(data: ParsedMtilWorkbook = loadPhase3WorkbookV06()) {
  const stats = getPhase3WorkbookV06Stats(data);
  return buildWorkbookJobLibraryTree({
    data,
    treeCode: "mtil_p3_pvp_v06",
    treeName: "Pumps, Valves & Piping — Engineering Repository v0.6",
    categoryCode: "pvp_v06",
    categoryName: "Pumps, Valves & Piping (v0.6)",
    department: "Pumps, Valves & Piping",
    phase: 3,
    source: "workbook_v0.6",
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
