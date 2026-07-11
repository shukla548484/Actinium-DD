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

export const EMDR_V311_DMK_MASTER_REPOSITORY_FILENAME =
  "Actinium_SM_EMDR_Master_Repository_V3_11_Deck_Machinery_Windlass_Mooring_Winches_Capstan.xlsx";

export const EMDR_V311_DMK_MASTER_REPOSITORY_PATH = path.join(
  EMDR_DATA_ROOT,
  EMDR_V311_DMK_MASTER_REPOSITORY_FILENAME,
);

export const EMDR_V315_PCS_MASTER_REPOSITORY_FILENAME =
  "Actinium_SM_EMDR_Master_Repository_V3_15_Purifiers_Centrifugal_Separators.xlsx";

export const EMDR_V315_PCS_MASTER_REPOSITORY_PATH = path.join(
  EMDR_DATA_ROOT,
  EMDR_V315_PCS_MASTER_REPOSITORY_FILENAME,
);

export const EMDR_V316_PUMP_MASTER_REPOSITORY_FILENAME =
  "Actinium_SM_EMDR_Master_Repository_V3_16_Shipboard_Pumps.xlsx";

export const EMDR_V316_PUMP_MASTER_REPOSITORY_PATH = path.join(
  EMDR_DATA_ROOT,
  EMDR_V316_PUMP_MASTER_REPOSITORY_FILENAME,
);

export const EMDR_V317_HEX_MASTER_REPOSITORY_FILENAME =
  "Actinium_SM_EMDR_Master_Repository_V3_17_Heat_Exchangers_Coolers_Heaters_Condensers.xlsx";

export const EMDR_V317_HEX_MASTER_REPOSITORY_PATH = path.join(
  EMDR_DATA_ROOT,
  EMDR_V317_HEX_MASTER_REPOSITORY_FILENAME,
);

export const EMDR_V320_IGS_MASTER_REPOSITORY_FILENAME =
  "Actinium_SM_EMDR_Master_Repository_V3_20_Inert_Gas_IGG_Nitrogen_System.xlsx";

export const EMDR_V320_IGS_MASTER_REPOSITORY_PATH = path.join(
  EMDR_DATA_ROOT,
  EMDR_V320_IGS_MASTER_REPOSITORY_FILENAME,
);

export const EMDR_V321_ENV_MASTER_REPOSITORY_FILENAME =
  "Actinium_SM_EMDR_Master_Repository_V3_21_Environmental_Machinery_OWS_STP_Incinerator_ODME_BWTS.xlsx";

export const EMDR_V321_ENV_MASTER_REPOSITORY_PATH = path.join(
  EMDR_DATA_ROOT,
  EMDR_V321_ENV_MASTER_REPOSITORY_FILENAME,
);

export const EMDR_V322_EPD_MASTER_REPOSITORY_FILENAME =
  "Actinium_SM_EMDR_Master_Repository_V3_22_Electrical_Power_Generation_Distribution.xlsx";

export const EMDR_V322_EPD_MASTER_REPOSITORY_PATH = path.join(
  EMDR_DATA_ROOT,
  EMDR_V322_EPD_MASTER_REPOSITORY_FILENAME,
);

export const EMDR_V323_FLS_MASTER_REPOSITORY_FILENAME =
  "Actinium_SM_EMDR_Master_Repository_V3_23_Fire_Fighting_Life_Saving_Safety_Systems.xlsx";

export const EMDR_V323_FLS_MASTER_REPOSITORY_PATH = path.join(
  EMDR_DATA_ROOT,
  EMDR_V323_FLS_MASTER_REPOSITORY_FILENAME,
);

export const EMDR_V324_PROP_MASTER_REPOSITORY_FILENAME =
  "Actinium_SM_EMDR_Master_Repository_V3_24_Propulsion_Shafting_Propeller_Thrusters.xlsx";

export const EMDR_V324_PROP_MASTER_REPOSITORY_PATH = path.join(
  EMDR_DATA_ROOT,
  EMDR_V324_PROP_MASTER_REPOSITORY_FILENAME,
);

export const EMDR_V325_HVAC_MASTER_REPOSITORY_FILENAME =
  "Actinium_SM_EMDR_Master_Repository_V3_25_HVAC_Ventilation_Air_Handling_Systems.xlsx";

export const EMDR_V325_HVAC_MASTER_REPOSITORY_PATH = path.join(
  EMDR_DATA_ROOT,
  EMDR_V325_HVAC_MASTER_REPOSITORY_FILENAME,
);

