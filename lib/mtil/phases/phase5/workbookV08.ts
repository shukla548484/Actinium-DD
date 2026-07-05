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

export const PHASE5_WORKBOOK_V08_FILENAME = "Actinium_SM_MTIL_Phase_5_Hull_Steel_Coatings_v0.8.xlsx";

export const PHASE5_WORKBOOK_V08_PATH = path.join(
  process.cwd(),
  "data/mtil",
  PHASE5_WORKBOOK_V08_FILENAME,
);

export const PHASE5_WORKBOOK_V08_VERSION = "MTIL-v0.8";

let cachedWorkbook: ParsedMtilWorkbook | null = null;

export function loadPhase5WorkbookV08(): ParsedMtilWorkbook {
  if (!cachedWorkbook) {
    cachedWorkbook = parseMtilWorkbookFile(PHASE5_WORKBOOK_V08_PATH);
  }
  return cachedWorkbook;
}

export function getPhase5WorkbookV08Stats(data: ParsedMtilWorkbook = loadPhase5WorkbookV08()) {
  return {
    ...getWorkbookStats(data, {
      phase: 5,
      source: "workbook_v0.8",
      idPrefix: "HUL-HUL",
      version: data.libraryVersion ?? PHASE5_WORKBOOK_V08_VERSION,
    }),
    initializedOnly: data.initializedOnly ?? false,
  };
}

export function generatePhase5WorkbookJobLibraryTree(data: ParsedMtilWorkbook = loadPhase5WorkbookV08()) {
  const stats = getPhase5WorkbookV08Stats(data);
  const tree = buildWorkbookJobLibraryTree({
    data,
    treeCode: "mtil_p5_hull_steel_v08",
    treeName: "Hull, Steel & Coatings — Engineering Repository v0.8",
    categoryCode: "hull_steel_v08",
    categoryName: "Hull, Steel & Coatings (v0.8)",
    department: "Hull, Steel & Coatings",
    phase: 5,
    source: "workbook_v0.8",
    idPrefix: stats.idPrefix,
    libraryVersion: stats.libraryVersion,
    jobCount: stats.jobCount,
    catalogTemplateCount: stats.catalogTemplateCount,
  });

  if (data.initializedOnly && stats.jobCount === 0) {
    tree.description =
      `${stats.libraryVersion} initialized — schema and tabs ready; curated jobs pending (Hull plating, steel renewal, tanks, coatings, rudder, sea chests).`;
    tree.children = [
      {
        code: "hull_steel_v08",
        name: "Hull, Steel & Coatings (v0.8)",
        nodeType: "category",
        department: "Hull, Steel & Coatings",
        description: "Phase initialized — detailed job library to be expanded in next release.",
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
