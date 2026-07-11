import { buildEmdrMasterRepositoryTree } from "@/lib/emdr/v3/buildJobLibraryTree";
import { loadEmdrMasterRepositoryParsed } from "@/lib/emdr/v3/loadEmdrMasterRepository";
import { isV323TypewiseFfsJobId } from "@/lib/emdr/v3/parseV323FireLsaSafetyRepository";
import { isV324TypewisePropJobId } from "@/lib/emdr/v3/parseV324PropulsionShaftingRepository";
import { isV325TypewiseHvacJobId } from "@/lib/emdr/v3/parseV325HvacVentilationRepository";
import { isV326TypewiseAutoJobId } from "@/lib/emdr/v3/parseV326AutomationIasRepository";
import { isV327TypewiseVpsoJobId } from "@/lib/emdr/v3/parseV327ValvesPipingRepository";
import { isV328TypewiseNavcomJobId } from "@/lib/emdr/v3/parseV328NavigationCommunicationRepository";
import { isV329TypewiseTgliJobId } from "@/lib/emdr/v3/parseV329TankGaugingRepository";
import { isV330TypewiseHypnJobId } from "@/lib/emdr/v3/parseV330HydraulicPneumaticRepository";
import { isV331TypewiseAglhJobId } from "@/lib/emdr/v3/parseV331AccommodationRepository";
import { isV332TypewiseWmtpJobId } from "@/lib/emdr/v3/parseV332WorkshopMachineryRepository";
import { isV333TypewiseDfmtJobId } from "@/lib/emdr/v3/parseV333DeckFittingsRepository";
import { isV334TypewiseHullJobId } from "@/lib/emdr/v3/parseV334HullStructureRepository";
import { isV335TypewiseChhcJobId } from "@/lib/emdr/v3/parseV335CargoHoldRepository";
import { isV336TypewiseDwssJobId } from "@/lib/emdr/v3/parseV336DomesticWaterRepository";
import { isV337TypewiseScacsJobId } from "@/lib/emdr/v3/parseV337SecurityCctvRepository";
import { isV339TypewiseSvssJobId } from "@/lib/emdr/v3/parseV339SpecialVesselRepository";
import { isV340TypewiseCsstJobId } from "@/lib/emdr/v3/parseV340ClassStatutoryRepository";
import { isV341TypewiseEdmcJobId } from "@/lib/emdr/v3/parseV341GapClosureRepository";
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
  electricalMotorSystemCount: 0,
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
  electricalMotorJobCount: 0,
  shipboardPumpJobCount: 0,
  typewiseHeatExchangerJobCount: 0,
  typewiseInertGasJobCount: 0,
  environmentalMachineryJobCount: 0,
  electricalPowerJobCount: 0,
  typewiseFireLsaSafetyJobCount: 0,
  propulsionShaftingJobCount: 0,
  hvacVentilationJobCount: 0,
  automationIasJobCount: 0,
  valvesPipingJobCount: 0,
  navigationCommunicationJobCount: 0,
  tankGaugingJobCount: 0,
  hydraulicPneumaticJobCount: 0,
  accommodationGalleyJobCount: 0,
  workshopMachineryJobCount: 0,
  deckFittingsJobCount: 0,
  hullStructureJobCount: 0,
  cargoHoldJobCount: 0,
  domesticWaterJobCount: 0,
  securityCctvJobCount: 0,
  specialVesselJobCount: 0,
  classStatutoryJobCount: 0,
  gapClosureEdmcJobCount: 0,
  shipboardPumpSystemCount: 0,
  typewiseHeatExchangerSystemCount: 0,
  typewiseInertGasSystemCount: 0,
  environmentalMachinerySystemCount: 0,
  electricalPowerSystemCount: 0,
  fireLsaSafetySystemCount: 0,
  propulsionShaftingSystemCount: 0,
  hvacVentilationSystemCount: 0,
  automationIasSystemCount: 0,
  valvesPipingSystemCount: 0,
  navigationCommunicationSystemCount: 0,
  tankGaugingSystemCount: 0,
  hydraulicPneumaticSystemCount: 0,
  accommodationGalleySystemCount: 0,
  workshopMachinerySystemCount: 0,
  deckFittingsSystemCount: 0,
  hullStructureSystemCount: 0,
  cargoHoldSystemCount: 0,
  domesticWaterSystemCount: 0,
  securityCctvSystemCount: 0,
  specialVesselSystemCount: 0,
  classStatutorySystemCount: 0,
  gapClosureEdmcSystemCount: 0,
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
  const electricalMotorJobs = countDeckFamilyJobs(jobs, /electrical motor/i);
  const shipboardPumpJobs = jobs.filter((j) => j.jobId.startsWith("JOBS-PUMP-")).length;
  const typewiseHeatExchangerJobs = jobs.filter((j) => j.jobId.startsWith("JOBS-HEX-")).length;
  const typewiseInertGasJobs = jobs.filter((j) => j.jobId.startsWith("JOBS-IGS-")).length;
  const environmentalMachineryJobs = jobs.filter((j) => j.jobId.startsWith("JOBS-ENV-")).length;
  const electricalPowerJobs = jobs.filter((j) => j.jobId.startsWith("JOBS-EPD-")).length;
  const typewiseFireLsaSafetyJobs = jobs.filter((j) => isV323TypewiseFfsJobId(j.jobId)).length;
  const propulsionShaftingJobs = jobs.filter((j) => isV324TypewisePropJobId(j.jobId)).length;
  const hvacVentilationJobs = jobs.filter((j) => isV325TypewiseHvacJobId(j.jobId)).length;
  const automationIasJobs = jobs.filter((j) => isV326TypewiseAutoJobId(j.jobId)).length;
  const valvesPipingJobs = jobs.filter((j) => isV327TypewiseVpsoJobId(j.jobId)).length;
  const navigationCommunicationJobs = jobs.filter((j) => isV328TypewiseNavcomJobId(j.jobId)).length;
  const tankGaugingJobs = jobs.filter((j) => isV329TypewiseTgliJobId(j.jobId)).length;
  const hydraulicPneumaticJobs = jobs.filter((j) => isV330TypewiseHypnJobId(j.jobId)).length;
  const accommodationGalleyJobs = jobs.filter((j) => isV331TypewiseAglhJobId(j.jobId)).length;
  const workshopMachineryJobs = jobs.filter((j) => isV332TypewiseWmtpJobId(j.jobId)).length;
  const deckFittingsJobs = jobs.filter((j) => isV333TypewiseDfmtJobId(j.jobId)).length;
  const hullStructureJobs = jobs.filter((j) => isV334TypewiseHullJobId(j.jobId)).length;
  const cargoHoldJobs = jobs.filter((j) => isV335TypewiseChhcJobId(j.jobId)).length;
  const domesticWaterJobs = jobs.filter((j) => isV336TypewiseDwssJobId(j.jobId)).length;
  const securityCctvJobs = jobs.filter((j) => isV337TypewiseScacsJobId(j.jobId)).length;
  const specialVesselJobs = jobs.filter((j) => isV339TypewiseSvssJobId(j.jobId)).length;
  const classStatutoryJobs = jobs.filter((j) => isV340TypewiseCsstJobId(j.jobId)).length;
  const gapClosureEdmcJobs = jobs.filter((j) => isV341TypewiseEdmcJobId(j.jobId)).length;
  const fwgJobs = countDeckFamilyJobs(jobs, /fresh water generator|\bfwg\b/i);
  const acJobs = jobs.filter(
    (j) => /air conditioning|\bhvac\b/i.test(j.machinery) && !isV325TypewiseHvacJobId(j.jobId),
  ).length;
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
    purifierSystemCount: idx.filter(
      (s) => s.machineryFamily === "Purifiers" || s.machineryFamily === "Purifiers / Centrifugal Separators",
    ).length,
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
    electricalMotorSystemCount: idx.filter(
      (s) => s.machineryFamily === "Electrical Motors / Motor Overhauling",
    ).length,
    shipboardPumpSystemCount: idx.filter((s) => s.machineryFamily === "Shipboard Pumps").length,
    typewiseHeatExchangerSystemCount: idx.filter(
      (s) => s.machineryFamily === "Heat Exchangers / Coolers / Heaters / Condensers",
    ).length,
    typewiseInertGasSystemCount: idx.filter(
      (s) => s.machineryFamily === "Inert Gas System / IGG / Nitrogen Generator",
    ).length,
    environmentalMachinerySystemCount: idx.filter(
      (s) => s.machineryFamily === "Environmental Machinery / OWS / STP / Incinerator / ODME / BWTS",
    ).length,
    electricalPowerSystemCount: idx.filter(
      (s) => s.machineryFamily === "Electrical Power Generation & Distribution",
    ).length,
    fireLsaSafetySystemCount: idx.filter(
      (s) => s.machineryFamily === "Fire Fighting & Life Saving Safety Systems",
    ).length,
    propulsionShaftingSystemCount: idx.filter(
      (s) => s.machineryFamily === "Propulsion Line / Shafting / Stern Tube / Propeller / Thrusters",
    ).length,
    hvacVentilationSystemCount: idx.filter(
      (s) => s.machineryFamily === "HVAC / Ventilation Systems",
    ).length,
    automationIasSystemCount: idx.filter(
      (s) => s.machineryFamily === "Automation / IAS / UMS / Alarm Monitoring & Control Systems",
    ).length,
    valvesPipingSystemCount: idx.filter(
      (s) => s.machineryFamily === "Valves / Piping / Sea Chest / Overboard Systems",
    ).length,
    navigationCommunicationSystemCount: idx.filter(
      (s) => s.machineryFamily === "Navigation & Communication Equipment",
    ).length,
    tankGaugingSystemCount: idx.filter(
      (s) => s.machineryFamily === "Tank Gauging / Level / Sounding / Instrumentation",
    ).length,
    hydraulicPneumaticSystemCount: idx.filter(
      (s) => s.machineryFamily === "Hydraulic & Pneumatic Power Systems",
    ).length,
    accommodationGalleySystemCount: idx.filter(
      (s) => s.machineryFamily === "Accommodation / Galley / Laundry / Hotel Equipment",
    ).length,
    workshopMachinerySystemCount: idx.filter(
      (s) => s.machineryFamily === "Workshop Machinery / Engine-Room Tools / Portable Equipment",
    ).length,
    deckFittingsSystemCount: idx.filter(
      (s) => s.machineryFamily === "Deck Fittings / Mooring-Towing / Access & Closing Appliances",
    ).length,
    hullStructureSystemCount: idx.filter(
      (s) => s.machineryFamily === "Hull Structure / Tanks / Coatings / Dry-Dock Hull Survey",
    ).length,
    cargoHoldSystemCount: idx.filter(
      (s) => s.machineryFamily === "Cargo Hold / Hatch Cover / Container / Bulk Equipment",
    ).length,
    domesticWaterSystemCount: idx.filter(
      (s) =>
        s.machineryFamily ===
        "Domestic Fresh Water / Potable Water / Sanitary / Drainage Service Systems",
    ).length,
    securityCctvSystemCount: idx.filter(
      (s) =>
        s.machineryFamily ===
        "Security / CCTV / Access Control / IT Network & Cyber Systems",
    ).length,
    specialVesselSystemCount: idx.filter(
      (s) =>
        s.machineryFamily ===
        "Special Vessel Systems — RORO / LNG / LPG / Container / AMP",
    ).length,
    classStatutorySystemCount: idx.filter(
      (s) =>
        s.machineryFamily ===
        "Class / Statutory / Certification / Survey Test Package",
    ).length,
    gapClosureEdmcSystemCount: idx.filter(
      (s) =>
        s.machineryFamily ===
        "Emergency / Damage Control / Misc Critical Systems — Final Gap Closure",
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
    electricalMotorJobCount: electricalMotorJobs,
    shipboardPumpJobCount: shipboardPumpJobs,
    typewiseHeatExchangerJobCount: typewiseHeatExchangerJobs,
    typewiseInertGasJobCount: typewiseInertGasJobs,
    environmentalMachineryJobCount: environmentalMachineryJobs,
    electricalPowerJobCount: electricalPowerJobs,
    typewiseFireLsaSafetyJobCount: typewiseFireLsaSafetyJobs,
    propulsionShaftingJobCount: propulsionShaftingJobs,
    hvacVentilationJobCount: hvacVentilationJobs,
    automationIasJobCount: automationIasJobs,
    valvesPipingJobCount: valvesPipingJobs,
    navigationCommunicationJobCount: navigationCommunicationJobs,
    tankGaugingJobCount: tankGaugingJobs,
    hydraulicPneumaticJobCount: hydraulicPneumaticJobs,
    accommodationGalleyJobCount: accommodationGalleyJobs,
    workshopMachineryJobCount: workshopMachineryJobs,
    deckFittingsJobCount: deckFittingsJobs,
    hullStructureJobCount: hullStructureJobs,
    cargoHoldJobCount: cargoHoldJobs,
    domesticWaterJobCount: domesticWaterJobs,
    securityCctvJobCount: securityCctvJobs,
    specialVesselJobCount: specialVesselJobs,
    classStatutoryJobCount: classStatutoryJobs,
    gapClosureEdmcJobCount: gapClosureEdmcJobs,
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
