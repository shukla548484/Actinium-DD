import type { DdJobPriority } from "@prisma/client";
import type { ParsedMasterJobRow, ParsedMtilWorkbook } from "@/lib/mtil/import/parseWorkbook";
import type { JobLibrarySeedNode } from "@/lib/vessel/jobLibrary/catalog";
import type { EmdrMasterRepositoryReleaseConfig } from "@/lib/emdr/v3/sheets";
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
import { templateIdToKey } from "@/lib/mtil/phases/shared/workbookUtils";

function slug(value: string, max = 48): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, max);
}

function uniqueSlug(value: string, used: Set<string>, max = 48): string {
  const base = slug(value, max);
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  for (let n = 2; n < 1000; n++) {
    const suffix = `_${n}`;
    const candidate = `${base.slice(0, Math.max(1, max - suffix.length))}${suffix}`;
    if (!used.has(candidate)) {
      used.add(candidate);
      return candidate;
    }
  }
  const fallback = `${base.slice(0, max - 4)}_x${used.size}`;
  used.add(fallback);
  return fallback;
}

function riskToPriority(risk: ParsedMasterJobRow["riskLevel"]): DdJobPriority {
  if (risk === "critical") return "critical";
  if (risk === "high") return "high";
  if (risk === "low") return "low";
  return "medium";
}

function workshopLabel(workshop: ParsedMasterJobRow["workshop"]): string {
  if (workshop === "machinery") return "Machinery";
  if (workshop === "deck") return "Deck";
  if (workshop === "pipe") return "Pipe";
  if (workshop === "hull") return "Hull";
  if (workshop === "steel") return "Steel";
  if (workshop === "paint") return "Paint";
  if (workshop === "electrical") return "Electrical";
  return workshop;
}

function departmentForMachinery(machinery: string): string {
  if (/^main engine$/i.test(machinery.trim())) return "Main Propulsion";
  if (/steering gear/i.test(machinery)) return "Machinery";
  if (/rudder|stern gear|mooring|anchor/i.test(machinery)) return "Deck";
  if (/cathodic|anode/i.test(machinery)) return "Hull";
  if (/iccp|mgps|anti-fouling|valve remote|vrcs/i.test(machinery)) return "Machinery";
  if (/life saving|davit|rescue boat/i.test(machinery)) return "Deck";
  if (/fire fighting/i.test(machinery)) return "Safety";
  if (/inert gas|\bigg\b|scrubber/i.test(machinery)) return "Machinery";
  if (/compressed air|starting air/i.test(machinery)) return "Machinery";
  if (/electrical motor/i.test(machinery)) return "Electrical";
  if (/electrical power generation|distribution/i.test(machinery)) return "Electrical";
  if (/propulsion line|shafting|propeller|thruster|stern tube/i.test(machinery)) return "Main Propulsion";
  if (/hvac \/ ventilation systems/i.test(machinery)) return "Machinery";
  if (/automation \/ ias \/ ums/i.test(machinery)) return "Electrical";
  if (/valves \/ piping \/ sea chest \/ overboard/i.test(machinery)) return "Machinery";
  if (/shipboard pump/i.test(machinery)) return "Machinery";
  if (/heat exchangers \/ coolers \/ heaters \/ condensers/i.test(machinery)) return "Machinery";
  if (/oily water|sewage treatment|incinerator|odme|ballast water|environmental compliance|environmental machinery|waste handling/i.test(machinery)) {
    return "Machinery";
  }
  if (/deck|mast|rigging|lifting|cargo pumping|cargo tank heating|steam coils|windlass|winch|capstan/i.test(machinery)) {
    return "Deck";
  }
  if (/fresh water generator|\bfwg\b|air conditioning|refrigeration|\bhvac\b/i.test(machinery)) {
    return "Machinery";
  }
  if (/auxiliary|boiler|pump|compressor|purifier|heat exchanger|cargo oil pump turbine|copt/i.test(machinery)) {
    return "Machinery";
  }
  if (/workshop machinery|engine-room tools|portable equipment/i.test(machinery)) {
    return "Machinery";
  }
  if (/deck fittings|mooring-towing|closing appliances/i.test(machinery)) {
    return "Deck";
  }
  if (/hull structure|tanks|coatings|dry.?dock hull survey/i.test(machinery)) {
    return "Hull";
  }
  if (/cargo hold|hatch cover|container|bulk equipment/i.test(machinery)) {
    return "Deck";
  }
  if (/security.*cctv|access control|it network|cyber/i.test(machinery)) {
    return "Electrical";
  }
  if (/emergency \/ damage control|final gap closure|misc critical systems/i.test(machinery)) {
    return "Safety";
  }
  return "Main Propulsion";
}

