import { prisma } from "@/lib/prisma";
import type { JobLibrarySeedNode } from "@/lib/vessel/jobLibrary/catalog";
import {
  generateMasterRepositoryJobLibraryTree,
  getMasterRepositoryV12Stats,
  MASTER_REPOSITORY_V12_PATH,
} from "@/lib/mtil/master/repositoryV12";

const TREE_CODE = "mtil_master_repo_v12";

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

export async function seedMasterRepositoryV12(): Promise<{
  imported: boolean;
  jobCount: number;
  templates: number;
  frameworkAreas: number;
  libraryVersion: string;
  release: string;
}> {
  const stats = getMasterRepositoryV12Stats();

  const existing = await prisma.jobLibraryNode.findFirst({
    where: { code: TREE_CODE, deletedAt: null },
  });

  if (!existing) {
    const tree = generateMasterRepositoryJobLibraryTree();
    const maxSort = await prisma.jobLibraryNode.aggregate({
      where: { parentId: null, deletedAt: null },
      _max: { sortOrder: true },
    });
    await insertNode(tree, null, (maxSort._max.sortOrder ?? -1) + 1);
  }

  return {
    imported: true,
    jobCount: stats.jobCount,
    templates: stats.catalogTemplateCount,
    frameworkAreas: stats.frameworkAreaCount,
    libraryVersion: stats.libraryVersion,
    release: stats.release,
  };
}

export async function isMasterRepositoryV12Seeded(): Promise<boolean> {
  const node = await prisma.jobLibraryNode.findFirst({
    where: { code: TREE_CODE, deletedAt: null },
  });
  return Boolean(node);
}

export { MASTER_REPOSITORY_V12_PATH, TREE_CODE };
