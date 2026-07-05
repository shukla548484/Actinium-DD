import {
  generatePhase7WorkbookJobLibraryTree,
  getPhase7WorkbookV10Stats,
  PHASE7_WORKBOOK_V10_PATH,
} from "@/lib/mtil/phases/phase7/workbookV10";
import { isWorkbookLibrarySeeded, seedWorkbookLibrary } from "./seedWorkbookLibrary";

const CONFIG = {
  workbookPath: PHASE7_WORKBOOK_V10_PATH,
  phasePrefix: "CGO-TNK",
  treeCode: "mtil_p7_cargo_tank_v10",
  generateTree: generatePhase7WorkbookJobLibraryTree,
  getStats: getPhase7WorkbookV10Stats,
  jobIdPattern: "JOB-CGO-TNK-",
  mtilPhase: 7,
  requireTemplate: false,
} as const;

export async function seedPhase7WorkbookV10() {
  return seedWorkbookLibrary(CONFIG);
}

export async function isPhase7WorkbookV10Seeded() {
  return isWorkbookLibrarySeeded(CONFIG);
}
