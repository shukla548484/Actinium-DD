import { buildEmdrMasterRepositoryTree } from "@/lib/emdr/v3/buildJobLibraryTree";
import { loadEmdrMasterRepositoryParsed } from "@/lib/emdr/v3/loadEmdrMasterRepository";
import {
  getEmdrMasterRepositoryReleaseConfig,
  type EmdrMasterRepositoryReleaseConfig,
} from "@/lib/emdr/v3/sheets";
import {
  isEmdrMasterRepositoryPresent,
  resolveEmdrMasterRepositoryKind,
} from "@/lib/emdr/paths";
import { resolveLoadedEmdrMasterRepositoryKind } from "@/lib/emdr/v3/loadEmdrMasterRepository";
import type { JobLibrarySeedNode } from "@/lib/vessel/jobLibrary/catalog";

function releaseConfig(): EmdrMasterRepositoryReleaseConfig | null {
  const kind = resolveLoadedEmdrMasterRepositoryKind() ?? resolveEmdrMasterRepositoryKind();
  return kind ? getEmdrMasterRepositoryReleaseConfig(kind) : null;
}

export function generateEmdrMasterRepositoryTree(): JobLibrarySeedNode | null {
  const config = releaseConfig();
  const parsed = loadEmdrMasterRepositoryParsed();
  if (!config || !parsed || parsed.masterJobs.length === 0) return null;
  return buildEmdrMasterRepositoryTree(parsed, config);
}

/** @deprecated Use generateEmdrMasterRepositoryTree. */
export function generateV30JobLibraryTree(): JobLibrarySeedNode | null {
  return generateEmdrMasterRepositoryTree();
}

function countDeckFamilyJobs(
  jobs: { machinery: string }[],
  pattern: RegExp,
): number {
  return jobs.filter((j) => pattern.test(j.machinery)).length;
}

const EMPTY_STATS = {
  systemCount: 0,
  mainEngineSystemCount: 0,
  auxiliaryEngineSystemCount: 0,
  boilerSystemCount: 0,
  pumpSystemCount: 0,
  compressorSystemCount: 0,
  purifierSystemCount: 0,
  heatExchangerSystemCount: 0,
  coptSystemCount: 0,
  deckHeatingSystemCount: 0,
  deckMastSystemCount: 0,
  liftingApplianceSystemCount: 0,
  cargoPumpingSystemCount: 0,
  steeringGearSystemCount: 0,
  deckMachineryWinchSystemCount: 0,
  lsaDavitsSystemCount: 0,
  fireFightingSystemCount: 0,
  inertGasSystemCount: 0,
  compressedAirSystemCount: 0,
  fwgSystemCount: 0,
  airConditioningSystemCount: 0,
  refrigerationSystemCount: 0,
  jobCount: 0,
  mainEngineJobCount: 0,
  auxiliaryEngineJobCount: 0,
  boilerJobCount: 0,
  pumpJobCount: 0,
  compressorJobCount: 0,
  purifierJobCount: 0,
  heatExchangerJobCount: 0,
  coptJobCount: 0,
  deckHeatingJobCount: 0,
  deckMastJobCount: 0,
  liftingApplianceJobCount: 0,
  cargoPumpingJobCount: 0,
  steeringGearJobCount: 0,
  deckMachineryWinchJobCount: 0,
  lsaDavitsJobCount: 0,
  fireFightingJobCount: 0,
  inertGasJobCount: 0,
  compressedAirJobCount: 0,
  fwgJobCount: 0,
  airConditioningJobCount: 0,
  refrigerationJobCount: 0,
  catalogTemplateCount: 0,
  measurementCount: 0,
  checklistItemCount: 0,
  workbookPresent: false,
  mergedBundle: false,
};

