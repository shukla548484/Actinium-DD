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
export const EMDR_V34_RELEASE = "V3.4-ME-AE-BLR-PMP-CMP";
export const EMDR_V36_RELEASE = "V3.6-ME-AE-BLR-PMP-CMP-PUR-HEX-COPT";
export const EMDR_V37_RELEASE = "V3.7-ME-AE-BLR-PMP-CMP-PUR-HEX-COPT-DECK";
export const EMDR_V38_RELEASE = "V3.8-ME-AE-BLR-PMP-CMP-PUR-HEX-COPT-DECK-FWG-AC-REF";
export const EMDR_V39_RELEASE =
  "V3.9-ME-AE-BLR-PMP-CMP-PUR-HEX-COPT-DECK-FWG-AC-REF-DMW";
export const EMDR_V310_RELEASE =
  "V3.10-ME-AE-BLR-PMP-CMP-PUR-HEX-COPT-DECK-FWG-AC-REF-DMW-LSA";
export const EMDR_V311_RELEASE =
  "V3.11-ME-AE-BLR-PMP-CMP-PUR-HEX-COPT-DECK-FWG-AC-REF-DMW-LSA-FFS";
export const EMDR_V312_RELEASE =
  "V3.12-ME-AE-BLR-PMP-CMP-PUR-HEX-COPT-DECK-FWG-AC-REF-DMW-LSA-FFS-IGG";

export const MTIL_V30_TREE_CODE = "mtil_v30_main_engine";
export const MTIL_V30_MTIL_PHASE = 300;

export const MTIL_V31_TREE_CODE = "mtil_v31_main_propulsion";
export const MTIL_V31_MTIL_PHASE = 301;

export const MTIL_V32_TREE_CODE = "mtil_v32_main_propulsion";
export const MTIL_V32_MTIL_PHASE = 302;

export const MTIL_V33_TREE_CODE = "mtil_v33_main_propulsion";
export const MTIL_V33_MTIL_PHASE = 303;

export const MTIL_V34_TREE_CODE = "mtil_v34_main_propulsion";
export const MTIL_V34_MTIL_PHASE = 304;

export const MTIL_V36_TREE_CODE = "mtil_v36_main_propulsion";
export const MTIL_V36_MTIL_PHASE = 306;

export const MTIL_V37_TREE_CODE = "mtil_v37_main_propulsion";
export const MTIL_V37_MTIL_PHASE = 307;

export const MTIL_V38_TREE_CODE = "mtil_v38_main_propulsion";
export const MTIL_V38_MTIL_PHASE = 308;

export const MTIL_V39_TREE_CODE = "mtil_v39_main_propulsion";
export const MTIL_V39_MTIL_PHASE = 309;

export const MTIL_V310_TREE_CODE = "mtil_v310_main_propulsion";
export const MTIL_V310_MTIL_PHASE = 310;

export const MTIL_V311_TREE_CODE = "mtil_v311_main_propulsion";
export const MTIL_V311_MTIL_PHASE = 311;

export const MTIL_V312_TREE_CODE = "mtil_v312_main_propulsion";
export const MTIL_V312_MTIL_PHASE = 312;

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

export type EmdrMasterRepositoryReleaseConfig = {
  kind: EmdrMasterRepositoryKind;
  release: string;
  treeCode: string;
  treeName: string;
  mtilPhase: number;
  includesAuxiliaryEngine: boolean;
  includesBoilers: boolean;
  includesPumps: boolean;
  includesCompressors: boolean;
  includesPurifiers: boolean;
  includesHeatExchangers: boolean;
  includesCopt: boolean;
  includesDeckMachinery: boolean;
  includesFwg: boolean;
  includesAirConditioning: boolean;
  includesRefrigeration: boolean;
  includesDeckMachineryWinch: boolean;
  includesLsaDavits: boolean;
  includesFireFighting: boolean;
  includesInertGas: boolean;
};

