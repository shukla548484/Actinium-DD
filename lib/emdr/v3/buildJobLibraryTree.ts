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
  if (/auxiliary|boiler|pump/i.test(machinery)) return "Machinery";
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
  };
  const meJobs = data.masterJobs.filter((j) => j.jobId.startsWith("JOBS-ME-"));
  return buildMachinerySystemNodes(meJobs.length ? meJobs : data.masterJobs, config);
}

function categoryCodeForMachinery(machinery: string, kind: EmdrMasterRepositoryReleaseConfig["kind"]): string {
  if (/pump/i.test(machinery)) return `pumps_${kind}`;
  if (/boiler/i.test(machinery)) return `boilers_${kind}`;
  if (/auxiliary/i.test(machinery)) return `auxiliary_engine_${kind}`;
  return `main_engine_${kind}`;
}

function categoryNameForMachinery(machinery: string): string {
  if (/auxiliary/i.test(machinery)) return "Auxiliary Engine";
  if (/boiler/i.test(machinery)) return "Boilers";
  if (/pump/i.test(machinery)) return "Pumps";
  return "Main Engine";
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
  const machineryOrder = ["Main Engine", "Auxiliary Engine", "Boilers", "Pumps"];
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

  const jobBreakdown = [
    meJobs ? `${meJobs} ME` : null,
    aeJobs ? `${aeJobs} AE` : null,
    blrJobs ? `${blrJobs} BLR` : null,
    pmpJobs ? `${pmpJobs} PMP` : null,
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
  });
}