function jobRowToSeedNode(job: ParsedMasterJobRow, config: EmdrMasterRepositoryReleaseConfig): JobLibrarySeedNode {
  const templateKey = templateIdToKey(job.templateId);
  const machinery = job.machinery || "Main Engine";
  return {
    code: slug(job.jobId),
    name: job.standardJobName,
    nodeType: "standard_job",
    description: job.jobDescription,
    department: departmentForMachinery(machinery),
    workshop: workshopLabel(job.workshop),
    referenceCode: job.jobId,
    defaultPriority: riskToPriority(job.riskLevel),
    estimatedManhours: job.standardManHours ?? undefined,
    mtilPhase: config.mtilPhase,
    mtilJobCode: job.jobId,
    dynamicTemplateKey: templateKey,
    mtilMeta: {
      release: config.release,
      source: "emdr-master-repository",
      jobId: job.jobId,
      templateId: job.templateId,
      dynamicTemplateKey: templateKey,
      libraryVersion: job.libraryVersion,
      machinery,
      system: job.systemGroup,
      component: job.component,
      equipmentCode: job.subComponent,
      rfqCategory: job.rfqCategory,
      budgetCategory: job.budgetCategory,
      classHoldPoint: job.classHoldPoint,
    },
  };
}

/** System → machinery → component → jobs for one machinery family. */
export function buildMachinerySystemNodes(
  jobs: ParsedMasterJobRow[],
  config: EmdrMasterRepositoryReleaseConfig,
): JobLibrarySeedNode[] {
  type CompBucket = Map<string, ParsedMasterJobRow[]>;
  type MachBucket = Map<string, CompBucket>;
  type SystemBucket = Map<string, MachBucket>;

  const bySystem: SystemBucket = new Map();

  for (const job of jobs) {
    const systemKey = job.systemGroup || jobs[0]?.machinery || "Main Engine";
    if (!bySystem.has(systemKey)) bySystem.set(systemKey, new Map());
    const machMap = bySystem.get(systemKey)!;
    const machKey = job.machinery || "Main Engine";
    if (!machMap.has(machKey)) machMap.set(machKey, new Map());
    const compMap = machMap.get(machKey)!;
    const compKey = job.component;
    const list = compMap.get(compKey) ?? [];
    list.push(job);
    compMap.set(compKey, list);
  }

  return [...bySystem.entries()].map(([systemName, machineryMap]) => ({
    code: slug(systemName),
    name: systemName,
    nodeType: "system" as const,
    workshop: workshopLabel(jobs[0]?.workshop ?? "machinery"),
    children: [...machineryMap.entries()].map(([machinery, components]) => ({
      code: slug(`${systemName}_${machinery}`),
      name: machinery,
      nodeType: "machinery" as const,
      children: (() => {
        const usedCodes = new Set<string>();
        return [...components.entries()].map(([component, compJobs]) => ({
          code: uniqueSlug(component, usedCodes),
          name: component,
          nodeType: "component" as const,
          children: compJobs.map((j) => jobRowToSeedNode(j, config)),
        }));
      })(),
    })),
  }));
}

