import fs from "node:fs";
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

/** V3.0 consolidated Main Engine 100% master repository. */
export const EMDR_V30_MASTER_REPOSITORY_FILENAME =
  "Actinium_SM_EMDR_Master_Repository_V3_0_Main_Engine_100.xlsx";

export const EMDR_V30_MASTER_REPOSITORY_PATH = path.join(
  EMDR_DATA_ROOT,
  EMDR_V30_MASTER_REPOSITORY_FILENAME,
);

/** V3.1 Main Engine + Auxiliary Engine master repository (preferred when present). */
export const EMDR_V31_MASTER_REPOSITORY_FILENAME =
  "Actinium_SM_EMDR_Master_Repository_V3_1_Main_Engine_Auxiliary_Engine.xlsx";

export const EMDR_V31_MASTER_REPOSITORY_PATH = path.join(
  EMDR_DATA_ROOT,
  EMDR_V31_MASTER_REPOSITORY_FILENAME,
);

/** V3.2 boilers supplement — merges additively with V3.1 (no duplicate ME/AE jobs). */
export const EMDR_V32_MASTER_REPOSITORY_FILENAME =
  "Actinium_SM_EMDR_Master_Repository_V3_2_Main_AE_Boilers.xlsx";

export const EMDR_V32_MASTER_REPOSITORY_PATH = path.join(
  EMDR_DATA_ROOT,
  EMDR_V32_MASTER_REPOSITORY_FILENAME,
);

/** V3.3 boilers + pumps supplement — merges additively with V3.1 (supersedes V3.2 boilers). */
export const EMDR_V33_MASTER_REPOSITORY_FILENAME =
  "Actinium_SM_EMDR_Master_Repository_V3_3_Main_AE_Boilers_Pumps.xlsx";

export const EMDR_V33_MASTER_REPOSITORY_PATH = path.join(
  EMDR_DATA_ROOT,
  EMDR_V33_MASTER_REPOSITORY_FILENAME,
);

export function isEmdrV30MasterRepositoryPresent(): boolean {
  return fs.existsSync(EMDR_V30_MASTER_REPOSITORY_PATH);
}

export function isEmdrV31MasterRepositoryPresent(): boolean {
  return fs.existsSync(EMDR_V31_MASTER_REPOSITORY_PATH);
}

export function isEmdrV32MasterRepositoryPresent(): boolean {
  return fs.existsSync(EMDR_V32_MASTER_REPOSITORY_PATH);
}

export function isEmdrV33MasterRepositoryPresent(): boolean {
  return fs.existsSync(EMDR_V33_MASTER_REPOSITORY_PATH);
}

export function isEmdrMasterRepositoryPresent(): boolean {
  return (
    isEmdrV33MasterRepositoryPresent() ||
    isEmdrV32MasterRepositoryPresent() ||
    isEmdrV31MasterRepositoryPresent() ||
    isEmdrV30MasterRepositoryPresent()
  );
}

export type EmdrMasterRepositoryKind = "v33" | "v32" | "v31" | "v30";

/** Highest installed V3.x master repository version. */
export function resolveEmdrMasterRepositoryKind(): EmdrMasterRepositoryKind | null {
  if (isEmdrV33MasterRepositoryPresent()) return "v33";
  if (isEmdrV32MasterRepositoryPresent()) return "v32";
  if (isEmdrV31MasterRepositoryPresent()) return "v31";
  if (isEmdrV30MasterRepositoryPresent()) return "v30";
  return null;
}

/** Primary workbook path for display — prefer highest version present. */
export function resolveEmdrMasterRepositoryPath(): string | null {
  if (isEmdrV33MasterRepositoryPresent()) return EMDR_V33_MASTER_REPOSITORY_PATH;
  if (isEmdrV32MasterRepositoryPresent()) return EMDR_V32_MASTER_REPOSITORY_PATH;
  if (isEmdrV31MasterRepositoryPresent()) return EMDR_V31_MASTER_REPOSITORY_PATH;
  if (isEmdrV30MasterRepositoryPresent()) return EMDR_V30_MASTER_REPOSITORY_PATH;
  return null;
}
