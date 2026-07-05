import type { JobLibraryNodeType, JobInputFieldDef, JobLibraryNodeDto } from "./catalog";
import { ensureJobLibrarySeeded } from "./seed";
import { filterJobLibraryRootsByProjectType } from "./projectTypeFilter";
import { filterJobLibraryRootsByVesselType } from "./vesselTypeFilter";
import { resolveDynamicTemplate, resolveDynamicTemplateAsync } from "@/lib/mtil/dynamicTemplateEngine";
import { resolveJobInputTemplateForNode } from "./resolveJobTemplate";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export { ensureJobLibrarySeeded } from "./seed";
export { resolveJobInputTemplateForNode } from "./resolveJobTemplate";
export { JOB_LIBRARY_CATALOG, STANDARD_JOB_INPUT_TEMPLATE } from "./catalog";
export type { JobLibraryNodeDto, JobInputFieldDef, JobLibraryNodeType };

function resolveInputTemplate(row: {
  nodeType: string;
  inputTemplate: unknown;
  dynamicTemplateKey?: string | null;
}): JobInputFieldDef[] | null {
  if (row.nodeType === "standard_job" && row.dynamicTemplateKey) {
    return resolveDynamicTemplate(row.dynamicTemplateKey);
  }
  return (row.inputTemplate as JobInputFieldDef[] | null) ?? null;
}

/** Async resolver — DB → workbook bundle → code registry. */
export async function resolveInputTemplateAsync(row: {
  nodeType: string;
  inputTemplate: unknown;
  dynamicTemplateKey?: string | null;
  referenceCode?: string | null;
  mtilJobCode?: string | null;
}): Promise<JobInputFieldDef[] | null> {
  return resolveJobInputTemplateForNode(row);
}

function mapNode(
  row: Prisma.JobLibraryNodeGetPayload<{ include: { _count: { select: { children: true } } } }>,
): JobLibraryNodeDto {
  return {
    id: row.id,
    parentId: row.parentId,
    nodeType: row.nodeType as JobLibraryNodeType,
    code: row.code,
    name: row.name,
    description: row.description,
    department: row.department,
    workshop: row.workshop,
    referenceCode: row.referenceCode,
    defaultPriority: row.defaultPriority,
    estimatedManhours: row.estimatedManhours,
    inputTemplate: resolveInputTemplate(row),
    dynamicTemplateKey: row.dynamicTemplateKey,
    mtilJobCode: row.mtilJobCode,
    hasChildren: row._count.children > 0,
  };
}

async function mapNodeAsync(
  row: Prisma.JobLibraryNodeGetPayload<{ include: { _count: { select: { children: true } } } }>,
): Promise<JobLibraryNodeDto> {
  const inputTemplate = await resolveJobInputTemplateForNode({
    nodeType: row.nodeType,
    inputTemplate: row.inputTemplate,
    dynamicTemplateKey: row.dynamicTemplateKey,
    referenceCode: row.referenceCode,
    mtilJobCode: row.mtilJobCode,
  });
  return {
    id: row.id,
    parentId: row.parentId,
    nodeType: row.nodeType as JobLibraryNodeType,
    code: row.code,
    name: row.name,
    description: row.description,
    department: row.department,
    workshop: row.workshop,
    referenceCode: row.referenceCode,
    defaultPriority: row.defaultPriority,
    estimatedManhours: row.estimatedManhours,
    inputTemplate,
    dynamicTemplateKey: row.dynamicTemplateKey,
    mtilJobCode: row.mtilJobCode,
    hasChildren: row._count.children > 0,
  };
}

export async function listJobLibraryRoots(
  projectType?: string | null,
  vesselType?: string | null,
): Promise<JobLibraryNodeDto[]> {
  await ensureJobLibrarySeeded();
  const rows = await prisma.jobLibraryNode.findMany({
    where: { parentId: null, deletedAt: null, isActive: true },
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { children: true } } },
  });
  let nodes = rows.map(mapNode);
  nodes = filterJobLibraryRootsByProjectType(nodes, projectType);
  nodes = filterJobLibraryRootsByVesselType(nodes, vesselType);
  return nodes;
}

export async function listJobLibraryChildren(parentId: string | null): Promise<JobLibraryNodeDto[]> {
  await ensureJobLibrarySeeded();
  const rows = await prisma.jobLibraryNode.findMany({
    where: { parentId, deletedAt: null, isActive: true },
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { children: true } } },
  });
  return Promise.all(rows.map(mapNodeAsync));
}

export async function getJobLibraryNode(id: string): Promise<JobLibraryNodeDto | null> {
  await ensureJobLibrarySeeded();
  const row = await prisma.jobLibraryNode.findFirst({
    where: { id, deletedAt: null },
    include: { _count: { select: { children: true } } },
  });
  return row ? mapNodeAsync(row) : null;
}

export async function getJobLibraryPath(standardJobId: string): Promise<JobLibraryNodeDto[]> {
  const path: JobLibraryNodeDto[] = [];
  let current = await getJobLibraryNode(standardJobId);
  while (current) {
    path.unshift(current);
    if (!current.parentId) break;
    current = await getJobLibraryNode(current.parentId);
  }
  return path;
}

export async function searchStandardJobs(query: string, limit = 20): Promise<JobLibraryNodeDto[]> {
  await ensureJobLibrarySeeded();
  const rows = await prisma.jobLibraryNode.findMany({
    where: {
      nodeType: "standard_job",
      deletedAt: null,
      isActive: true,
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { code: { contains: query, mode: "insensitive" } },
        { referenceCode: { contains: query, mode: "insensitive" } },
      ],
    },
    take: limit,
    orderBy: { name: "asc" },
    include: { _count: { select: { children: true } } },
  });
  return Promise.all(rows.map(mapNodeAsync));
}
