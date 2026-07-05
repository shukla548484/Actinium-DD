import type { DdJobPriority, JobLibraryNodeType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/db/superintendent/pagination";
import type { JobInputFieldDef, JobLibraryNodeDto } from "@/lib/vessel/jobLibrary/catalog";
import { STANDARD_JOB_INPUT_TEMPLATE } from "@/lib/vessel/jobLibrary/catalog";
import { ensureJobLibrarySeeded } from "@/lib/vessel/jobLibrary/seed";

const CHILD_TYPES: Partial<Record<JobLibraryNodeType, JobLibraryNodeType[]>> = {
  department: ["category"],
  category: ["system"],
  system: ["machinery", "standard_job"],
  machinery: ["component"],
  component: ["standard_job"],
};

function mapAdminNode(
  row: Prisma.JobLibraryNodeGetPayload<{ include: { _count: { select: { children: true } } } }>,
): JobLibraryNodeDto & { isActive: boolean; sortOrder: number } {
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
    inputTemplate: row.inputTemplate as JobInputFieldDef[] | null,
    hasChildren: row._count.children > 0,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
  };
}

export function allowedChildNodeTypes(parentType: JobLibraryNodeType | null): JobLibraryNodeType[] {
  if (!parentType) return ["department"];
  return CHILD_TYPES[parentType] ?? [];
}

export async function listAdminJobLibraryNodes(input: {
  parentId?: string | null;
  search?: string;
  includeInactive?: boolean;
}) {
  await ensureJobLibrarySeeded();

  if (input.search?.trim()) {
    const rows = await prisma.jobLibraryNode.findMany({
      where: {
        deletedAt: null,
        ...(input.includeInactive ? {} : { isActive: true }),
        OR: [
          { name: { contains: input.search.trim(), mode: "insensitive" } },
          { code: { contains: input.search.trim(), mode: "insensitive" } },
          { referenceCode: { contains: input.search.trim(), mode: "insensitive" } },
        ],
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      take: 100,
      include: { _count: { select: { children: true } } },
    });
    return rows.map(mapAdminNode);
  }

  const rows = await prisma.jobLibraryNode.findMany({
    where: {
      parentId: input.parentId ?? null,
      deletedAt: null,
      ...(input.includeInactive ? {} : { isActive: true }),
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { children: true } } },
  });
  return rows.map(mapAdminNode);
}

export async function getAdminJobLibraryNode(id: string) {
  await ensureJobLibrarySeeded();
  const row = await prisma.jobLibraryNode.findFirst({
    where: { id, deletedAt: null },
    include: { _count: { select: { children: true } } },
  });
  return row ? mapAdminNode(row) : null;
}

export async function createAdminJobLibraryNode(input: {
  parentId?: string | null;
  nodeType: JobLibraryNodeType;
  code: string;
  name: string;
  description?: string | null;
  department?: string | null;
  workshop?: string | null;
  referenceCode?: string | null;
  defaultPriority?: DdJobPriority | null;
  estimatedManhours?: number | null;
  sortOrder?: number;
  isActive?: boolean;
}) {
  await ensureJobLibrarySeeded();

  if (input.parentId) {
    const parent = await prisma.jobLibraryNode.findFirst({
      where: { id: input.parentId, deletedAt: null },
    });
    if (!parent) return { ok: false as const, error: "Parent node not found", status: 404 };
    const allowed = allowedChildNodeTypes(parent.nodeType);
    if (!allowed.includes(input.nodeType)) {
      return {
        ok: false as const,
        error: `Cannot add ${input.nodeType} under ${parent.nodeType}`,
        status: 400,
      };
    }
  } else if (input.nodeType !== "department") {
    return { ok: false as const, error: "Root nodes must be departments", status: 400 };
  }

  const duplicate = await prisma.jobLibraryNode.findFirst({
    where: {
      parentId: input.parentId ?? null,
      code: input.code.trim(),
      deletedAt: null,
    },
  });
  if (duplicate) {
    return { ok: false as const, error: "Code already exists at this level", status: 409 };
  }

  const row = await prisma.jobLibraryNode.create({
    data: {
      parentId: input.parentId ?? null,
      nodeType: input.nodeType,
      code: input.code.trim(),
      name: input.name.trim(),
      description: input.description?.trim() || null,
      department: input.department?.trim() || null,
      workshop: input.workshop?.trim() || null,
      referenceCode: input.referenceCode?.trim() || null,
      defaultPriority: input.defaultPriority ?? null,
      estimatedManhours: input.estimatedManhours ?? null,
      sortOrder: input.sortOrder ?? 0,
      isActive: input.isActive ?? true,
      inputTemplate:
        input.nodeType === "standard_job" ? STANDARD_JOB_INPUT_TEMPLATE : undefined,
    },
    include: { _count: { select: { children: true } } },
  });

  return { ok: true as const, node: mapAdminNode(row) };
}

export async function updateAdminJobLibraryNode(
  id: string,
  input: Partial<{
    code: string;
    name: string;
    description: string | null;
    department: string | null;
    workshop: string | null;
    referenceCode: string | null;
    defaultPriority: DdJobPriority | null;
    estimatedManhours: number | null;
    sortOrder: number;
    isActive: boolean;
  }>,
) {
  const existing = await prisma.jobLibraryNode.findFirst({ where: { id, deletedAt: null } });
  if (!existing) return null;

  if (input.code && input.code.trim() !== existing.code) {
    const duplicate = await prisma.jobLibraryNode.findFirst({
      where: {
        parentId: existing.parentId,
        code: input.code.trim(),
        deletedAt: null,
        NOT: { id },
      },
    });
    if (duplicate) return null;
  }

  const row = await prisma.jobLibraryNode.update({
    where: { id },
    data: {
      ...(input.code != null ? { code: input.code.trim() } : {}),
      ...(input.name != null ? { name: input.name.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
      ...(input.department !== undefined ? { department: input.department?.trim() || null } : {}),
      ...(input.workshop !== undefined ? { workshop: input.workshop?.trim() || null } : {}),
      ...(input.referenceCode !== undefined
        ? { referenceCode: input.referenceCode?.trim() || null }
        : {}),
      ...(input.defaultPriority !== undefined ? { defaultPriority: input.defaultPriority } : {}),
      ...(input.estimatedManhours !== undefined ? { estimatedManhours: input.estimatedManhours } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
    include: { _count: { select: { children: true } } },
  });
  return mapAdminNode(row);
}

export async function softDeleteAdminJobLibraryNode(id: string) {
  const existing = await prisma.jobLibraryNode.findFirst({
    where: { id, ...notDeleted },
    include: { _count: { select: { children: true } } },
  });
  if (!existing) return false;
  if (existing._count.children > 0) return false;

  await prisma.jobLibraryNode.update({
    where: { id },
    data: { deletedAt: new Date(), isActive: false },
  });
  return true;
}

export async function getJobLibraryBreadcrumb(nodeId: string) {
  const path: JobLibraryNodeDto[] = [];
  let current = await getAdminJobLibraryNode(nodeId);
  while (current) {
    path.unshift(current);
    if (!current.parentId) break;
    current = await getAdminJobLibraryNode(current.parentId);
  }
  return path;
}
