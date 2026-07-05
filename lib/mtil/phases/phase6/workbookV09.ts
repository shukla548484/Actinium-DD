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

export const PHASE6_WORKBOOK_V09_FILENAME =
  "Actinium_SM_MTIL_Phase_6_Electrical_Automation_Navigation_v0.9.xlsx";

export const PHASE6_WORKBOOK_V09_PATH = path.join(
  process.cwd(),
  "data/mtil",
  PHASE6_WORKBOOK_V09_FILENAME,
);

export const PHASE6_WORKBOOK_V09_VERSION = "MTIL-v0.9";

let cachedWorkbook: ParsedMtilWorkbook | null = null;

export function loadPhase6WorkbookV09(): ParsedMtilWorkbook {
  if (!cachedWorkbook) {
    cachedWorkbook = parseMtilWorkbookFile(PHASE6_WORKBOOK_V09_PATH);
  }
  return cachedWorkbook;
}

export function getPhase6WorkbookV09Stats(data: ParsedMtilWorkbook = loadPhase6WorkbookV09()) {
  return {
    ...getWorkbookStats(data, {
      phase: 6,
      source: "workbook_v0.9",
      idPrefix: "ELC-ELC",
      version: data.libraryVersion ?? PHASE6_WORKBOOK_V09_VERSION,
    }),
    initializedOnly: data.initializedOnly ?? false,
  };
}

export function generatePhase6WorkbookJobLibraryTree(data: ParsedMtilWorkbook = loadPhase6WorkbookV09()) {
  const stats = getPhase6WorkbookV09Stats(data);
  const tree = buildWorkbookJobLibraryTree({
    data,
    treeCode: "mtil_p6_electrical_v09",
    treeName: "Electrical, Automation & Navigation — Engineering Repository v0.9",
    categoryCode: "electrical_v09",
    categoryName: "Electrical, Automation & Navigation (v0.9)",
    department: "Electrical, Automation & Navigation",
    phase: 6,
    source: "workbook_v0.9",
    idPrefix: stats.idPrefix,
    libraryVersion: stats.libraryVersion,
    jobCount: stats.jobCount,
    catalogTemplateCount: stats.catalogTemplateCount,
  });

  if (data.initializedOnly && stats.jobCount === 0) {
    tree.description =
      `${stats.libraryVersion} initialized — schema and tabs ready; curated jobs pending (Generators, switchboards, motors, automation, navigation, communication).`;
    tree.children = [
      {
        code: "electrical_v09",
        name: "Electrical, Automation & Navigation (v0.9)",
        nodeType: "category",
        department: "Electrical, Automation & Navigation",
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