export const EMDR_V326_AUTO_MASTER_REPOSITORY_FILENAME =
  "Actinium_SM_EMDR_Master_Repository_V3_26_Automation_IAS_UMS_Alarm_Control_Systems.xlsx";

export const EMDR_V326_AUTO_MASTER_REPOSITORY_PATH = path.join(
  EMDR_DATA_ROOT,
  EMDR_V326_AUTO_MASTER_REPOSITORY_FILENAME,
);

export const EMDR_V327_VPSO_MASTER_REPOSITORY_FILENAME =
  "Actinium_SM_EMDR_Master_Repository_V3_27_Valves_Piping_SeaChest_Overboard_Systems.xlsx";

export const EMDR_V327_VPSO_MASTER_REPOSITORY_PATH = path.join(
  EMDR_DATA_ROOT,
  EMDR_V327_VPSO_MASTER_REPOSITORY_FILENAME,
);

export const EMDR_V328_NAVCOM_MASTER_REPOSITORY_FILENAME =
  "Actinium_SM_EMDR_Master_Repository_V3_28_Navigation_Communication_Equipment.xlsx";

export const EMDR_V328_NAVCOM_MASTER_REPOSITORY_PATH = path.join(
  EMDR_DATA_ROOT,
  EMDR_V328_NAVCOM_MASTER_REPOSITORY_FILENAME,
);

export const EMDR_V329_TGLI_MASTER_REPOSITORY_FILENAME =
  "Actinium_SM_EMDR_Master_Repository_V3_29_Tank_Gauging_Level_Sounding_Instrumentation.xlsx";

export const EMDR_V329_TGLI_MASTER_REPOSITORY_PATH = path.join(
  EMDR_DATA_ROOT,
  EMDR_V329_TGLI_MASTER_REPOSITORY_FILENAME,
);

export const EMDR_V330_HYPN_MASTER_REPOSITORY_FILENAME =
  "Actinium_SM_EMDR_Master_Repository_V3_30_Hydraulic_Pneumatic_Power_Systems.xlsx";

export const EMDR_V330_HYPN_MASTER_REPOSITORY_PATH = path.join(
  EMDR_DATA_ROOT,
  EMDR_V330_HYPN_MASTER_REPOSITORY_FILENAME,
);

export const EMDR_V331_AGLH_MASTER_REPOSITORY_FILENAME =
  "Actinium_SM_EMDR_Master_Repository_V3_31_Accommodation_Galley_Laundry_Hotel_Equipment.xlsx";

export const EMDR_V331_AGLH_MASTER_REPOSITORY_PATH = path.join(
  EMDR_DATA_ROOT,
  EMDR_V331_AGLH_MASTER_REPOSITORY_FILENAME,
);

export const EMDR_V332_WMTP_MASTER_REPOSITORY_FILENAME =
  "Actinium_SM_EMDR_Master_Repository_V3_32_Workshop_Machinery_Tools_Portable_Equipment.xlsx";

export const EMDR_V332_WMTP_MASTER_REPOSITORY_PATH = path.join(
  EMDR_DATA_ROOT,
  EMDR_V332_WMTP_MASTER_REPOSITORY_FILENAME,
);

export const EMDR_V333_DFMT_MASTER_REPOSITORY_FILENAME =
  "Actinium_SM_EMDR_Master_Repository_V3_33_Deck_Fittings_Mooring_Towing_Access_Closing_Appliances.xlsx";

export const EMDR_V333_DFMT_MASTER_REPOSITORY_PATH = path.join(
  EMDR_DATA_ROOT,
  EMDR_V333_DFMT_MASTER_REPOSITORY_FILENAME,
);

export const EMDR_V334_HULL_MASTER_REPOSITORY_FILENAME =
  "Actinium_SM_EMDR_Master_Repository_V3_34_Hull_Structure_Tanks_Coatings_DryDock_Survey.xlsx";

export const EMDR_V334_HULL_MASTER_REPOSITORY_PATH = path.join(
  EMDR_DATA_ROOT,
  EMDR_V334_HULL_MASTER_REPOSITORY_FILENAME,
);

export const EMDR_V335_CHHC_MASTER_REPOSITORY_FILENAME =
  "Actinium_SM_EMDR_Master_Repository_V3_35_Cargo_Hold_Hatch_Cover_Container_Bulk_Equipment.xlsx";

