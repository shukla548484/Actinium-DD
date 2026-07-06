import * as XLSX from "xlsx";

/** Resolve first matching sheet name (V3.0–V3.2 use slightly different tab labels). */
export function resolveWorkbookSheet(workbook: XLSX.WorkBook, candidates: string[]): string | null {
  for (const name of candidates) {
    if (workbook.Sheets[name]) return name;
  }
  return null;
}

export function sheetRowsFromCandidates(
  workbook: XLSX.WorkBook,
  candidates: string[],
): Array<Record<string, unknown>> {
  const sheetName = resolveWorkbookSheet(workbook, candidates);
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
}

export const V3_SHEET_CANDIDATES = {
  jobs: ["04_Job_Master"],
  equipment: ["02_Equipment_Master"],
  components: ["03_Component_Master"],
  measurements: ["05_Measurement_Master"],
  inspections: ["06_Inspection_Master"],
  tools: ["07_Tools_PPE", "07_Tools_PPE_Map"],
  spares: ["08_Spares_Consumables", "08_Spare_Consumable_Map"],
  rfq: ["09_RFQ_Budget_Mapping", "09_RFQ_Budget_Map"],
  repositoryIndex: ["01_Repository_Index"],
  meSummary: ["13_ME_Summary"],
  aeSummary: ["14_AE_Summary"],
} as const;