/** @deprecated Use buildMachinerySystemNodes with filtered ME jobs. */
export function buildV30SystemNodes(data: ParsedMtilWorkbook): JobLibrarySeedNode[] {
  const config = {
    kind: "v30" as const,
    release: "V3.0-ME-100",
    treeCode: "mtil_v30_main_engine",
    treeName: "Main Propulsion (V3.0 ME 100%)",
    mtilPhase: 300,
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
    includesCompressedAir: false,
  };
  const meJobs = data.masterJobs.filter((j) => j.jobId.startsWith("JOBS-ME-"));
  return buildMachinerySystemNodes(meJobs.length ? meJobs : data.masterJobs, config);
}

function categoryCodeForMachinery(machinery: string, kind: EmdrMasterRepositoryReleaseConfig["kind"]): string {
  if (/life saving|davit|rescue boat/i.test(machinery)) return `lsa_davits_${kind}`;
  if (/fire fighting/i.test(machinery)) return `fire_fighting_${kind}`;
  if (/inert gas system \/ igg \/ nitrogen generator/i.test(machinery)) return `typewise_inert_gas_${kind}`;
  if (/inert gas|\bigg\b|scrubber/i.test(machinery)) return `inert_gas_${kind}`;
  if (/compressed air|starting air/i.test(machinery)) return `compressed_air_${kind}`;
  if (/electrical motor/i.test(machinery)) return `electrical_motors_${kind}`;
  if (/electrical power generation|distribution/i.test(machinery)) return `electrical_power_${kind}`;
  if (/propulsion line|shafting|propeller|thruster|stern tube/i.test(machinery)) {
    return `propulsion_shafting_${kind}`;
  }
  if (/hvac \/ ventilation systems/i.test(machinery)) return `hvac_ventilation_${kind}`;
  if (/automation \/ ias \/ ums/i.test(machinery)) return `automation_ias_${kind}`;
  if (/valves \/ piping \/ sea chest \/ overboard/i.test(machinery)) return `valves_piping_${kind}`;
  if (/shipboard pump/i.test(machinery)) return `shipboard_pumps_${kind}`;
  if (/heat exchangers \/ coolers \/ heaters \/ condensers/i.test(machinery)) return `typewise_heat_exchangers_${kind}`;
  if (/oily water|sewage treatment|incinerator|odme|ballast water|environmental compliance|environmental machinery|waste handling/i.test(machinery)) {
    return `environmental_machinery_${kind}`;
  }
  if (/windlass|winch|capstan|deck machinery/i.test(machinery)) return `deck_machinery_winch_${kind}`;
  if (/steering gear/i.test(machinery)) return `steering_gear_${kind}`;
  if (/rudder|stern gear/i.test(machinery)) return `rudder_stern_${kind}`;
  if (/cathodic|anode/i.test(machinery)) return `cathodic_anodes_${kind}`;
  if (/iccp/i.test(machinery)) return `iccp_${kind}`;
  if (/mgps|anti-fouling/i.test(machinery)) return `mgps_${kind}`;
  if (/deck fittings|mooring-towing|closing appliances/i.test(machinery)) return `deck_fittings_${kind}`;
  if (/mooring|anchor/i.test(machinery)) return `mooring_anchor_${kind}`;
  if (/valve remote|vrcs/i.test(machinery)) return `vrcs_${kind}`;
  if (/fresh water generator|\bfwg\b/i.test(machinery)) return `fwg_${kind}`;
  if (/air conditioning|\bhvac\b/i.test(machinery)) return `air_conditioning_${kind}`;
  if (/refrigeration/i.test(machinery)) return `refrigeration_${kind}`;
  if (/cargo pumping system/i.test(machinery)) return `cargo_pumping_${kind}`;
  if (/lifting appliances/i.test(machinery)) return `lifting_appliances_${kind}`;
  if (/deck masts|rigging/i.test(machinery)) return `deck_masts_${kind}`;
  if (/deck heating|cargo tank heating|steam coils/i.test(machinery)) return `deck_heating_${kind}`;
  if (/cargo oil pump turbine|copt/i.test(machinery)) return `copt_${kind}`;
  if (/heat exchangers, heaters & condensers/i.test(machinery)) return `heat_exchangers_${kind}`;
  if (/purifier/i.test(machinery)) return `purifiers_${kind}`;
  if (/workshop machinery|engine-room tools|portable equipment/i.test(machinery)) return `workshop_machinery_${kind}`;
  if (/hull structure|tanks|coatings|dry.?dock hull survey/i.test(machinery)) return `hull_structure_${kind}`;
  if (/cargo hold|hatch cover|container|bulk equipment/i.test(machinery)) return `cargo_hold_${kind}`;
  if (/compressor/i.test(machinery)) return `compressors_${kind}`;
  if (/emergency \/ damage control|final gap closure|misc critical systems/i.test(machinery)) {
    return `gap_closure_edmc_${kind}`;
  }
  if (machinery === "Pumps") return `pumps_${kind}`;
  if (/boiler/i.test(machinery)) return `boilers_${kind}`;
  if (/auxiliary/i.test(machinery)) return `auxiliary_engine_${kind}`;
  return `main_engine_${kind}`;
}