export function getEmdrMasterRepositoryReleaseConfig(
  kind: EmdrMasterRepositoryKind,
): EmdrMasterRepositoryReleaseConfig {
  if (kind === "v312") {
    return {
      kind: "v312",
      release: EMDR_V312_RELEASE,
      treeCode: MTIL_V312_TREE_CODE,
      treeName:
        "Main Propulsion, Auxiliary, Boilers, Pumps, Compressors, Purifiers, Heat Exchangers, COPT, Deck, FWG, AC, Refrigeration, Deck Machinery, LSA, Fire Fighting & Inert Gas (V3.12)",
      mtilPhase: MTIL_V312_MTIL_PHASE,
      includesAuxiliaryEngine: true,
      includesBoilers: true,
      includesPumps: true,
      includesCompressors: true,
      includesPurifiers: true,
      includesHeatExchangers: true,
      includesCopt: true,
      includesDeckMachinery: true,
      includesFwg: true,
      includesAirConditioning: true,
      includesRefrigeration: true,
      includesDeckMachineryWinch: true,
      includesLsaDavits: true,
      includesFireFighting: true,
      includesInertGas: true,
    };
  }
  if (kind === "v311") {
    return {
      kind: "v311",
      release: EMDR_V311_RELEASE,
      treeCode: MTIL_V311_TREE_CODE,
      treeName:
        "Main Propulsion, Auxiliary, Boilers, Pumps, Compressors, Purifiers, Heat Exchangers, COPT, Deck, FWG, AC, Refrigeration, Deck Machinery, LSA & Fire Fighting (V3.11)",
      mtilPhase: MTIL_V311_MTIL_PHASE,
      includesAuxiliaryEngine: true,
      includesBoilers: true,
      includesPumps: true,
      includesCompressors: true,
      includesPurifiers: true,
      includesHeatExchangers: true,
      includesCopt: true,
      includesDeckMachinery: true,
      includesFwg: true,
      includesAirConditioning: true,
      includesRefrigeration: true,
      includesDeckMachineryWinch: true,
      includesLsaDavits: true,
      includesFireFighting: true,
      includesInertGas: false,
    };
  }
  if (kind === "v310") {
    return {
      kind: "v310",
      release: EMDR_V310_RELEASE,
      treeCode: MTIL_V310_TREE_CODE,
      treeName:
        "Main Propulsion, Auxiliary, Boilers, Pumps, Compressors, Purifiers, Heat Exchangers, COPT, Deck, FWG, AC, Refrigeration, Deck Machinery & LSA Davits (V3.10)",
      mtilPhase: MTIL_V310_MTIL_PHASE,
      includesAuxiliaryEngine: true,
      includesBoilers: true,
      includesPumps: true,
      includesCompressors: true,
      includesPurifiers: true,
      includesHeatExchangers: true,
      includesCopt: true,
      includesDeckMachinery: true,
      includesFwg: true,
      includesAirConditioning: true,
      includesRefrigeration: true,
      includesDeckMachineryWinch: true,
      includesLsaDavits: true,
      includesFireFighting: false,
      includesInertGas: false,
    };
  }
  if (kind === "v39") {
    return {
      kind: "v39",
      release: EMDR_V39_RELEASE,
      treeCode: MTIL_V39_TREE_CODE,
      treeName:
        "Main Propulsion, Auxiliary, Boilers, Pumps, Compressors, Purifiers, Heat Exchangers, COPT, Deck, FWG, AC, Refrigeration & Deck Machinery (V3.9)",
      mtilPhase: MTIL_V39_MTIL_PHASE,
      includesAuxiliaryEngine: true,
      includesBoilers: true,
      includesPumps: true,
      includesCompressors: true,
      includesPurifiers: true,
      includesHeatExchangers: true,
      includesCopt: true,
      includesDeckMachinery: true,
      includesFwg: true,
      includesAirConditioning: true,
      includesRefrigeration: true,
      includesDeckMachineryWinch: true,
      includesLsaDavits: false,
      includesFireFighting: false,
      includesInertGas: false,
    };
  }
  if (kind === "v38") {
    return {
      kind: "v38",
      release: EMDR_V38_RELEASE,
      treeCode: MTIL_V38_TREE_CODE,
      treeName:
        "Main Propulsion, Auxiliary, Boilers, Pumps, Compressors, Purifiers, Heat Exchangers, COPT, Deck, FWG, AC & Refrigeration (V3.8)",
      mtilPhase: MTIL_V38_MTIL_PHASE,
      includesAuxiliaryEngine: true,
      includesBoilers: true,
      includesPumps: true,
      includesCompressors: true,
      includesPurifiers: true,
      includesHeatExchangers: true,
      includesCopt: true,
      includesDeckMachinery: true,
      includesFwg: true,
      includesAirConditioning: true,
      includesRefrigeration: true,
      includesDeckMachineryWinch: false,
      includesLsaDavits: false,
      includesFireFighting: false,
      includesInertGas: false,
    };
  }
  if (kind === "v37") {
    return {
      kind: "v37",
      release: EMDR_V37_RELEASE,
      treeCode: MTIL_V37_TREE_CODE,
      treeName:
        "Main Propulsion, Auxiliary, Boilers, Pumps, Compressors, Purifiers, Heat Exchangers, COPT, Deck & Steering (V3.7)",
      mtilPhase: MTIL_V37_MTIL_PHASE,
      includesAuxiliaryEngine: true,
      includesBoilers: true,
      includesPumps: true,
      includesCompressors: true,
      includesPurifiers: true,
      includesHeatExchangers: true,
      includesCopt: true,
      includesDeckMachinery: true,
      includesFwg: false,
      includesAirConditioning: false,
      includesRefrigeration: false,
      includesDeckMachineryWinch: false,
      includesLsaDavits: false,
      includesFireFighting: false,
      includesInertGas: false,
    };
  }
  if (kind === "v36") {
    return {
      kind: "v36",
      release: EMDR_V36_RELEASE,
      treeCode: MTIL_V36_TREE_CODE,
      treeName:
        "Main Propulsion, Auxiliary, Boilers, Pumps, Compressors, Purifiers, Heat Exchangers & COPT (V3.6)",
      mtilPhase: MTIL_V36_MTIL_PHASE,
      includesAuxiliaryEngine: true,
      includesBoilers: true,
      includesPumps: true,
      includesCompressors: true,
      includesPurifiers: true,
      includesHeatExchangers: true,
      includesCopt: true,
      includesDeckMachinery: false,
      includesFwg: false,
      includesAirConditioning: false,
      includesRefrigeration: false,
      includesDeckMachineryWinch: false,
      includesLsaDavits: false,
      includesFireFighting: false,
      includesInertGas: false,
    };
  }
  if (kind === "v34") {
    return {
      kind: "v34",
      release: EMDR_V34_RELEASE,
      treeCode: MTIL_V34_TREE_CODE,
      treeName: "Main Propulsion, Auxiliary, Boilers, Pumps & Compressors (V3.4)",
      mtilPhase: MTIL_V34_MTIL_PHASE,
      includesAuxiliaryEngine: true,
      includesBoilers: true,
      includesPumps: true,
      includesCompressors: true,
      includesPurifiers: false,
      includesHeatExchangers: false,
      includesCopt: false,
      includesDeckMachinery: false,
      includesFwg: false,
      includesAirConditioning: false,
      includesRefrigeration: false,
      includesDeckMachineryWinch: false,
      includesLsaDavits: false,
      includesFireFighting: false,
      includesInertGas: false,
    };
  }
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
      includesCompressors: false,
      includesPurifiers: false,
      includesHeatExchangers: false,
      includesCopt: false,
      includesDeckMachinery: false,
      includesFwg: false,
      includesAirConditioning: false,
      includesRefrigeration: false,
      includesDeckMachineryWinch: false,
      includesLsaDavits: false,
      includesFireFighting: false,
      includesInertGas: false,
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
      includesCompressors: false,
      includesPurifiers: false,
      includesHeatExchangers: false,
      includesCopt: false,
      includesDeckMachinery: false,
      includesFwg: false,
      includesAirConditioning: false,
      includesRefrigeration: false,
      includesDeckMachineryWinch: false,
      includesLsaDavits: false,
      includesFireFighting: false,
      includesInertGas: false,
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
      includesCompressors: false,
      includesPurifiers: false,
      includesHeatExchangers: false,
      includesCopt: false,
      includesDeckMachinery: false,
      includesFwg: false,
      includesAirConditioning: false,
      includesRefrigeration: false,
      includesDeckMachineryWinch: false,
      includesLsaDavits: false,
      includesFireFighting: false,
      includesInertGas: false,
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
    includesCompressors: false,
    includesPurifiers: false,
    includesHeatExchangers: false,
    includesCopt: false,
    includesDeckMachinery: false,
    includesFwg: false,
    includesAirConditioning: false,
    includesRefrigeration: false,
    includesDeckMachineryWinch: false,
    includesLsaDavits: false,
    includesFireFighting: false,
    includesInertGas: false,
  };
}
