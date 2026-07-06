import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildEmdrMasterRepositoryTree,
} from "@/lib/emdr/v3/buildJobLibraryTree";
import { importV30MasterRepositoryFromParsed } from "@/lib/emdr/v3/importMasterRepository";
import {
  loadEmdrMasterRepositoryParsed,
} from "@/lib/emdr/v3/loadEmdrMasterRepository";
import type { ParsedV3MasterRepository } from "@/lib/emdr/v3/parseMasterRepository";
import {
  getEmdrMasterRepositoryReleaseConfig,
  MTIL_V30_TREE_CODE,
  MTIL_V31_TREE_CODE,
  MTIL_V32_TREE_CODE,
  MTIL_V33_TREE_CODE,
  type EmdrMasterRepositoryReleaseConfig,
} from "@/lib/emdr/v3/sheets";
import {
  isEmdrMasterRepositoryPresent,
  resolveEmdrMasterRepositoryKind,
} from "@/lib/emdr/paths";
import { MTIL_V201_TREE_CODE } from "@/lib/mtil/v2/sprints/registry";
import type { JobLibrarySeedNode } from "@/lib/vessel/jobLibrary/catalog";
import { validateEmdrSprintWorkbook } from "@/lib/emdr/validateSprintWorkbook";
import { validateMtilWorkbook } from "@/lib/mtil/import/validateWorkbook";

/** V2.0.1 sprint prefixes superseded by V3.x — deactivated on seed to prevent duplicate picker entries. */
const V201_SUPERSEDED_JOB_PREFIXES = [
  "JOBS-ME-CYU-",
  "JOB-ME-CYU-",
  "JOBS-ME-FIS-",
  "JOB-ME-FIS-",
  "JOBS-ME-EVS-",
  "JOB-ME-EVS-",
  "JOBS-ME-TCH-",
  "JOB-ME-TCH-",
  "JOBS-ME-CRK-",
  "JOB-ME-CRK-",
];

const SUPERSEDED_EMDR_TREE_CODES = [
  MTIL_V201_TREE_CODE,
  MTIL_V30_TREE_CODE,
  MTIL_V31_TREE_CODE,
  MTIL_V32_TREE_CODE,
  MTIL_V33_TREE_CODE,
];

async function insertNode(
  node: JobLibrarySeedNode,
  parentId: string | null,
  sortOrder: number,
): Promise<string> {
  const created = await prisma.jobLibraryNode.create({
    data: {
      parentId,
      nodeType: node.nodeType,
      code: node.code,
      name: node.name,
      description: node.description ?? null,
      department: node.department ?? null,
      workshop: node.workshop ?? null,
      sortOrder,
      referenceCode: node.referenceCode ?? null,
      defaultPriority: node.defaultPriority ?? null,
      estimatedManhours: node.estimatedManhours ?? null,
      inputTemplate: (node.inputTemplate ?? null) as Prisma.InputJsonValue,
      mtilPhase: node.mtilPhase ?? null,
      mtilJobCode: node.mtilJobCode ?? null,
      dynamicTemplateKey: node.dynamicTemplateKey ?? null,
      mtilMeta: (node.mtilMeta ?? null) as Prisma.InputJsonValue,
    },
  });

  for (let i = 0; i < (node.children?.length ?? 0); i++) {
    await insertNode(node.children![i]!, created.id, i);
  }

  return created.id;
}

async function mergeChildNodes(parentId: string, children: JobLibrarySeedNode[]) {
  for (let i = 0; i < children.length; i++) {
    const child = children[i]!;
    const existing = await prisma.jobLibraryNode.findFirst({
      where: { parentId, code: child.code, deletedAt: null },
    });

    if (existing) {
      if (child.nodeType === "standard_job") {
        await prisma.jobLibraryNode.update({
          where: { id: existing.id },
          data: {
            name: child.name,
            description: child.description ?? null,
            referenceCode: child.referenceCode ?? null,
            defaultPriority: child.defaultPriority ?? null,
            estimatedManhours: child.estimatedManhours ?? null,
            mtilPhase: child.mtilPhase ?? null,
            mtilJobCode: child.mtilJobCode ?? null,
            dynamicTemplateKey: child.dynamicTemplateKey ?? null,
            mtilMeta: (child.mtilMeta ?? null) as Prisma.InputJsonValue,
            isActive: true,
          },
        });
      }
      if (child.children?.length) {
        await mergeChildNodes(existing.id, child.children);
      }
    } else {
      await insertNode(child, parentId, i);
    }
  }
}

