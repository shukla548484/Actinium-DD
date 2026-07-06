import type { DdJobPriority } from "@prisma/client";
import type { ParsedMasterJobRow, ParsedMtilWorkbook } from "@/lib/mtil/import/parseWorkbook";
import type { JobLibrarySeedNode } from "@/lib/vessel/jobLibrary/catalog";
import type { EmdrMasterRepositoryReleaseConfig } from "@/lib/emdr/v3/sheets";
import { templateIdToKey } from "@/lib/mtil/phases/shared/workbookUtils";

function slug(value: string, max = 48): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, max);
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
  if (/life saving|davit|rescue boat/i.test(machinery)) return "Deck";
  if (/fire fighting/i.test(machinery)) return "Safety";
  if (/inert gas|\bigg\b|scrubber/i.test(machinery)) return "Machinery";
  if (/deck|mast|rigging|lifting|cargo pumping|cargo tank heating|steam coils|windlass|winch|capstan/i.test(machinery)) {
    return "Deck";
  }
  if (/fresh water generator|\bfwg\b|air conditioning|refrigeration|\bhvac\b/i.test(machinery)) {
    return "Machinery";
  }
  if (/auxiliary|boiler|pump|compressor|purifier|heat exchanger|cargo oil pump turbine|copt/i.test(machinery)) {
    return "Machinery";
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
      children: [...components.entries()].map(([component, compJobs]) => ({
        code: slug(component),
        name: component,
        nodeType: "component" as const,
        children: compJobs.map((j) => jobRowToSeedNode(j, config)),
      })),
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
  };
  const meJobs = data.masterJobs.filter((j) => j.jobId.startsWith("JOBS-ME-"));
  return buildMachinerySystemNodes(meJobs.length ? meJobs : data.masterJobs, config);
}

function categoryCodeForMachinery(machinery: string, kind: EmdrMasterRepositoryReleaseConfig["kind"]): string {
  if (/life saving|davit|rescue boat/i.test(machinery)) return `lsa_davits_${kind}`;
  if (/fire fighting/i.test(machinery)) return `fire_fighting_${kind}`;
  if (/inert gas|\bigg\b|scrubber/i.test(machinery)) return `inert_gas_${kind}`;
  if (/windlass|winch|capstan|deck machinery/i.test(machinery)) return `deck_machinery_winch_${kind}`;
  if (/steering gear/i.test(machinery)) return `steering_gear_${kind}`;
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
  if (/compressor/i.test(machinery)) return `compressors_${kind}`;
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
    "Compressors",
    "Purifiers",
    "Heat Exchangers, Heaters & Condensers",
    "Cargo Oil Pump Turbine System",
    "Deck Heating, Cargo Tank Heating & Steam Coils",
    "Deck Masts, Wires & Standing Rigging",
    "Deck & Engine Room Lifting Appliances",
    "Cargo Pumping System",
    "Steering Gear System",
    "Deck Machinery – Windlass / Winches / Capstans",
    "Life Saving Appliances / Davits / Rescue Boat Davit",
    "Fire Fighting Systems",
    "Inert Gas / IGG / Scrubber System",
    "Fresh Water Generator",
    "Air Conditioning & Ventilation",
    "Refrigeration Plant",
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
  const fwgJobs = data.masterJobs.filter((j) => /fresh water generator|\bfwg\b/i.test(j.machinery)).length;
  const acJobs = data.masterJobs.filter((j) => /air conditioning|\bhvac\b/i.test(j.machinery)).length;
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
