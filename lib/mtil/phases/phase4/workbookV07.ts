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

export const PHASE4_WORKBOOK_V07_FILENAME = "Actinium_SM_MTIL_Phase_4_Deck_Machinery_Cargo_v0.7.xlsx";

export const PHASE4_WORKBOOK_V07_PATH = path.join(
  process.cwd(),
  "data/mtil",
  PHASE4_WORKBOOK_V07_FILENAME,
);

export const PHASE4_WORKBOOK_V07_VERSION = "MTIL-v0.7";

let cachedWorkbook: ParsedMtilWorkbook | null = null;

export function loadPhase4WorkbookV07(): ParsedMtilWorkbook {
  if (!cachedWorkbook) {
    cachedWorkbook = parseMtilWorkbookFileIfExists(PHASE4_WORKBOOK_V07_PATH);
  }
  return cachedWorkbook;
}

export function getPhase4WorkbookV07Stats(data: ParsedMtilWorkbook = loadPhase4WorkbookV07()) {
  return getWorkbookStats(data, {
    phase: 4,
    source: "workbook_v0.7",
    idPrefix: "DECK-DCG",
    version: PHASE4_WORKBOOK_V07_VERSION,
  });
}

export function generatePhase4WorkbookJobLibraryTree(data: ParsedMtilWorkbook = loadPhase4WorkbookV07()) {
  const stats = getPhase4WorkbookV07Stats(data);
  return buildWorkbookJobLibraryTree({
    data,
    treeCode: "mtil_p4_deck_cargo_v07",
    treeName: "Deck Machinery & Cargo — Engineering Repository v0.7",
    categoryCode: "deck_cargo_v07",
    categoryName: "Deck Machinery & Cargo (v0.7)",
    department: "Deck Machinery & Cargo",
    phase: 4,
    source: "workbook_v0.7",
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
