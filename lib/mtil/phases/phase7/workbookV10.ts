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

export const PHASE7_WORKBOOK_V10_FILENAME = "Actinium_SM_MTIL_Phase_7_Cargo_Tank_Systems_v1.0.xlsx";

export const PHASE7_WORKBOOK_V10_PATH = path.join(
  process.cwd(),
  "data/mtil",
  PHASE7_WORKBOOK_V10_FILENAME,
);

export const PHASE7_WORKBOOK_V10_VERSION = "MTIL-v1.0";

let cachedWorkbook: ParsedMtilWorkbook | null = null;

export function loadPhase7WorkbookV10(): ParsedMtilWorkbook {
  if (!cachedWorkbook) {
    cachedWorkbook = parseMtilWorkbookFile(PHASE7_WORKBOOK_V10_PATH);
  }
  return cachedWorkbook;
}

export function getPhase7WorkbookV10Stats(data: ParsedMtilWorkbook = loadPhase7WorkbookV10()) {
  return {
    ...getWorkbookStats(data, {
      phase: 7,
      source: "workbook_v1.0",
      idPrefix: "CGO-TNK",
      version: data.libraryVersion ?? PHASE7_WORKBOOK_V10_VERSION,
    }),
    initializedOnly: data.initializedOnly ?? false,
  };
}

export function generatePhase7WorkbookJobLibraryTree(data: ParsedMtilWorkbook = loadPhase7WorkbookV10()) {
  const stats = getPhase7WorkbookV10Stats(data);
  const tree = buildWorkbookJobLibraryTree({
    data,
    treeCode: "mtil_p7_cargo_tank_v10",
    treeName: "Cargo & Tank Systems — Engineering Repository v1.0",
    categoryCode: "cargo_tank_v10",
    categoryName: "Cargo & Tank Systems (v1.0)",
    department: "Cargo & Tank Systems",
    phase: 7,
    source: "workbook_v1.0",
    idPrefix: stats.idPrefix,
    libraryVersion: stats.libraryVersion,
    jobCount: stats.jobCount,
    catalogTemplateCount: stats.catalogTemplateCount,
  });

  if (data.initializedOnly && stats.jobCount === 0) {
    tree.description =
      `${stats.libraryVersion} initialized — schema and tabs ready; curated jobs pending (Cargo tanks, cargo pumps, IG, COW, ballast, tank gauging, vapor systems).`;
    tree.children = [
      {
        code: "cargo_tank_v10",
        name: "Cargo & Tank Systems (v1.0)",
        nodeType: "category",
        department: "Cargo & Tank Systems",
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
