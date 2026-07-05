import {
  generatePhase8WorkbookJobLibraryTree,
  getPhase8WorkbookV11Stats,
  PHASE8_WORKBOOK_V11_PATH,
} from "@/lib/mtil/phases/phase8/workbookV11";
import { isWorkbookLibrarySeeded, seedWorkbookLibrary } from "./seedWorkbookLibrary";

const CONFIG = {
  workbookPath: PHASE8_WORKBOOK_V11_PATH,
  phasePrefix: "SAF-LSA",
  treeCode: "mtil_p8_safety_lsa_v11",
  generateTree: generatePhase8WorkbookJobLibraryTree,
  getStats: getPhase8WorkbookV11Stats,
  jobIdPattern: "JOB-SAF-LSA-",
  mtilPhase: 8,
  requireTemplate: false,
} as const;

export async function seedPhase8WorkbookV11() {
  return seedWorkbookLibrary(CONFIG);
}

export async function isPhase8WorkbookV11Seeded() {
  return isWorkbookLibrarySeeded(CONFIG);
}
