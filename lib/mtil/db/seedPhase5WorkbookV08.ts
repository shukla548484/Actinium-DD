import {
  generatePhase5WorkbookJobLibraryTree,
  getPhase5WorkbookV08Stats,
  PHASE5_WORKBOOK_V08_PATH,
} from "@/lib/mtil/phases/phase5/workbookV08";
import { isWorkbookLibrarySeeded, seedWorkbookLibrary } from "./seedWorkbookLibrary";

const CONFIG = {
  workbookPath: PHASE5_WORKBOOK_V08_PATH,
  phasePrefix: "HUL-HUL",
  treeCode: "mtil_p5_hull_steel_v08",
  generateTree: generatePhase5WorkbookJobLibraryTree,
  getStats: getPhase5WorkbookV08Stats,
  jobIdPattern: "JOB-HUL-HUL-",
  mtilPhase: 5,
  requireTemplate: false,
} as const;

export async function seedPhase5WorkbookV08() {
  return seedWorkbookLibrary(CONFIG);
}

export async function isPhase5WorkbookV08Seeded() {
  return isWorkbookLibrarySeeded(CONFIG);
}