export const EMDR_V335_CHHC_MASTER_REPOSITORY_PATH = path.join(
  EMDR_DATA_ROOT,
  EMDR_V335_CHHC_MASTER_REPOSITORY_FILENAME,
);

export const EMDR_V336_DWSS_MASTER_REPOSITORY_FILENAME =
  "Actinium_SM_EMDR_Master_Repository_V3_36_Domestic_Water_Sanitary_Drainage_Service_Systems.xlsx";

export const EMDR_V336_DWSS_MASTER_REPOSITORY_PATH = path.join(
  EMDR_DATA_ROOT,
  EMDR_V336_DWSS_MASTER_REPOSITORY_FILENAME,
);

export const EMDR_V337_SCACS_MASTER_REPOSITORY_FILENAME =
  "Actinium_SM_EMDR_Master_Repository_V3_37_Security_CCTV_Access_Control_IT_Cyber_Systems.xlsx";

export const EMDR_V337_SCACS_MASTER_REPOSITORY_PATH = path.join(
  EMDR_DATA_ROOT,
  EMDR_V337_SCACS_MASTER_REPOSITORY_FILENAME,
);

export const EMDR_V339_SVSS_MASTER_REPOSITORY_FILENAME =
  "Actinium_SM_EMDR_Master_Repository_V3_39_Special_Vessel_Systems_RORO_LNG_LPG_Container_AMP.xlsx";

export const EMDR_V339_SVSS_MASTER_REPOSITORY_PATH = path.join(
  EMDR_DATA_ROOT,
  EMDR_V339_SVSS_MASTER_REPOSITORY_FILENAME,
);

export const EMDR_V340_CSST_MASTER_REPOSITORY_FILENAME =
  "Actinium_SM_EMDR_Master_Repository_V3_40_Class_Statutory_Certification_Survey_Test_Package.xlsx";

export const EMDR_V340_CSST_MASTER_REPOSITORY_PATH = path.join(
  EMDR_DATA_ROOT,
  EMDR_V340_CSST_MASTER_REPOSITORY_FILENAME,
);

export const EMDR_V341_EDMC_MASTER_REPOSITORY_FILENAME =
  "Actinium_SM_EMDR_Master_Repository_V3_41_Final_Gap_Closure_Emergency_Damage_Control_Misc_Critical_Systems.xlsx";

export const EMDR_V341_EDMC_MASTER_REPOSITORY_PATH = path.join(
  EMDR_DATA_ROOT,
  EMDR_V341_EDMC_MASTER_REPOSITORY_FILENAME,
);

export const EMDR_V314_EMO_MASTER_REPOSITORY_FILENAME =
  "Actinium_SM_EMDR_Master_Repository_V3_14_Electrical_Motors_Overhauling.xlsx";

