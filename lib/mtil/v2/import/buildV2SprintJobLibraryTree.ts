import type { DdJobPriority } from "@prisma/client";
import type { ParsedMasterJobRow, ParsedMtilWorkbook } from "@/lib/mtil/import/parseWorkbook";
import type { JobLibrarySeedNode } from "@/lib/vessel/jobLibrary/catalog";
import { templateIdToKey } from "@/lib/mtil/phases/shared/workbookUtils";
import type { V2SprintDefinition } from "@/lib/mtil/v2/sprints/registry";
import { MTIL_V201_MTIL_PHASE } from "@/lib/mtil/v2/sprints/registry";

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

function jobRowToSeedNode(job: ParsedMasterJobRow, sprint: V2SprintDefinition): JobLibrarySeedNode {
  const templateKey = templateIdToKey(job.templateId);
  return {
    code: slug(job.jobId),
    name: job.standardJobName,
    nodeType: "standard_job",
    description: job.jobDescription,
    department: "Main Propulsion",
    workshop: workshopLabel(job.workshop),
    referenceCode: job.jobId,
    defaultPriority: riskToPriority(job.riskLevel),
    estimatedManhours: job.standardManHours ?? undefined,
    mtilPhase: MTIL_V201_MTIL_PHASE,
    mtilJobCode: job.jobId,
    dynamicTemplateKey: templateKey,
    mtilMeta: {
      release: sprint.release,
      sprintId: sprint.id,
      sprintCode: sprint.sprintCode,
      jobId: job.jobId,
      templateId: job.templateId,
      dynamicTemplateKey: templateKey,
      libraryVersion: job.libraryVersion,
      source: sprint.filename,
      machinery: job.machinery,
      system: job.systemGroup,
      component: job.component,
      equipmentCode: job.subComponent,
      rfqCategory: job.rfqCategory,
      budgetCategory: job.budgetCategory,
      classHoldPoint: job.classHoldPoint,
    },
  };
}

export type V2SprintTreeConfig = {
  data: ParsedMtilWorkbook;
  sprint: V2SprintDefinition;
};

/** System → machinery → component → jobs for one V2 sprint. */
export function buildV2SprintSystemNodes(cfg: V2SprintTreeConfig): JobLibrarySeedNode[] {
  type CompBucket = Map<string, ParsedMasterJobRow[]>;
  type MachBucket = Map<string, CompBucket>;
  type SystemBucket = Map<string, MachBucket>;

  const bySystem: SystemBucket = new Map();

  for (const job of cfg.data.masterJobs) {
    const systemKey = job.systemGroup || cfg.sprint.systemName;
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
    workshop: workshopLabel(cfg.data.masterJobs[0]?.workshop ?? "machinery"),
    children: [...machineryMap.entries()].map(([machinery, components]) => ({
      code: slug(`${systemName}_${machinery}`),
      name: machinery,
      nodeType: "machinery" as const,
      children: [...components.entries()].map(([component, jobs]) => ({
        code: slug(component),
        name: component,
        nodeType: "component" as const,
        children: jobs.map((j) => jobRowToSeedNode(j, cfg.sprint)),
      })),
    })),
  }));
}

/** Full V2.0.1 department tree for one sprint (merged under shared root in DB). */
export function buildV2SprintJobLibraryTree(cfg: V2SprintTreeConfig): JobLibrarySeedNode {
  const systemNodes = buildV2SprintSystemNodes(cfg);
  const jobCount = cfg.data.masterJobs.length;
  const templateCount = cfg.data.templates.length;

  return {
    code: "mtil_v201_main_propulsion",
    name: "Main Propulsion (V2.0.1)",
    nodeType: "department",
    department: "Main Propulsion",
    description: `${cfg.sprint.release} — ${cfg.sprint.name}: ${jobCount} jobs, ${templateCount} templates (${cfg.sprint.sprintCode})`,
    children: [
      {
        code: "main_engine_v201",
        name: "Main Engine",
        nodeType: "category",
        department: "Main Propulsion",
        children: systemNodes,
      },
    ],
    mtilMeta: {
      release: cfg.sprint.release,
      sprintId: cfg.sprint.id,
      generatedJobCount: jobCount,
      source: cfg.sprint.filename,
    },
  };
}

/** Combined tree from multiple parsed sprint workbooks. */
export function buildV201CombinedJobLibraryTree(
  entries: { data: ParsedMtilWorkbook; sprint: V2SprintDefinition }[],
): JobLibrarySeedNode {
  const systemNodes: JobLibrarySeedNode[] = [];
  let totalJobs = 0;

  for (const entry of entries) {
    systemNodes.push(...buildV2SprintSystemNodes(entry));
    totalJobs += entry.data.masterJobs.length;
  }

  return {
    code: "mtil_v201_main_propulsion",
    name: "Main Propulsion (V2.0.1)",
    nodeType: "department",
    department: "Main Propulsion",
    description: `V2.0.1 production library — ${totalJobs} jobs across ${entries.length} sprints (ME-CYU, ME-FIS, ME-EVS)`,
    children: [
      {
        code: "main_engine_v201",
        name: "Main Engine",
        nodeType: "category",
        department: "Main Propulsion",
        children: systemNodes,
      },
    ],
    mtilMeta: {
      release: "V2.0.1",
      generatedJobCount: totalJobs,
      source: "v201-sprints",
    },
  };
}
