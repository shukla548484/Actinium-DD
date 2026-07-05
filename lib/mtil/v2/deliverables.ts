/** Standard deliverables bundled with every V2.0 domain release. */
export const MTIL_V2_RELEASE_DELIVERABLES = [
  "Engineering Library Excel",
  "Dynamic Template Excel",
  "Measurement Library Excel",
  "Inspection Library Excel",
  "Spare & Material Library Excel",
  "RFQ & Budget Mapping Excel",
  "Progress Dashboard Excel",
  "Repository ZIP",
  "TXT Documentation",
] as const;

export type MtilV2Deliverable = (typeof MTIL_V2_RELEASE_DELIVERABLES)[number];

/** Expected Excel workbook tabs for V2.0 domain imports (extends R0.x schema). */
export const MTIL_V2_WORKBOOK_SHEETS = [
  "00_Release_Dashboard",
  "01_Master_Job_Library",
  "02_Dynamic_Templates",
  "03_Measurements",
  "04_Inspection_Checklist",
  "05_Scope_of_Work",
  "06_Attachments",
  "07_Spares_Materials",
  "08_RFQ_Budget_Mapping",
  "09_Workflows",
  "10_Tools_PPE",
  "11_Acceptance_Criteria",
  "12_SQL_Prisma_API_Map",
] as const;