export const EMDR_V314_EMO_MASTER_REPOSITORY_PATH = path.join(
  EMDR_DATA_ROOT,
  EMDR_V314_EMO_MASTER_REPOSITORY_FILENAME,
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

export function isEmdrV314EmoMasterRepositoryPresent(): boolean {
  return fs.existsSync(EMDR_V314_EMO_MASTER_REPOSITORY_PATH);
}

export function isEmdrV316PumpMasterRepositoryPresent(): boolean {
  return fs.existsSync(EMDR_V316_PUMP_MASTER_REPOSITORY_PATH);
}

export function isEmdrV317HexMasterRepositoryPresent(): boolean {
  return fs.existsSync(EMDR_V317_HEX_MASTER_REPOSITORY_PATH);
}

export function isEmdrV320IgsMasterRepositoryPresent(): boolean {
  return fs.existsSync(EMDR_V320_IGS_MASTER_REPOSITORY_PATH);
}

export function isEmdrV321EnvMasterRepositoryPresent(): boolean {
  return fs.existsSync(EMDR_V321_ENV_MASTER_REPOSITORY_PATH);
}

export function isEmdrV322EpdMasterRepositoryPresent(): boolean {
  return fs.existsSync(EMDR_V322_EPD_MASTER_REPOSITORY_PATH);
}

export function isEmdrV323FlsMasterRepositoryPresent(): boolean {
  return fs.existsSync(EMDR_V323_FLS_MASTER_REPOSITORY_PATH);
}

export function isEmdrV324PropMasterRepositoryPresent(): boolean {
  return fs.existsSync(EMDR_V324_PROP_MASTER_REPOSITORY_PATH);
}

export function isEmdrV325HvacMasterRepositoryPresent(): boolean {
  return fs.existsSync(EMDR_V325_HVAC_MASTER_REPOSITORY_PATH);
}

export function isEmdrV326AutoMasterRepositoryPresent(): boolean {
  return fs.existsSync(EMDR_V326_AUTO_MASTER_REPOSITORY_PATH);
}

export function isEmdrV327VpsoMasterRepositoryPresent(): boolean {
  return fs.existsSync(EMDR_V327_VPSO_MASTER_REPOSITORY_PATH);
}

export function isEmdrV328NavcomMasterRepositoryPresent(): boolean {
  return fs.existsSync(EMDR_V328_NAVCOM_MASTER_REPOSITORY_PATH);
}

export function isEmdrV329TgliMasterRepositoryPresent(): boolean {
  return fs.existsSync(EMDR_V329_TGLI_MASTER_REPOSITORY_PATH);
}

export function isEmdrV330HypnMasterRepositoryPresent(): boolean {
  return fs.existsSync(EMDR_V330_HYPN_MASTER_REPOSITORY_PATH);
}

export function isEmdrV331AglhMasterRepositoryPresent(): boolean {
  return fs.existsSync(EMDR_V331_AGLH_MASTER_REPOSITORY_PATH);
}

export function isEmdrV332WmtpMasterRepositoryPresent(): boolean {
  return fs.existsSync(EMDR_V332_WMTP_MASTER_REPOSITORY_PATH);
}

export function isEmdrV333DfmtMasterRepositoryPresent(): boolean {
  return fs.existsSync(EMDR_V333_DFMT_MASTER_REPOSITORY_PATH);
}

export function isEmdrV334HullMasterRepositoryPresent(): boolean {
  return fs.existsSync(EMDR_V334_HULL_MASTER_REPOSITORY_PATH);
}

export function isEmdrV335ChhcMasterRepositoryPresent(): boolean {
  return fs.existsSync(EMDR_V335_CHHC_MASTER_REPOSITORY_PATH);
}

export function isEmdrV336DwssMasterRepositoryPresent(): boolean {
  return fs.existsSync(EMDR_V336_DWSS_MASTER_REPOSITORY_PATH);
}

export function isEmdrV337ScacsMasterRepositoryPresent(): boolean {
  return fs.existsSync(EMDR_V337_SCACS_MASTER_REPOSITORY_PATH);
}

export function isEmdrV339SvssMasterRepositoryPresent(): boolean {
  return fs.existsSync(EMDR_V339_SVSS_MASTER_REPOSITORY_PATH);
}

export function isEmdrV340CsstMasterRepositoryPresent(): boolean {
  return fs.existsSync(EMDR_V340_CSST_MASTER_REPOSITORY_PATH);
}

export function isEmdrV341EdmcMasterRepositoryPresent(): boolean {
  return fs.existsSync(EMDR_V341_EDMC_MASTER_REPOSITORY_PATH);
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

/** V4.0 consolidated metadata overlay (provenance index — not a replacement base). */
export const EMDR_V40_METADATA_OVERLAY_FILENAME =
  "Actinium_SM_EMDR_Master_Repository_V4_0_Final_Consolidated_Master.xlsx";

export const EMDR_V40_METADATA_OVERLAY_PATH = path.join(
  process.env.HOME ?? "",
  "Downloads",
  EMDR_V40_METADATA_OVERLAY_FILENAME,
);

/** V4.1 validated upload / RFQ / budget-ready export output. */
export const EMDR_V41_EXPORT_FILENAME =
  "Actinium_SM_EMDR_Master_Repository_V4_1_Validated_Upload_RFQ_Budget_Ready.xlsx";

export const EMDR_V41_EXPORT_DIR = path.join(process.cwd(), "data", "emdr", "exports");

export const EMDR_V41_EXPORT_REPO_PATH = path.join(EMDR_V41_EXPORT_DIR, EMDR_V41_EXPORT_FILENAME);

export const EMDR_V41_EXPORT_DOWNLOADS_PATH = path.join(
  process.env.HOME ?? "",
  "Downloads",
  EMDR_V41_EXPORT_FILENAME,
);

export function resolveEmdrV40MetadataOverlayPath(): string {
  const alt = path.join(
    process.env.HOME ?? "",
    "Downloads",
    "Actinium_SM_EMDR_Master_Repository_V4_0_Final_Consolidated_Master(1).xlsx",
  );
  if (fs.existsSync(alt)) return alt;
  return EMDR_V40_METADATA_OVERLAY_PATH;
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
