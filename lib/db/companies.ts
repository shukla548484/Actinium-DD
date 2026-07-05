import type { CompanyCategory, CompanyType, EntityStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateCompanyCode } from "@/lib/admin/codes";
import { isShipownerCategory } from "@/lib/admin/companyCategory";
import type { CompanyDto, ListQuery } from "@/lib/admin/types";

const notDeleted = { deletedAt: null };

function mapCompany(
  row: Prisma.CompanyGetPayload<{
    include: { parent: { select: { name: true } }; _count: { select: { vessels: true; employees: true } } };
  }>,
): CompanyDto {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    type: row.type,
    category: row.category,
    status: row.status,
    parentId: row.parentId,
    parentName: row.parent?.name ?? null,
    address: row.address,
    contactPerson: row.contactPerson,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    isShipowner: row.isShipowner,
    vesselCount: row._count?.vessels,
    employeeCount: row._count?.employees,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listCompanies(query: ListQuery = {}) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));
  const skip = (page - 1) * limit;

  const where: Prisma.CompanyWhereInput = { ...notDeleted };
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      { code: { contains: query.search, mode: "insensitive" } },
    ];
  }
  if (query.status && query.status !== "all") {
    where.status = query.status;
  }
  if (query.category) {
    where.category = query.category;
  }
  if (query.excludeCategories?.length) {
    where.category = { notIn: query.excludeCategories };
  }

  const [total, rows] = await Promise.all([
    prisma.company.count({ where }),
    prisma.company.findMany({
      where,
      skip,
      take: limit,
      orderBy: { name: "asc" },
      include: {
        parent: { select: { name: true } },
        _count: { select: { vessels: true, employees: true } },
      },
    }),
  ]);

  return {
    companies: rows.map(mapCompany),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getCompany(id: string) {
  const row = await prisma.company.findFirst({
    where: { id, ...notDeleted },
    include: {
      parent: { select: { id: true, name: true, code: true } },
      _count: { select: { vessels: true, employees: true, children: true } },
    },
  });
  if (!row) return null;
  return {
    ...mapCompany(row as Parameters<typeof mapCompany>[0]),
    parent: row.parent,
    childCount: row._count.children,
  };
}

async function uniqueCompanyCode(base: string): Promise<string> {
  let code = base;
  let n = 1;
  while (await prisma.company.findFirst({ where: { code, ...notDeleted } })) {
    code = `${base.slice(0, 2)}${n}`.toUpperCase();
    n++;
  }
  return code;
}

export async function createCompany(input: {
  name: string;
  category: CompanyCategory;
  type?: CompanyType;
  parentId?: string | null;
  address?: string | null;
  contactPerson?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  status?: EntityStatus;
}) {
  const code = await uniqueCompanyCode(generateCompanyCode(input.name));
  const row = await prisma.company.create({
    data: {
      code,
      name: input.name.trim(),
      category: input.category,
      type: input.type ?? "MASTER",
      parentId: input.parentId || null,
      address: input.address?.trim() || null,
      contactPerson: input.contactPerson?.trim() || null,
      contactEmail: input.contactEmail?.trim() || null,
      contactPhone: input.contactPhone?.trim() || null,
      isShipowner: isShipownerCategory(input.category),
      status: input.status ?? "wait",
    },
    include: {
      parent: { select: { name: true } },
      _count: { select: { vessels: true, employees: true } },
    },
  });
  return mapCompany(row);
}

export async function updateCompany(
  id: string,
  input: Partial<{
    name: string;
    category: CompanyCategory;
    type: CompanyType;
    parentId: string | null;
    address: string | null;
    contactPerson: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    status: EntityStatus;
  }>,
) {
  const row = await prisma.company.update({
    where: { id },
    data: {
      ...(input.name != null ? { name: input.name.trim() } : {}),
      ...(input.category != null
        ? { category: input.category, isShipowner: isShipownerCategory(input.category) }
        : {}),
      ...(input.type != null ? { type: input.type } : {}),
      ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
      ...(input.address !== undefined ? { address: input.address?.trim() || null } : {}),
      ...(input.contactPerson !== undefined
        ? { contactPerson: input.contactPerson?.trim() || null }
        : {}),
      ...(input.contactEmail !== undefined
        ? { contactEmail: input.contactEmail?.trim() || null }
        : {}),
      ...(input.contactPhone !== undefined
        ? { contactPhone: input.contactPhone?.trim() || null }
        : {}),
      ...(input.status != null ? { status: input.status } : {}),
    },
    include: {
      parent: { select: { name: true } },
      _count: { select: { vessels: true, employees: true } },
    },
  });
  return mapCompany(row);
}

export async function setCompanyStatus(id: string, status: EntityStatus) {
  return updateCompany(id, { status });
}

export async function deleteCompany(id: string) {
  await prisma.company.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

export async function listCompaniesForSelect(activeOnly = true) {
  return prisma.company.findMany({
    where: {
      ...notDeleted,
      ...(activeOnly ? { status: "active" } : {}),
    },
    orderBy: { name: "asc" },
    select: { id: true, code: true, name: true, type: true, status: true },
  });
}