export function getEmdrMasterRepositoryWorkbookStats() {
  const config = releaseConfig();
  if (!config || !isEmdrMasterRepositoryPresent()) {
    return {
      kind: null as "v312" | "v311" | "v310" | "v39" | "v38" | "v37" | "v36" | "v34" | "v33" | "v32" | "v31" | "v30" | null,
      release: null as string | null,
      ...EMPTY_STATS,
    };
  }

  const parsed = loadEmdrMasterRepositoryParsed();
  if (!parsed) {
    return {
      kind: config.kind,
      release: config.release,
      ...EMPTY_STATS,
    };
  }

  const idx = parsed.repositoryIndex;
  const jobs = parsed.masterJobs;
  const meJobs = jobs.filter((j) => j.jobId.startsWith("JOBS-ME-")).length;
  const aeJobs = jobs.filter((j) => j.jobId.startsWith("JOBS-AE-")).length;
  const blrJobs = jobs.filter((j) => j.jobId.startsWith("JOBS-BLR-")).length;
  const pmpJobs = jobs.filter((j) => j.jobId.startsWith("JOBS-PMP-")).length;
  const cmpJobs = jobs.filter((j) => j.jobId.startsWith("JOBS-CMP-")).length;
  const purJobs = jobs.filter(
    (j) => j.jobId.startsWith("JOBS-PUR-") || /purifier/i.test(j.machinery),
  ).length;
  const hexJobs = countDeckFamilyJobs(jobs, /heat exchangers, heaters & condensers/i);
  const coptJobs = countDeckFamilyJobs(jobs, /cargo oil pump turbine/i);
  const dhkJobs = countDeckFamilyJobs(jobs, /deck heating|cargo tank heating|steam coils/i);
  const dmwJobs = countDeckFamilyJobs(jobs, /deck masts|rigging/i);
  const dlaJobs = countDeckFamilyJobs(jobs, /lifting appliances/i);
  const cgpJobs = countDeckFamilyJobs(jobs, /cargo pumping system/i);
  const stgJobs = countDeckFamilyJobs(jobs, /steering gear/i);
  const dmwWinchJobs = countDeckFamilyJobs(jobs, /windlass|winch|capstan|deck machinery/i);
  const lsaDavitsJobs = countDeckFamilyJobs(jobs, /life saving|davit|rescue boat/i);
  const fireFightingJobs = countDeckFamilyJobs(jobs, /fire fighting/i);
  const inertGasJobs = countDeckFamilyJobs(jobs, /inert gas|\bigg\b|scrubber/i);
  const compressedAirJobs = countDeckFamilyJobs(jobs, /compressed air|starting air/i);
  const fwgJobs = countDeckFamilyJobs(jobs, /fresh water generator|\bfwg\b/i);
  const acJobs = countDeckFamilyJobs(jobs, /air conditioning|\bhvac\b/i);
  const refJobs = countDeckFamilyJobs(jobs, /refrigeration/i);

  return {
    kind: config.kind,
    release: parsed.release || config.release,
    systemCount: idx.length,
    mainEngineSystemCount: idx.filter((s) => s.machineryFamily === "Main Engine").length,
    auxiliaryEngineSystemCount: idx.filter((s) => s.machineryFamily === "Auxiliary Engine").length,
    boilerSystemCount: idx.filter((s) => s.machineryFamily === "Boilers").length,
    pumpSystemCount: idx.filter((s) => s.machineryFamily === "Pumps").length,
    compressorSystemCount: idx.filter((s) => s.machineryFamily === "Compressors").length,
    purifierSystemCount: idx.filter((s) => s.machineryFamily === "Purifiers").length,
    heatExchangerSystemCount: idx.filter(
      (s) => s.machineryFamily === "Heat Exchangers, Heaters & Condensers",
    ).length,
    coptSystemCount: idx.filter((s) => s.machineryFamily === "Cargo Oil Pump Turbine System").length,
    deckHeatingSystemCount: idx.filter(
      (s) => s.machineryFamily === "Deck Heating, Cargo Tank Heating & Steam Coils",
    ).length,
    deckMastSystemCount: idx.filter(
      (s) => s.machineryFamily === "Deck Masts, Wires & Standing Rigging",
    ).length,
    liftingApplianceSystemCount: idx.filter(
      (s) => s.machineryFamily === "Deck & Engine Room Lifting Appliances",
    ).length,
    cargoPumpingSystemCount: idx.filter((s) => s.machineryFamily === "Cargo Pumping System").length,
    steeringGearSystemCount: idx.filter((s) => s.machineryFamily === "Steering Gear System").length,
    deckMachineryWinchSystemCount: idx.filter(
      (s) => s.machineryFamily === "Deck Machinery – Windlass / Winches / Capstans",
    ).length,
    lsaDavitsSystemCount: idx.filter(
      (s) => s.machineryFamily === "Life Saving Appliances / Davits / Rescue Boat Davit",
    ).length,
    fireFightingSystemCount: idx.filter((s) => s.machineryFamily === "Fire Fighting Systems").length,
    inertGasSystemCount: idx.filter(
      (s) => s.machineryFamily === "Inert Gas / IGG / Scrubber System",
    ).length,
    compressedAirSystemCount: idx.filter(
      (s) => s.machineryFamily === "Compressed Air & Starting Air System",
    ).length,
    fwgSystemCount: idx.filter((s) => s.machineryFamily === "Fresh Water Generator").length,
    airConditioningSystemCount: idx.filter(
      (s) => s.machineryFamily === "Air Conditioning & Ventilation",
    ).length,
    refrigerationSystemCount: idx.filter((s) => s.machineryFamily === "Refrigeration Plant").length,
    jobCount: jobs.length,
    mainEngineJobCount: meJobs,
    auxiliaryEngineJobCount: aeJobs,
    boilerJobCount: blrJobs,
    pumpJobCount: pmpJobs,
    compressorJobCount: cmpJobs,
    purifierJobCount: purJobs,
    heatExchangerJobCount: hexJobs,
    coptJobCount: coptJobs,
    deckHeatingJobCount: dhkJobs,
    deckMastJobCount: dmwJobs,
    liftingApplianceJobCount: dlaJobs,
    cargoPumpingJobCount: cgpJobs,
    steeringGearJobCount: stgJobs,
    deckMachineryWinchJobCount: dmwWinchJobs,
    lsaDavitsJobCount: lsaDavitsJobs,
    fireFightingJobCount: fireFightingJobs,
    inertGasJobCount: inertGasJobs,
    compressedAirJobCount: compressedAirJobs,
    fwgJobCount: fwgJobs,
    airConditioningJobCount: acJobs,
    refrigerationJobCount: refJobs,
    catalogTemplateCount: parsed.templates.length,
    measurementCount: parsed.measurements.length,
    checklistItemCount: parsed.checklistItems.length,
    workbookPresent: true,
    mergedBundle:
      config.kind !== "v312" &&
      config.kind !== "v311" &&
      config.kind !== "v310" &&
      config.kind !== "v39" &&
      config.kind !== "v38" &&
      config.kind !== "v37" &&
      config.kind !== "v36" &&
      config.kind !== "v34" &&
      meJobs > 0 &&
      aeJobs > 0 &&
      (blrJobs > 0 || pmpJobs > 0),
  };
}

/** @deprecated Use getEmdrMasterRepositoryWorkbookStats. */
export function getV30CombinedWorkbookStats() {
  const stats = getEmdrMasterRepositoryWorkbookStats();
  return {
    release: stats.release ?? "V3.0-ME-100",
    systemCount: stats.systemCount,
    jobCount: stats.jobCount,
    catalogTemplateCount: stats.catalogTemplateCount,
    measurementCount: stats.measurementCount,
    checklistItemCount: stats.checklistItemCount,
    workbookPresent: stats.workbookPresent,
  };
}
