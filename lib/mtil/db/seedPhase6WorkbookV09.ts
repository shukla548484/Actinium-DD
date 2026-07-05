import {
  generatePhase6WorkbookJobLibraryTree,
  getPhase6WorkbookV09Stats,
  PHASE6_WORKBOOK_V09_PATH,
} from "@/lib/mtil/phases/phase6/workbookV09";
import { isWorkbookLibrarySeeded, seedWorkbookLibrary } from "./seedWorkbookLibrary";

const CONFIG = {
  workbookPath: PHASE6_WORKBOOK_V09_PATH,
  phasePrefix: "ELC-ELC",
  treeCode: "mtil_p6_electrical_v09",
  generateTree: generatePhase6WorkbookJobLibraryTree,
  getStats: getPhase6WorkbookV09Stats,
  jobIdPattern: "JOB-ELC-ELC-",
  mtilPhase: 6,
  requireTemplate: false,
} as const;

export async function seedPhase6WorkbookV09() {
  return seedWorkbookLibrary(CONFIG);
}

export async function isPhase6WorkbookV09Seeded() {
  return isWorkbookLibrarySeeded(CONFIG);
}
