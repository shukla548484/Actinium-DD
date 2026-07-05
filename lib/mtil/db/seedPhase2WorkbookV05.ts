import {
  generatePhase2WorkbookJobLibraryTree,
  getPhase2WorkbookV05Stats,
  PHASE2_WORKBOOK_V05_PATH,
} from "@/lib/mtil/phases/phase2/workbookV05";
import { isWorkbookLibrarySeeded, seedWorkbookLibrary } from "./seedWorkbookLibrary";

const CONFIG = {
  workbookPath: PHASE2_WORKBOOK_V05_PATH,
  phasePrefix: "ENG-AUX",
  treeCode: "mtil_p2_auxiliary_v05",
  generateTree: generatePhase2WorkbookJobLibraryTree,
  getStats: getPhase2WorkbookV05Stats,
  jobIdPattern: "JOB-ENG-AUX-",
  mtilPhase: 2,
  sampleTemplateId: "TMP-ENG-AUX-0001",
} as const;

export async function seedPhase2WorkbookV05() {
  return seedWorkbookLibrary(CONFIG);
}

export async function isPhase2WorkbookV05Seeded() {
  return isWorkbookLibrarySeeded(CONFIG);
}
