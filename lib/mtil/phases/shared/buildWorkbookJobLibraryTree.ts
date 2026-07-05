import type { DdJobPriority } from "@prisma/client";
import type { JobLibrarySeedNode } from "@/lib/vessel/jobLibrary/catalog";
import type { ParsedMasterJobRow, ParsedMtilWorkbook } from "@/lib/mtil/import/parseWorkbook";
import { templateIdToKey } from "./workbookUtils";

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

export type WorkbookTreeConfig = {
  data: ParsedMtilWorkbook;
  treeCode: string;
  treeName: string;
  categoryCode: string;
  categoryName: string;
  department: string;
  phase: number;
  source: string;
  idPrefix: string;
  libraryVersion: string;
  jobCount: number;
  catalogTemplateCount: number;
};

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

function jobRowToSeedNode(job: ParsedMasterJobRow, cfg: WorkbookTreeConfig): JobLibrarySeedNode {
  const templateKey = templateIdToKey(job.templateId);
  return {
    code: slug(job.jobId),
    name: job.standardJobName,
    nodeType: "standard_job",
    description: job.jobDescription,
    department: cfg.department,
    workshop: workshopLabel(job.workshop),
    referenceCode: job.jobId,
    defaultPriority: riskToPriority(job.riskLevel),
    estimatedManhours: job.standardManHours ?? undefined,
    mtilPhase: cfg.phase,
    mtilJobCode: job.jobId,
    dynamicTemplateKey: templateKey,
    mtilMeta: {
      phase: cfg.phase,
      jobId: job.jobId,
      templateId: job.templateId,
      dynamicTemplateKey: templateKey,
      libraryVersion: job.libraryVersion,
      source: cfg.source,
      machinery: job.machinery,
      component: job.component,
      rfqCategory: job.rfqCategory,
      budgetCategory: job.budgetCategory,
      classHoldPoint: job.classHoldPoint,
      permitRequired: job.permitRequired,
    },
  };
}

/** Build JobLibrary tree from an engineering workbook (machinery → component → jobs). */
export function buildWorkbookJobLibraryTree(cfg: WorkbookTreeConfig): JobLibrarySeedNode & {
  mtilMeta?: { phase: number; generatedJobCount: number; source: string };
} {
  type CompBucket = Map<string, ParsedMasterJobRow[]>;
  type MachBucket = Map<string, CompBucket>;
  const byMachinery: MachBucket = new Map();

  for (const job of cfg.data.masterJobs) {
    const machKey = job.machinery;
    if (!byMachinery.has(machKey)) byMachinery.set(machKey, new Map());
    const compMap = byMachinery.get(machKey)!;
    const compKey = job.component;
    const list = compMap.get(compKey) ?? [];
    list.push(job);
    compMap.set(compKey, list);
  }

  const systemNodes: JobLibrarySeedNode[] = [...byMachinery.entries()].map(([machinery, components]) => ({
    code: slug(machinery),
    name: machinery,
    nodeType: "system" as const,
    workshop: workshopLabel(cfg.data.masterJobs[0]?.workshop ?? "machinery"),
    children: [
      {
        code: slug(`${machinery}_unit`),
        name: machinery,
        nodeType: "machinery" as const,
        children: [...components.entries()].map(([component, jobs]) => ({
          code: slug(component),
          name: component,
          nodeType: "component" as const,
          children: jobs.map((j) => jobRowToSeedNode(j, cfg)),
        })),
      },
    ],
  }));

  return {
    code: cfg.treeCode,
    name: cfg.treeName,
    nodeType: "department",
    department: cfg.department,
    description: `${cfg.libraryVersion} curated library — ${cfg.jobCount} jobs, ${cfg.catalogTemplateCount} templates (${cfg.idPrefix} IDs)`,
    children: [
      {
        code: cfg.categoryCode,
        name: cfg.categoryName,
        nodeType: "category",
        department: cfg.department,
        children: systemNodes,
      },
    ],
    mtilMeta: { phase: cfg.phase, generatedJobCount: cfg.jobCount, source: cfg.source },
  };
}
