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

/** V3.4 cumulative ME+AE+BLR+PMP+CMP master repository — supersedes V3.1–V3.3 when present. */
export const EMDR_V34_MASTER_REPOSITORY_FILENAME =
  "Actinium_SM_EMDR_Master_Repository_V3_4_Main_AE_Boilers_Pumps_Compressors.xlsx";

export const EMDR_V34_MASTER_REPOSITORY_PATH = path.join(
  EMDR_DATA_ROOT,
  EMDR_V34_MASTER_REPOSITORY_FILENAME,
);

/** V3.6 cumulative repo — adds Purifiers, Heat Exchangers & COPT turbines; supersedes V3.4 when present. */
export const EMDR_V36_MASTER_REPOSITORY_FILENAME =
  "Actinium_SM_EMDR_Master_Repository_V3_6_Heat_Exchangers_COPT_Turbines.xlsx";

export const EMDR_V36_MASTER_REPOSITORY_PATH = path.join(
  EMDR_DATA_ROOT,
  EMDR_V36_MASTER_REPOSITORY_FILENAME,
);

/** V3.7 cumulative repo — adds deck heating, masts, cranes, cargo pumps & steering gear; supersedes V3.6 when present. */
export const EMDR_V37_MASTER_REPOSITORY_FILENAME =
  "Actinium_SM_EMDR_Master_Repository_V3_7_Deck_Heaters_Cranes_CargoPumps_SteeringGear.xlsx";

export const EMDR_V37_MASTER_REPOSITORY_PATH = path.join(
  EMDR_DATA_ROOT,
  EMDR_V37_MASTER_REPOSITORY_FILENAME,
);

export const EMDR_V310_STG_MASTER_REPOSITORY_FILENAME =
  "Actinium_SM_EMDR_Master_Repository_V3_10_Steering_Gear_System_Rev2_Rudder_Anodes_ICCP_MGPS_Anchor_VRCS.xlsx";

export const EMDR_V310_STG_MASTER_REPOSITORY_PATH = path.join(
  EMDR_DATA_ROOT,
  EMDR_V310_STG_MASTER_REPOSITORY_FILENAME,
);

export const EMDR_V310_MASTER_REPOSITORY_FILENAME =
  "Actinium_SM_EMDR_Master_Repository_V3_10_LSA_Davits_Rescue_Boat.xlsx";

export const EMDR_V310_MASTER_REPOSITORY_PATH = path.join(
  EMDR_DATA_ROOT,
  EMDR_V310_MASTER_REPOSITORY_FILENAME,
);

export const EMDR_V311_MASTER_REPOSITORY_FILENAME =
  "Actinium_SM_EMDR_Master_Repository_V3_11_Fire_Fighting_Systems.xlsx";

export const EMDR_V311_MASTER_REPOSITORY_PATH = path.join(
  EMDR_DATA_ROOT,
  EMDR_V311_MASTER_REPOSITORY_FILENAME,
);

export const EMDR_V312_MASTER_REPOSITORY_FILENAME =
  "Actinium_SM_EMDR_Master_Repository_V3_12_Inert_Gas_IGG_Scrubber.xlsx";

export const EMDR_V312_MASTER_REPOSITORY_PATH = path.join(
  EMDR_DATA_ROOT,
  EMDR_V312_MASTER_REPOSITORY_FILENAME,
);

export const EMDR_V39_CAS_MASTER_REPOSITORY_FILENAME =
  "Actinium_SM_EMDR_Master_Repository_V3_9_Compressed_Air_Starting_Air_System.xlsx";

export const EMDR_V39_CAS_MASTER_REPOSITORY_PATH = path.join(
  EMDR_DATA_ROOT,
  EMDR_V39_CAS_MASTER_REPOSITORY_FILENAME,
);

export const EMDR_V39_MASTER_REPOSITORY_FILENAME =
  "Actinium_SM_EMDR_Master_Repository_V3_9_Deck_Machinery_Windlass_Winches_Capstans.xlsx";

export const EMDR_V39_MASTER_REPOSITORY_PATH = path.join(
  EMDR_DATA_ROOT,
  EMDR_V39_MASTER_REPOSITORY_FILENAME,
);

/** V3.8 cumulative repo — adds FWG, AC & refrigeration; supersedes V3.7 when present. */
export const EMDR_V38_MASTER_REPOSITORY_FILENAME =
  "Actinium_SM_EMDR_Master_Repository_V3_8_FWG_AC_Refrigeration.xlsx";

