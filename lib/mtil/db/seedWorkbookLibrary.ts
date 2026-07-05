import { prisma } from "@/lib/prisma";
import { importJobCatalogFromPath } from "@/lib/mtil/import/importJobCatalogWorkbook";
import type { JobLibrarySeedNode } from "@/lib/vessel/jobLibrary/catalog";

export type WorkbookSeedConfig = {
  workbookPath: string;
  phasePrefix: string;
  treeCode: string;
  generateTree: () => JobLibrarySeedNode;
  getStats: () => { jobCount: number; catalogTemplateCount: number; libraryVersion: string };
  jobIdPattern: string;
  mtilPhase: number;
  sampleTemplateId?: string;
  /** When false, seeded if job library tree exists (for initialized/empty workbooks). */
  requireTemplate?: boolean;
};

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
      inputTemplate: undefined,
      mtilPhase: node.mtilPhase ?? null,
      mtilJobCode: node.mtilJobCode ?? null,
      dynamicTemplateKey: node.dynamicTemplateKey ?? null,
      mtilMeta: (node.mtilMeta ?? null) as object,
    },
  });

  for (let i = 0; i < (node.children?.length ?? 0); i++) {
    await insertNode(node.children![i]!, created.id, i);
  }

  return created.id;
}

async function linkMasterJobsToNodes(jobIdPattern: string, mtilPhase: number) {
  const nodes = await prisma.jobLibraryNode.findMany({
    where: {
      nodeType: "standard_job",
      mtilPhase,
      referenceCode: { startsWith: jobIdPattern },
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

export async function seedWorkbookLibrary(cfg: WorkbookSeedConfig): Promise<{
  imported: boolean;
  jobCount: number;
  templates: number;
  linkedNodes: number;
  libraryVersion: string;
}> {
  const stats = cfg.getStats();

  const importResult = await importJobCatalogFromPath(cfg.workbookPath, {
    mode: "merge",
    phasePrefix: cfg.phasePrefix,
  });

  if (!importResult.ok) {
    throw new Error(importResult.error ?? `${cfg.treeCode} workbook import failed`);
  }

  const existing = await prisma.jobLibraryNode.findFirst({
    where: { code: cfg.treeCode, deletedAt: null },
  });

  if (!existing) {
    const tree = cfg.generateTree();
    const maxSort = await prisma.jobLibraryNode.aggregate({
      where: { parentId: null, deletedAt: null },
      _max: { sortOrder: true },
    });
    await insertNode(tree, null, (maxSort._max.sortOrder ?? -1) + 1);
  }

  const linkedNodes = await linkMasterJobsToNodes(cfg.jobIdPattern, cfg.mtilPhase);

  return {
    imported: true,
    jobCount: stats.jobCount,
    templates: stats.catalogTemplateCount,
    linkedNodes,
    libraryVersion: stats.libraryVersion,
  };
}

export async function isWorkbookLibrarySeeded(
  cfg: Pick<WorkbookSeedConfig, "treeCode" | "sampleTemplateId" | "requireTemplate">,
): Promise<boolean> {
  const node = await prisma.jobLibraryNode.findFirst({ where: { code: cfg.treeCode, deletedAt: null } });
  if (cfg.requireTemplate === false || !cfg.sampleTemplateId) return Boolean(node);
  const template = await prisma.jobDynamicTemplate.findFirst({
    where: { templateId: cfg.sampleTemplateId, activeFlag: true },
  });
  return Boolean(node && template);
}