async function softDeleteSubtree(rootId: string) {
  const nodes = await prisma.jobLibraryNode.findMany({
    where: { deletedAt: null },
    select: { id: true, parentId: true },
  });
  const childrenByParent = new Map<string | null, string[]>();
  for (const node of nodes) {
    const list = childrenByParent.get(node.parentId) ?? [];
    list.push(node.id);
    childrenByParent.set(node.parentId, list);
  }

  const toDelete: string[] = [];
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    toDelete.push(id);
    for (const childId of childrenByParent.get(id) ?? []) stack.push(childId);
  }

  if (toDelete.length === 0) return 0;

  await prisma.jobLibraryNode.updateMany({
    where: { id: { in: toDelete } },
    data: { deletedAt: new Date(), isActive: false },
  });
  return toDelete.length;
}

async function retireSupersededEmdrTrees(activeTreeCode: string) {
  let retired = 0;
  for (const code of SUPERSEDED_EMDR_TREE_CODES) {
    if (code === activeTreeCode) continue;
    const root = await prisma.jobLibraryNode.findFirst({
      where: { code, deletedAt: null },
    });
    if (root) retired += await softDeleteSubtree(root.id);
  }
  return retired;
}

async function deactivateSupersededV201Jobs() {
  let deactivated = 0;
  for (const prefix of V201_SUPERSEDED_JOB_PREFIXES) {
    const result = await prisma.masterJobLibrary.updateMany({
      where: { jobId: { startsWith: prefix }, activeFlag: true },
      data: { activeFlag: false },
    });
    deactivated += result.count;
  }
  return deactivated;
}

async function ensureEmdrRootNode(config: EmdrMasterRepositoryReleaseConfig): Promise<string> {
  let root = await prisma.jobLibraryNode.findFirst({
    where: { code: config.treeCode, deletedAt: null },
  });

  if (!root) {
    const maxSort = await prisma.jobLibraryNode.aggregate({
      where: { parentId: null, deletedAt: null },
      _max: { sortOrder: true },
    });
    const rootId = await insertNode(
      {
        code: config.treeCode,
        name: config.treeName,
        nodeType: "department",
        department: "Main Propulsion",
        description: `${config.release} — EMDR master repository`,
        children: [],
      },
      null,
      (maxSort._max.sortOrder ?? -1) + 1,
    );
    root = await prisma.jobLibraryNode.findUniqueOrThrow({ where: { id: rootId } });
  }

  return root.id;
}

async function ensureCategoryNode(
  rootId: string,
  category: JobLibrarySeedNode,
): Promise<string> {
  let node = await prisma.jobLibraryNode.findFirst({
    where: { parentId: rootId, code: category.code, deletedAt: null },
  });

  if (!node) {
    const id = await insertNode({ ...category, children: [] }, rootId, 0);
    node = await prisma.jobLibraryNode.findUniqueOrThrow({ where: { id } });
  }

  return node.id;
}

async function linkMasterJobsToNodes(mtilPhase: number) {
  const nodes = await prisma.jobLibraryNode.findMany({
    where: {
      nodeType: "standard_job",
      mtilPhase,
      OR: [
        { referenceCode: { startsWith: "JOBS-ME-" } },
        { referenceCode: { startsWith: "JOBS-AE-" } },
        { referenceCode: { startsWith: "JOBS-BLR-" } },
        { referenceCode: { startsWith: "JOBS-PMP-" } },
      ],
      deletedAt: null,
    },
    select: { id: true, referenceCode: true },
  });

  let linked = 0;
  for (const n of nodes) {
    if (!n.referenceCode) continue;
    const updated = await prisma.masterJobLibrary.updateMany({
      where: { jobId: n.referenceCode },
      data: { jobLibraryNodeId: n.id, activeFlag: true },
    });
    linked += updated.count;
  }
  return linked;
}

export function getV30MasterRepositoryStats(): ParsedV3MasterRepository | null {
  try {
    return loadEmdrMasterRepositoryParsed();
  } catch {
    return null;
  }
}