export const EMDR_V38_MASTER_REPOSITORY_PATH = path.join(
  EMDR_DATA_ROOT,
  EMDR_V38_MASTER_REPOSITORY_FILENAME,
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

export function isEmdrV34MasterRepositoryPresent(): boolean {
  return fs.existsSync(EMDR_V34_MASTER_REPOSITORY_PATH);
}

export function isEmdrV36MasterRepositoryPresent(): boolean {
  return fs.existsSync(EMDR_V36_MASTER_REPOSITORY_PATH);
}

export function isEmdrV37MasterRepositoryPresent(): boolean {
  return fs.existsSync(EMDR_V37_MASTER_REPOSITORY_PATH);
}

export function isEmdrV312MasterRepositoryPresent(): boolean {
  return fs.existsSync(EMDR_V312_MASTER_REPOSITORY_PATH);
}

export function isEmdrV311MasterRepositoryPresent(): boolean {
  return fs.existsSync(EMDR_V311_MASTER_REPOSITORY_PATH);
}

export function isEmdrV310MasterRepositoryPresent(): boolean {
  return fs.existsSync(EMDR_V310_MASTER_REPOSITORY_PATH);
}

export function isEmdrV39CasMasterRepositoryPresent(): boolean {
  return fs.existsSync(EMDR_V39_CAS_MASTER_REPOSITORY_PATH);
}

export function isEmdrV39MasterRepositoryPresent(): boolean {
  return fs.existsSync(EMDR_V39_MASTER_REPOSITORY_PATH);
}

export function isEmdrV38MasterRepositoryPresent(): boolean {
  return fs.existsSync(EMDR_V38_MASTER_REPOSITORY_PATH);
}

export function isEmdrMasterRepositoryPresent(): boolean {
  return (
    isEmdrV312MasterRepositoryPresent() ||
    isEmdrV311MasterRepositoryPresent() ||
    isEmdrV310MasterRepositoryPresent() ||
    isEmdrV39MasterRepositoryPresent() ||
    isEmdrV38MasterRepositoryPresent() ||
    isEmdrV37MasterRepositoryPresent() ||
    isEmdrV36MasterRepositoryPresent() ||
    isEmdrV34MasterRepositoryPresent() ||
    isEmdrV33MasterRepositoryPresent() ||
    isEmdrV32MasterRepositoryPresent() ||
    isEmdrV31MasterRepositoryPresent() ||
    isEmdrV30MasterRepositoryPresent()
  );
}

export type EmdrMasterRepositoryKind =
  | "v312"
  | "v311"
  | "v310"
  | "v39"
  | "v38"
  | "v37"
  | "v36"
  | "v34"
  | "v33"
  | "v32"
  | "v31"
  | "v30";

/** Highest installed V3.x master repository file on disk (may still fail parse if corrupt). */
export function resolveEmdrMasterRepositoryKind(): EmdrMasterRepositoryKind | null {
  if (isEmdrV312MasterRepositoryPresent()) return "v312";
  if (isEmdrV311MasterRepositoryPresent()) return "v311";
  if (isEmdrV310MasterRepositoryPresent()) return "v310";
  if (isEmdrV39MasterRepositoryPresent()) return "v39";
  if (isEmdrV38MasterRepositoryPresent()) return "v38";
  if (isEmdrV37MasterRepositoryPresent()) return "v37";
  if (isEmdrV36MasterRepositoryPresent()) return "v36";
  if (isEmdrV34MasterRepositoryPresent()) return "v34";
  if (isEmdrV33MasterRepositoryPresent()) return "v33";
  if (isEmdrV32MasterRepositoryPresent()) return "v32";
  if (isEmdrV31MasterRepositoryPresent()) return "v31";
  if (isEmdrV30MasterRepositoryPresent()) return "v30";
  return null;
}

/** Primary workbook path for display — prefer highest version present. */
export function resolveEmdrMasterRepositoryPath(): string | null {
  if (isEmdrV312MasterRepositoryPresent()) return EMDR_V312_MASTER_REPOSITORY_PATH;
  if (isEmdrV311MasterRepositoryPresent()) return EMDR_V311_MASTER_REPOSITORY_PATH;
  if (isEmdrV310MasterRepositoryPresent()) return EMDR_V310_MASTER_REPOSITORY_PATH;
  if (isEmdrV39MasterRepositoryPresent()) return EMDR_V39_MASTER_REPOSITORY_PATH;
  if (isEmdrV38MasterRepositoryPresent()) return EMDR_V38_MASTER_REPOSITORY_PATH;
  if (isEmdrV37MasterRepositoryPresent()) return EMDR_V37_MASTER_REPOSITORY_PATH;
  if (isEmdrV36MasterRepositoryPresent()) return EMDR_V36_MASTER_REPOSITORY_PATH;
  if (isEmdrV34MasterRepositoryPresent()) return EMDR_V34_MASTER_REPOSITORY_PATH;
  if (isEmdrV33MasterRepositoryPresent()) return EMDR_V33_MASTER_REPOSITORY_PATH;
  if (isEmdrV32MasterRepositoryPresent()) return EMDR_V32_MASTER_REPOSITORY_PATH;
  if (isEmdrV31MasterRepositoryPresent()) return EMDR_V31_MASTER_REPOSITORY_PATH;
  if (isEmdrV30MasterRepositoryPresent()) return EMDR_V30_MASTER_REPOSITORY_PATH;
  return null;
}
