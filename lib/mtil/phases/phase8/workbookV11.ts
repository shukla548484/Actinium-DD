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

export const PHASE8_WORKBOOK_V11_FILENAME =
  "Actinium_SM_MTIL_Phase_8_Safety_LSA_FFA_Accommodation_v1.1.xlsx";

export const PHASE8_WORKBOOK_V11_PATH = path.join(
  process.cwd(),
  "data/mtil",
  PHASE8_WORKBOOK_V11_FILENAME,
);

export const PHASE8_WORKBOOK_V11_VERSION = "MTIL-v1.1";

let cachedWorkbook: ParsedMtilWorkbook | null = null;

export function loadPhase8WorkbookV11(): ParsedMtilWorkbook {
  if (!cachedWorkbook) {
    cachedWorkbook = parseMtilWorkbookFileIfExists(PHASE8_WORKBOOK_V11_PATH);
  }
  return cachedWorkbook;
}

export function getPhase8WorkbookV11Stats(data: ParsedMtilWorkbook = loadPhase8WorkbookV11()) {
  return {
    ...getWorkbookStats(data, {
      phase: 8,
      source: "workbook_v1.1",
      idPrefix: "SAF-LSA",
      version: data.libraryVersion ?? PHASE8_WORKBOOK_V11_VERSION,
    }),
    initializedOnly: data.initializedOnly ?? false,
  };
}

export function generatePhase8WorkbookJobLibraryTree(data: ParsedMtilWorkbook = loadPhase8WorkbookV11()) {
  const stats = getPhase8WorkbookV11Stats(data);
  const tree = buildWorkbookJobLibraryTree({
    data,
    treeCode: "mtil_p8_safety_lsa_v11",
    treeName: "Safety, LSA, FFA & Accommodation — Engineering Repository v1.1",
    categoryCode: "safety_lsa_v11",
    categoryName: "Safety, LSA, FFA & Accommodation (v1.1)",
    department: "Safety, LSA, FFA & Accommodation",
    phase: 8,
    source: "workbook_v1.1",
    idPrefix: stats.idPrefix,
    libraryVersion: stats.libraryVersion,
    jobCount: stats.jobCount,
    catalogTemplateCount: stats.catalogTemplateCount,
  });

  if (data.initializedOnly && stats.jobCount === 0) {
    tree.description =
      `${stats.libraryVersion} initialized — schema and tabs ready; curated jobs pending (LSA, FFA, accommodation, safety equipment, lifeboats, davits, firefighting).`;
    tree.children = [
      {
        code: "safety_lsa_v11",
        name: "Safety, LSA, FFA & Accommodation (v1.1)",
        nodeType: "category",
        department: "Safety, LSA, FFA & Accommodation",
        description: "Phase initialized — detailed job library to be populated in next release.",
        children: [],
      },
    ];
  }

  return tree;
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
