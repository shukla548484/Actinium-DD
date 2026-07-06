import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { JobLibrarySeedNode } from "@/lib/vessel/jobLibrary/catalog";
import { buildV2SprintSystemNodes } from "@/lib/mtil/v2/import/buildV2SprintJobLibraryTree";
import { importV2SprintFromPath } from "@/lib/mtil/v2/import/importSprintWorkbook";
import {
  parseV2SprintWorkbookFile,
  parseV2SprintWorkbookFileIfExists,
} from "@/lib/mtil/v2/import/parseSprintWorkbook";
import {
  MTIL_V201_MTIL_PHASE,
  MTIL_V201_TREE_CODE,
  V2_SPRINT_REGISTRY,
  getV2SprintById,
  sprintWorkbookPath,
  type V2SprintDefinition,
} from "@/lib/mtil/v2/sprints/registry";

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

async function ensureV201CategoryNode(): Promise<string> {
  let root = await prisma.jobLibraryNode.findFirst({
    where: { code: MTIL_V201_TREE_CODE, deletedAt: null },
  });

  if (!root) {
    const maxSort = await prisma.jobLibraryNode.aggregate({
      where: { parentId: null, deletedAt: null },
      _max: { sortOrder: true },
    });
    const rootId = await insertNode(
      {
        code: MTIL_V201_TREE_CODE,
        name: "Main Propulsion (V2.0.1)",
        nodeType: "department",
        department: "Main Propulsion",
        description: "V2.0.1 production main propulsion job library",
        children: [
          {
            code: "main_engine_v201",
            name: "Main Engine",
            nodeType: "category",
            department: "Main Propulsion",
            children: [],
          },
        ],
      },
      null,
      (maxSort._max.sortOrder ?? -1) + 1,
    );
    root = await prisma.jobLibraryNode.findUniqueOrThrow({ where: { id: rootId } });
  }

  let category = await prisma.jobLibraryNode.findFirst({
    where: { parentId: root.id, code: "main_engine_v201", deletedAt: null },
  });

  if (!category) {
    const categoryId = await insertNode(
      {
        code: "main_engine_v201",
        name: "Main Engine",
        nodeType: "category",
        department: "Main Propulsion",
        children: [],
      },
      root.id,
      0,
    );
    category = await prisma.jobLibraryNode.findUniqueOrThrow({ where: { id: categoryId } });
  }

  return category.id;
}

async function linkMasterJobsToNodes(sprint: V2SprintDefinition) {
  const patterns = [sprint.jobIdPattern, sprint.legacyJobIdPattern].filter(Boolean) as string[];
  const nodes = await prisma.jobLibraryNode.findMany({
    where: {
      nodeType: "standard_job",
      mtilPhase: MTIL_V201_MTIL_PHASE,
      OR: patterns.map((p) => ({ referenceCode: { startsWith: p } })),
      deletedAt: null,
    },
    select: { id: true, referenceCode: true },
  });

  let linked = 0;
  for (const n of nodes) {
    if (!n.referenceCode) continue;
    const updated = await prisma.masterJobLibrary.updateMany({
      where: { jobId: n.referenceCode },
      data: { jobLibraryNodeId: n.id },
    });
    linked += updated.count;
  }
  return linked;
}

export async function seedV201Sprint(sprintId: string) {
  const sprint = getV2SprintById(sprintId);
  if (!sprint) throw new Error(`Unknown V2 sprint: ${sprintId}`);

  const workbookPath = sprintWorkbookPath(sprint);
  const parsed = parseV2SprintWorkbookFile(workbookPath);

  const importResult = await importV2SprintFromPath(workbookPath, {
    mode: "merge",
    jobIdPrefix: sprint.jobIdPrefix,
  });

  if (!importResult.ok) {
    throw new Error(importResult.error ?? `${sprint.id} import failed`);
  }

  const categoryId = await ensureV201CategoryNode();
  const systemNodes = buildV2SprintSystemNodes({ data: parsed, sprint });
  await mergeChildNodes(categoryId, systemNodes);

  const linkedNodes = await linkMasterJobsToNodes(sprint);

  return {
    sprintId: sprint.id,
    sprintCode: sprint.sprintCode,
    imported: importResult.imported,
    linkedNodes,
    jobCount: parsed.masterJobs.length,
    templates: parsed.templates.length,
    libraryVersion: parsed.libraryVersion,
  };
}

export async function seedV201AllSprints() {
  const results = [];
  for (const sprint of V2_SPRINT_REGISTRY) {
    results.push(await seedV201Sprint(sprint.id));
  }
  const totalJobs = results.reduce((sum, r) => sum + r.jobCount, 0);
  const totalLinked = results.reduce((sum, r) => sum + r.linkedNodes, 0);
  return { sprints: results, totalJobs, totalLinked };
}

export async function isV201SprintSeeded(sprint: V2SprintDefinition): Promise<boolean> {
  const node = await prisma.jobLibraryNode.findFirst({
    where: { code: MTIL_V201_TREE_CODE, deletedAt: null },
  });
  const template = await prisma.jobDynamicTemplate.findFirst({
    where: {
      OR: [
        { templateId: sprint.sampleTemplateId },
        ...(sprint.legacySampleTemplateId
          ? [{ templateId: sprint.legacySampleTemplateId }]
          : []),
      ],
      activeFlag: true,
    },
  });
  const jobs = await prisma.masterJobLibrary.count({
    where: {
      OR: [
        { jobId: { startsWith: sprint.jobIdPattern } },
        ...(sprint.legacyJobIdPattern
          ? [{ jobId: { startsWith: sprint.legacyJobIdPattern } }]
          : []),
      ],
    },
  });
  return Boolean(node && template && jobs > 0);
}

export async function isV201AllSprintsSeeded(): Promise<boolean> {
  const checks = await Promise.all(V2_SPRINT_REGISTRY.map((s) => isV201SprintSeeded(s)));
  return checks.every(Boolean);
}

export function getV201SprintStats(sprint: V2SprintDefinition) {
  const parsed = parseV2SprintWorkbookFileIfExists(sprintWorkbookPath(sprint));
  return {
    sprintId: sprint.id,
    sprintCode: sprint.sprintCode,
    name: sprint.name,
    libraryVersion: parsed.libraryVersion ?? sprint.release,
    jobCount: parsed.masterJobs.length,
    catalogTemplateCount: parsed.templates.length,
    measurementCount: parsed.measurements.length,
    checklistItemCount: parsed.checklistItems.length,
    workbookPresent: parsed.masterJobs.length > 0,
  };
}

export function getV201CombinedStats() {
  const sprints = V2_SPRINT_REGISTRY.map(getV201SprintStats);
  return {
    release: "V2.0.1",
    sprints,
    jobCount: sprints.reduce((sum, s) => sum + s.jobCount, 0),
    catalogTemplateCount: sprints.reduce((sum, s) => sum + s.catalogTemplateCount, 0),
    measurementCount: sprints.reduce((sum, s) => sum + s.measurementCount, 0),
    checklistItemCount: sprints.reduce((sum, s) => sum + s.checklistItemCount, 0),
  };
}
