/** V3.x consolidated EMDR master repository sheet names. */
export const V3_MASTER_REPOSITORY_SHEETS = {
  dashboard: "00_Dashboard",
  repositoryIndex: "01_Repository_Index",
  equipment: "02_Equipment_Master",
  components: "03_Component_Master",
  jobs: "04_Job_Master",
  measurements: "05_Measurement_Master",
  inspections: "06_Inspection_Master",
  tools: "07_Tools_PPE",
  spares: "08_Spares_Consumables",
  rfq: "09_RFQ_Budget_Mapping",
  dryDock: "10_DryDock_Mapping",
  meSummary: "13_ME_Summary",
  aeSummary: "14_AE_Summary",
} as const;

export const EMDR_V30_RELEASE = "V3.0-ME-100";
export const EMDR_V31_RELEASE = "V3.1-ME-AE";
export const EMDR_V32_RELEASE = "V3.2-ME-AE-BLR";
export const EMDR_V33_RELEASE = "V3.3-ME-AE-BLR-PMP";

export const MTIL_V30_TREE_CODE = "mtil_v30_main_engine";
export const MTIL_V30_MTIL_PHASE = 300;

export const MTIL_V31_TREE_CODE = "mtil_v31_main_propulsion";
export const MTIL_V31_MTIL_PHASE = 301;

export const MTIL_V32_TREE_CODE = "mtil_v32_main_propulsion";
export const MTIL_V32_MTIL_PHASE = 302;

export const MTIL_V33_TREE_CODE = "mtil_v33_main_propulsion";
export const MTIL_V33_MTIL_PHASE = 303;

export type EmdrMasterRepositoryKind = "v33" | "v32" | "v31" | "v30";

export type EmdrMasterRepositoryReleaseConfig = {
  kind: EmdrMasterRepositoryKind;
  release: string;
  treeCode: string;
  treeName: string;
  mtilPhase: number;
  includesAuxiliaryEngine: boolean;
  includesBoilers: boolean;
  includesPumps: boolean;
};

export function getEmdrMasterRepositoryReleaseConfig(
  kind: EmdrMasterRepositoryKind,
): EmdrMasterRepositoryReleaseConfig {
  if (kind === "v33") {
    return {
      kind: "v33",
      release: EMDR_V33_RELEASE,
      treeCode: MTIL_V33_TREE_CODE,
      treeName: "Main Propulsion, Auxiliary, Boilers & Pumps (V3.3)",
      mtilPhase: MTIL_V33_MTIL_PHASE,
      includesAuxiliaryEngine: true,
      includesBoilers: true,
      includesPumps: true,
    };
  }
  if (kind === "v32") {
    return {
      kind: "v32",
      release: EMDR_V32_RELEASE,
      treeCode: MTIL_V32_TREE_CODE,
      treeName: "Main Propulsion, Auxiliary & Boilers (V3.2)",
      mtilPhase: MTIL_V32_MTIL_PHASE,
      includesAuxiliaryEngine: true,
      includesBoilers: true,
      includesPumps: false,
    };
  }
  if (kind === "v31") {
    return {
      kind: "v31",
      release: EMDR_V31_RELEASE,
      treeCode: MTIL_V31_TREE_CODE,
      treeName: "Main Propulsion & Auxiliary (V3.1 ME+AE)",
      mtilPhase: MTIL_V31_MTIL_PHASE,
      includesAuxiliaryEngine: true,
      includesBoilers: false,
      includesPumps: false,
    };
  }
  return {
    kind: "v30",
    release: EMDR_V30_RELEASE,
    treeCode: MTIL_V30_TREE_CODE,
    treeName: "Main Propulsion (V3.0 ME 100%)",
    mtilPhase: MTIL_V30_MTIL_PHASE,
    includesAuxiliaryEngine: false,
    includesBoilers: false,
    includesPumps: false,
  };
}
