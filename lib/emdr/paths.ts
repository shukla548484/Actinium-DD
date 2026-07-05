import path from "node:path";

export const EMDR_VERSION = "V2.0";

export const EMDR_DATA_ROOT = path.join(process.cwd(), "data", "emdr", "v2");

export const EMDR_MASTER_CODEBOOK_PATH = path.join(
  EMDR_DATA_ROOT,
  "Actinium_SM_EMDR_Master_Codebook_V2_0.xlsx",
);

export const EMDR_REPOSITORY_INDEX_PATH = path.join(
  EMDR_DATA_ROOT,
  "Actinium_SM_EMDR_Repository_Index_V2_0.xlsx",
);

export const EMDR_CODE_STANDARD_PATH = path.join(
  EMDR_DATA_ROOT,
  "Engineering_Code_Standard.txt",
);

export const EMDR_V201_WORKBOOKS_DIR = path.join(
  EMDR_DATA_ROOT,
  "workbooks",
  "Version_2_0_1_Main_Engine",
);

/** Legacy sprint workbook location (kept for backward compatibility). */
export const MTIL_V2_WORKBOOKS_DIR = path.join(process.cwd(), "data", "mtil", "v2");

export function emdrWorkbookPath(filename: string): string {
  return path.join(EMDR_V201_WORKBOOKS_DIR, filename);
}