export async function isEmdrMasterRepositorySeeded(): Promise<boolean> {
  const kind = resolveEmdrMasterRepositoryKind();
  if (!kind) return false;
  const config = getEmdrMasterRepositoryReleaseConfig(kind);
  const root = await prisma.jobLibraryNode.findFirst({
    where: { code: config.treeCode, deletedAt: null, isActive: true },
  });
  if (!root) return false;

  const parsed = getV30MasterRepositoryStats();
  if (!parsed) return false;

  const activeJobs = await prisma.masterJobLibrary.count({
    where: {
      OR: [
        { jobId: { startsWith: "JOBS-ME-" } },
        { jobId: { startsWith: "JOBS-AE-" } },
        { jobId: { startsWith: "JOBS-BLR-" } },
        { jobId: { startsWith: "JOBS-PMP-" } },
      ],
      activeFlag: true,
    },
  });

  if (kind === "v33") return activeJobs >= 4500;
  if (kind === "v32") return activeJobs >= 3500;
  if (kind === "v31") return activeJobs >= 2500;
  return activeJobs >= 1000;
}

/** @deprecated Use isEmdrMasterRepositorySeeded. */
export async function isV30MasterRepositorySeeded(): Promise<boolean> {
  return isEmdrMasterRepositorySeeded();
}

export async function seedEmdrMasterRepository() {
  const kind = resolveEmdrMasterRepositoryKind();
  if (!kind || !isEmdrMasterRepositoryPresent()) {
    throw new Error("EMDR master repository workbook not found in data/emdr/v2/");
  }

  const config = getEmdrMasterRepositoryReleaseConfig(kind);
  const parsed = loadEmdrMasterRepositoryParsed();
  if (!parsed) {
    throw new Error("Failed to parse EMDR master repository workbook(s)");
  }
  const mtilValidation = validateMtilWorkbook(parsed);
  const emdrValidation = validateEmdrSprintWorkbook(parsed);

  if (!mtilValidation.valid) {
    throw new Error(`EMDR MTIL validation failed: ${mtilValidation.errors[0]?.message ?? "unknown"}`);
  }
  if (!emdrValidation.valid) {
    throw new Error(`EMDR validation failed: ${emdrValidation.errors[0]?.message ?? "unknown"}`);
  }

  const retiredNodes = await retireSupersededEmdrTrees(config.treeCode);
  const deactivatedJobs = await deactivateSupersededV201Jobs();

  const importResult = await importV30MasterRepositoryFromParsed(parsed);
  if (!importResult.ok) {
    throw new Error(importResult.error ?? "EMDR master repository import failed");
  }

  const tree = buildEmdrMasterRepositoryTree(parsed, config);
  const rootId = await ensureEmdrRootNode(config);

  for (const category of tree.children ?? []) {
    const categoryId = await ensureCategoryNode(rootId, category);
    await mergeChildNodes(categoryId, category.children ?? []);
  }

  const linkedNodes = await linkMasterJobsToNodes(config.mtilPhase);

  const meJobs = parsed.masterJobs.filter((j) => j.jobId.startsWith("JOBS-ME-")).length;
  const aeJobs = parsed.masterJobs.filter((j) => j.jobId.startsWith("JOBS-AE-")).length;
  const blrJobs = parsed.masterJobs.filter((j) => j.jobId.startsWith("JOBS-BLR-")).length;
  const pmpJobs = parsed.masterJobs.filter((j) => j.jobId.startsWith("JOBS-PMP-")).length;

  return {
    kind,
    release: parsed.release,
    jobCount: parsed.masterJobs.length,
    mainEngineJobCount: meJobs,
    auxiliaryEngineJobCount: aeJobs,
    boilerJobCount: blrJobs,
    pumpJobCount: pmpJobs,
    systemCount: parsed.repositoryIndex.length,
    templateCount: parsed.templates.length,
    measurementCount: parsed.measurements.length,
    checklistItemCount: parsed.checklistItems.length,
    imported: importResult.imported,
    linkedNodes,
    retiredSupersededNodes: retiredNodes,
    deactivatedV201Jobs: deactivatedJobs,
    validation: {
      mtilWarnings: mtilValidation.warnings.length,
      emdrWarnings: emdrValidation.warnings.length,
    },
  };
}

/** @deprecated Use seedEmdrMasterRepository. */
export async function seedV30MainEngineRepository() {
  return seedEmdrMasterRepository();
}
