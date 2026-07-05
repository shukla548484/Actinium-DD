import {
  generatePhase1WorkbookJobLibraryTree,
  getPhase1WorkbookV04Stats,
  PHASE1_WORKBOOK_V04_PATH,
} from "@/lib/mtil/phases/phase1/workbookV04";
import { isWorkbookLibrarySeeded, seedWorkbookLibrary } from "./seedWorkbookLibrary";

const CONFIG = {
  workbookPath: PHASE1_WORKBOOK_V04_PATH,
  phasePrefix: "ENG-ME",
  treeCode: "mtil_p1_main_propulsion_v04",
  generateTree: generatePhase1WorkbookJobLibraryTree,
  getStats: getPhase1WorkbookV04Stats,
  jobIdPattern: "JOB-ENG-ME-",
  mtilPhase: 1,
  sampleTemplateId: "TMP-ENG-ME-0001",
} as const;

export async function seedPhase1WorkbookV04() {
  return seedWorkbookLibrary(CONFIG);
}

export async function isPhase1WorkbookV04Seeded() {
  return isWorkbookLibrarySeeded(CONFIG);
}
