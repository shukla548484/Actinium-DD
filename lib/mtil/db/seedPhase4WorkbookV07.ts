import {
  generatePhase4WorkbookJobLibraryTree,
  getPhase4WorkbookV07Stats,
  PHASE4_WORKBOOK_V07_PATH,
} from "@/lib/mtil/phases/phase4/workbookV07";
import { isWorkbookLibrarySeeded, seedWorkbookLibrary } from "./seedWorkbookLibrary";

const CONFIG = {
  workbookPath: PHASE4_WORKBOOK_V07_PATH,
  phasePrefix: "DECK-DCG",
  treeCode: "mtil_p4_deck_cargo_v07",
  generateTree: generatePhase4WorkbookJobLibraryTree,
  getStats: getPhase4WorkbookV07Stats,
  jobIdPattern: "JOB-DECK-DCG-",
  mtilPhase: 4,
  sampleTemplateId: "TMP-DECK-WIN-0001",
} as const;

export async function seedPhase4WorkbookV07() {
  return seedWorkbookLibrary(CONFIG);
}

export async function isPhase4WorkbookV07Seeded() {
  return isWorkbookLibrarySeeded(CONFIG);
}
