import {
  generatePhase3WorkbookJobLibraryTree,
  getPhase3WorkbookV06Stats,
  PHASE3_WORKBOOK_V06_PATH,
} from "@/lib/mtil/phases/phase3/workbookV06";
import { isWorkbookLibrarySeeded, seedWorkbookLibrary } from "./seedWorkbookLibrary";

const CONFIG = {
  workbookPath: PHASE3_WORKBOOK_V06_PATH,
  phasePrefix: "ENG-PVP",
  treeCode: "mtil_p3_pvp_v06",
  generateTree: generatePhase3WorkbookJobLibraryTree,
  getStats: getPhase3WorkbookV06Stats,
  jobIdPattern: "JOB-ENG-PVP-",
  mtilPhase: 3,
  sampleTemplateId: "TMP-PVP-PMP-0001",
} as const;

export async function seedPhase3WorkbookV06() {
  return seedWorkbookLibrary(CONFIG);
}

export async function isPhase3WorkbookV06Seeded() {
  return isWorkbookLibrarySeeded(CONFIG);
}