function categoryNameForMachinery(machinery: string): string {
  return machinery || "Main Engine";
}

export function buildEmdrMasterRepositoryTree(
  data: ParsedMtilWorkbook,
  config: EmdrMasterRepositoryReleaseConfig,
): JobLibrarySeedNode {
  const byMachinery = new Map<string, ParsedMasterJobRow[]>();
  for (const job of data.masterJobs) {
    const key = job.machinery || "Main Engine";
    const list = byMachinery.get(key) ?? [];
    list.push(job);
    byMachinery.set(key, list);
  }

  const categories: JobLibrarySeedNode[] = [];
  const machineryOrder = [
    "Main Engine",
    "Auxiliary Engine",
    "Boilers",
    "Pumps",
    "Shipboard Pumps",
    "Heat Exchangers / Coolers / Heaters / Condensers",
    "Compressors",
    "Purifiers",
    "Purifiers / Centrifugal Separators",
    "Heat Exchangers, Heaters & Condensers",
    "Cargo Oil Pump Turbine System",
    "Deck Heating, Cargo Tank Heating & Steam Coils",
    "Deck Masts, Wires & Standing Rigging",
    "Deck & Engine Room Lifting Appliances",
    "Cargo Pumping System",
    "Steering Gear System",
    "Rudder & Stern Gear Interface",
    "Cathodic Protection / Anodes",
    "ICCP System",
    "MGPS / Anti-Fouling System",
    "Mooring / Anchoring System",
    "Valve Remote Control System",
    "Deck Machinery – Windlass / Winches / Capstans",
    "Life Saving Appliances / Davits / Rescue Boat Davit",
    "Fire Fighting Systems",
    "Inert Gas / IGG / Scrubber System",
    "Inert Gas System / IGG / Nitrogen Generator",
    "Environmental Machinery / OWS / STP / Incinerator / ODME / BWTS",
    "Oily Water Separator System",
    "Sewage Treatment Plant",
    "Shipboard Incinerator",
    "Oil Discharge Monitoring Equipment",
    "Ballast Water Treatment System",
    "Environmental Compliance",
    "Waste Handling Auxiliary Equipment",
    "Compressed Air & Starting Air System",
    "Electrical Motors / Motor Overhauling",
    "Electrical Power Generation & Distribution",
    "Propulsion Line / Shafting / Stern Tube / Propeller / Thrusters",
    "HVAC / Ventilation Systems",
    "Automation / IAS / UMS / Alarm Monitoring & Control Systems",
    "Valves / Piping / Sea Chest / Overboard Systems",
    "Fresh Water Generator",
    "Air Conditioning & Ventilation",
    "Refrigeration Plant",
    "Hull Structure / Tanks / Coatings / Dry-Dock Hull Survey",
    "Cargo Hold / Hatch Cover / Container / Bulk Equipment",
    "Domestic Fresh Water / Potable Water / Sanitary / Drainage Service Systems",
  ];
  const keys = [
    ...machineryOrder.filter((k) => byMachinery.has(k)),
    ...[...byMachinery.keys()].filter((k) => !machineryOrder.includes(k)),
  ];

  for (const machinery of keys) {
    const jobs = byMachinery.get(machinery)!;
    const systemNodes = buildMachinerySystemNodes(jobs, config);
    categories.push({
      code: categoryCodeForMachinery(machinery, config.kind),
      name: categoryNameForMachinery(machinery),
      nodeType: "category",
      department: departmentForMachinery(machinery),
      children: systemNodes,
      mtilMeta: {
        machinery,
        systemCount: systemNodes.length,
        jobCount: jobs.length,
      },
    });
  }

  const meJobs = data.masterJobs.filter((j) => j.jobId.startsWith("JOBS-ME-")).length;
  const aeJobs = data.masterJobs.filter((j) => j.jobId.startsWith("JOBS-AE-")).length;
  const blrJobs = data.masterJobs.filter((j) => j.jobId.startsWith("JOBS-BLR-")).length;
  const pmpJobs = data.masterJobs.filter((j) => j.jobId.startsWith("JOBS-PMP-")).length;
  const cmpJobs = data.masterJobs.filter((j) => j.jobId.startsWith("JOBS-CMP-")).length;
  const purJobs = data.masterJobs.filter(
    (j) => j.jobId.startsWith("JOBS-PUR-") || /purifier/i.test(j.machinery),
  ).length;
  const hexJobs = data.masterJobs.filter((j) =>
    /heat exchangers, heaters & condensers/i.test(j.machinery),
  ).length;
  const coptJobs = data.masterJobs.filter((j) => /cargo oil pump turbine|copt/i.test(j.machinery)).length;
  const dhkJobs = data.masterJobs.filter((j) => /deck heating|cargo tank heating|steam coils/i.test(j.machinery)).length;
  const dmwJobs = data.masterJobs.filter((j) => /deck masts|rigging/i.test(j.machinery)).length;
  const dlaJobs = data.masterJobs.filter((j) => /lifting appliances/i.test(j.machinery)).length;
  const cgpJobs = data.masterJobs.filter((j) => /cargo pumping system/i.test(j.machinery)).length;
  const stgJobs = data.masterJobs.filter((j) => /steering gear/i.test(j.machinery)).length;
  const dmwWinchJobs = data.masterJobs.filter((j) =>
    /windlass|winch|capstan|deck machinery/i.test(j.machinery),
  ).length;
  const lsaDavitsJobs = data.masterJobs.filter((j) =>
    /life saving|davit|rescue boat/i.test(j.machinery),
  ).length;
  const fireFightingJobs = data.masterJobs.filter((j) => /fire fighting/i.test(j.machinery)).length;
  const inertGasJobs = data.masterJobs.filter((j) => /inert gas|\bigg\b|scrubber/i.test(j.machinery)).length;
  const compressedAirJobs = data.masterJobs.filter((j) => /compressed air|starting air/i.test(j.machinery)).length;
  const electricalMotorJobs = data.masterJobs.filter((j) => /electrical motor/i.test(j.machinery)).length;
  const shipboardPumpJobs = data.masterJobs.filter((j) => j.jobId.startsWith("JOBS-PUMP-")).length;
  const typewiseHeatExchangerJobs = data.masterJobs.filter((j) => j.jobId.startsWith("JOBS-HEX-")).length;
  const typewiseInertGasJobs = data.masterJobs.filter((j) => j.jobId.startsWith("JOBS-IGS-")).length;
  const environmentalMachineryJobs = data.masterJobs.filter((j) => j.jobId.startsWith("JOBS-ENV-")).length;
  const electricalPowerJobs = data.masterJobs.filter((j) => j.jobId.startsWith("JOBS-EPD-")).length;
  const typewiseFireLsaSafetyJobs = data.masterJobs.filter((j) => isV323TypewiseFfsJobId(j.jobId)).length;
  const propulsionShaftingJobs = data.masterJobs.filter((j) => isV324TypewisePropJobId(j.jobId)).length;
  const hvacVentilationJobs = data.masterJobs.filter((j) => isV325TypewiseHvacJobId(j.jobId)).length;
  const automationIasJobs = data.masterJobs.filter((j) => isV326TypewiseAutoJobId(j.jobId)).length;
  const valvesPipingJobs = data.masterJobs.filter((j) => isV327TypewiseVpsoJobId(j.jobId)).length;
  const navigationCommunicationJobs = data.masterJobs.filter((j) => isV328TypewiseNavcomJobId(j.jobId)).length;
  const tankGaugingJobs = data.masterJobs.filter((j) => isV329TypewiseTgliJobId(j.jobId)).length;
  const hydraulicPneumaticJobs = data.masterJobs.filter((j) => isV330TypewiseHypnJobId(j.jobId)).length;
  const accommodationGalleyJobs = data.masterJobs.filter((j) => isV331TypewiseAglhJobId(j.jobId)).length;
  const workshopMachineryJobs = data.masterJobs.filter((j) => isV332TypewiseWmtpJobId(j.jobId)).length;
  const deckFittingsJobs = data.masterJobs.filter((j) => isV333TypewiseDfmtJobId(j.jobId)).length;
  const hullStructureJobs = data.masterJobs.filter((j) => isV334TypewiseHullJobId(j.jobId)).length;
  const cargoHoldJobs = data.masterJobs.filter((j) => isV335TypewiseChhcJobId(j.jobId)).length;
  const domesticWaterJobs = data.masterJobs.filter((j) => isV336TypewiseDwssJobId(j.jobId)).length;
  const securityCctvJobs = data.masterJobs.filter((j) => isV337TypewiseScacsJobId(j.jobId)).length;
  const specialVesselJobs = data.masterJobs.filter((j) => isV339TypewiseSvssJobId(j.jobId)).length;
  const classStatutoryJobs = data.masterJobs.filter((j) => isV340TypewiseCsstJobId(j.jobId)).length;
  const gapClosureEdmcJobs = data.masterJobs.filter((j) => isV341TypewiseEdmcJobId(j.jobId)).length;
  const fwgJobs = data.masterJobs.filter((j) => /fresh water generator|\bfwg\b/i.test(j.machinery)).length;
  const acJobs = data.masterJobs.filter(
    (j) => /air conditioning|\bhvac\b/i.test(j.machinery) && !isV325TypewiseHvacJobId(j.jobId),
  ).length;
  const refJobs = data.masterJobs.filter((j) => /refrigeration/i.test(j.machinery)).length;

  const jobBreakdown = [
    meJobs ? `${meJobs} ME` : null,
    aeJobs ? `${aeJobs} AE` : null,
    blrJobs ? `${blrJobs} BLR` : null,
    pmpJobs ? `${pmpJobs} PMP` : null,
    cmpJobs ? `${cmpJobs} CMP` : null,
    purJobs ? `${purJobs} PUR` : null,
    hexJobs ? `${hexJobs} HEX` : null,
    coptJobs ? `${coptJobs} COPT` : null,
    dhkJobs ? `${dhkJobs} DHK` : null,
    dmwJobs ? `${dmwJobs} DMW` : null,
    dlaJobs ? `${dlaJobs} DLA` : null,
    cgpJobs ? `${cgpJobs} CGP` : null,
    stgJobs ? `${stgJobs} STG` : null,
    dmwWinchJobs ? `${dmwWinchJobs} DMW` : null,
    lsaDavitsJobs ? `${lsaDavitsJobs} LSA` : null,
    fireFightingJobs ? `${fireFightingJobs} FFS` : null,
    inertGasJobs ? `${inertGasJobs} IGG` : null,
    compressedAirJobs ? `${compressedAirJobs} CAS` : null,
    electricalMotorJobs ? `${electricalMotorJobs} EMO` : null,
    shipboardPumpJobs ? `${shipboardPumpJobs} PUMP` : null,
    typewiseHeatExchangerJobs ? `${typewiseHeatExchangerJobs} HEX-TW` : null,
    typewiseInertGasJobs ? `${typewiseInertGasJobs} IGS` : null,
    environmentalMachineryJobs ? `${environmentalMachineryJobs} ENV` : null,
    electricalPowerJobs ? `${electricalPowerJobs} EPD` : null,
    typewiseFireLsaSafetyJobs ? `${typewiseFireLsaSafetyJobs} FLS` : null,
    propulsionShaftingJobs ? `${propulsionShaftingJobs} PROP` : null,
    hvacVentilationJobs ? `${hvacVentilationJobs} HVAC` : null,
    automationIasJobs ? `${automationIasJobs} AUTO` : null,
    valvesPipingJobs ? `${valvesPipingJobs} VPSO` : null,
    navigationCommunicationJobs ? `${navigationCommunicationJobs} NAVCOM` : null,
    tankGaugingJobs ? `${tankGaugingJobs} TGLI` : null,
    hydraulicPneumaticJobs ? `${hydraulicPneumaticJobs} HYPN` : null,
    accommodationGalleyJobs ? `${accommodationGalleyJobs} AGLH` : null,
    workshopMachineryJobs ? `${workshopMachineryJobs} WMTP` : null,
    deckFittingsJobs ? `${deckFittingsJobs} DFMT` : null,
    hullStructureJobs ? `${hullStructureJobs} HULL` : null,
    cargoHoldJobs ? `${cargoHoldJobs} CHHC` : null,
    domesticWaterJobs ? `${domesticWaterJobs} DWSS` : null,
    securityCctvJobs ? `${securityCctvJobs} SCACS` : null,
    specialVesselJobs ? `${specialVesselJobs} SVSS` : null,
    classStatutoryJobs ? `${classStatutoryJobs} CSST` : null,
    gapClosureEdmcJobs ? `${gapClosureEdmcJobs} EDMC` : null,
    fwgJobs ? `${fwgJobs} FWG` : null,
    acJobs ? `${acJobs} AC` : null,
    refJobs ? `${refJobs} REF` : null,
  ]
    .filter(Boolean)
    .join(" + ");

  return {
    code: config.treeCode,
    name: config.treeName,
    nodeType: "department",
    department: "Main Propulsion",
    description: `${config.release} — ${data.masterJobs.length} jobs${jobBreakdown ? ` (${jobBreakdown})` : ""}`,
    children: categories,
    mtilMeta: {
      release: config.release,
      generatedJobCount: data.masterJobs.length,
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
      source: "emdr-master-repository",
      machineryFamilies: keys,
    },
  };
}

/** @deprecated Use buildEmdrMasterRepositoryTree. */
export function buildV30JobLibraryTree(data: ParsedMtilWorkbook): JobLibrarySeedNode {
  return buildEmdrMasterRepositoryTree(data, {
    kind: "v30",
    release: "V3.0-ME-100",
    treeCode: "mtil_v30_main_engine",
    treeName: "Main Propulsion (V3.0 ME 100%)",
    mtilPhase: 300,
    includesAuxiliaryEngine: false,
    includesBoilers: false,
    includesPumps: false,
    includesCompressors: false,
    includesPurifiers: false,
    includesHeatExchangers: false,
    includesDeckMachinery: false,
    includesFwg: false,
    includesAirConditioning: false,
    includesRefrigeration: false,
  });
}
