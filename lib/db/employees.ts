import type { EntityStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatEmployeeCode } from "@/lib/admin/codes";
import { getMasterCompanyIds } from "@/lib/admin/companyScope";
import { DEFAULT_EMPLOYEE_PASSWORD } from "@/lib/auth/constants";
import { hashPassword } from "@/lib/auth/password";
import { getDesignationByLabel } from "@/lib/admin/designations";
import { employeeToExportRow, type ParsedEmployeeImportRow } from "@/lib/admin/employeeExcel";
import type { EmployeeDto, ListQuery } from "@/lib/admin/types";
import { updateEmployeeUserProfile } from "@/lib/db/employeeAuth";
import { getRoleByCode } from "@/lib/db/rbac";

const notDeleted = { deletedAt: null };

function tombstoneEmail(recordId: string, originalEmail: string) {
  const localPart = originalEmail.split("@")[0]?.slice(0, 24) ?? "user";
  return `deleted.${recordId}.${Date.now()}.${localPart}@removed.actinium-dd.local`;
}

function tombstoneLoginId(userId: string, loginId: string) {
  return `deleted.${userId}.${Date.now()}.${loginId}`.slice(0, 120);
}

/** Clear unique fields on soft-deleted rows so email/login ids can be reused. */
export async function releaseEmployeeUniqueFields(employeeId: string) {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId },
    select: {
      id: true,
      email: true,
      vesselLoginId: true,
      userId: true,
      user: { select: { id: true, email: true, loginId: true } },
    },
  });
  if (!employee) return;

  const nextEmployeeEmail = tombstoneEmail(employee.id, employee.email);

  await prisma.$transaction(async (tx) => {
    await tx.employee.update({
      where: { id: employee.id },
      data: {
        email: nextEmployeeEmail,
        vesselLoginId: null,
      },
    });

    if (employee.userId && employee.user) {
      await tx.user.update({
        where: { id: employee.userId },
        data: {
          email: tombstoneEmail(employee.user.id, employee.user.email),
          ...(employee.user.loginId
            ? { loginId: tombstoneLoginId(employee.user.id, employee.user.loginId) }
            : {}),
        },
      });
    }
  });
}

async function assertEmailAvailable(email: string, excludeEmployeeId?: string) {
  const existing = await prisma.employee.findFirst({
    where: {
      email: email.toLowerCase(),
      ...(excludeEmployeeId ? { id: { not: excludeEmployeeId } } : {}),
      ...notDeleted,
    },
    select: { id: true },
  });
  if (existing) {
    throw new Error("An employee with this email is already registered");
  }
}

/** Release legacy soft-deleted emails, then verify the address is free for a new employee. */
export async function prepareEmailForRegistration(email: string, excludeEmployeeId?: string) {
  const normalized = email.trim().toLowerCase();
  const softDeleted = await prisma.employee.findMany({
    where: {
      email: normalized,
      deletedAt: { not: null },
      ...(excludeEmployeeId ? { id: { not: excludeEmployeeId } } : {}),
    },
    select: { id: true },
  });

  for (const row of softDeleted) {
    await releaseEmployeeUniqueFields(row.id);
  }

  await assertEmailAvailable(normalized, excludeEmployeeId);
}

function mapEmployee(row: {
  id: string;
  companyId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  designation: string | null;
  department: string | null;
  status: EntityStatus;
  roleId: string | null;
  userId: string | null;
  vesselLoginId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  company?: { name: string } | null;
  role?: { name: string; code?: string | null; roleNo?: number | null; approvalLevel?: number | null } | null;
  user?: { loginId: string | null } | null;
  _count?: { vesselAssignments: number };
  vesselAssignments?: {
    isWatchKeeper: boolean;
    vessel: { id: string; code: string; name: string };
  }[];
}): EmployeeDto {
  return {
    id: row.id,
    companyId: row.companyId,
    companyName: row.company?.name,
    employeeCode: row.employeeCode,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone,
    designation: row.designation,
    department: row.department,
    status: row.status,
    roleId: row.roleId,
    roleName: row.role?.name ?? null,
    roleNo: row.role?.roleNo ?? null,
    roleCode: row.role?.code ?? null,
    approvalLevel: row.role?.approvalLevel ?? null,
    userId: row.userId,
    loginId: row.user?.loginId ?? row.employeeCode,
    vesselLoginId: row.vesselLoginId ?? null,
    vesselCount: row._count?.vesselAssignments,
    vessels: row.vesselAssignments?.map((a) => ({
      id: a.vessel.id,
      code: a.vessel.code,
      name: a.vessel.name,
      isWatchKeeper: a.isWatchKeeper,
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listEmployees(query: ListQuery = {}) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));
  const skip = (page - 1) * limit;

  const where: Prisma.EmployeeWhereInput = { ...notDeleted };
  if (query.companyId) where.companyId = query.companyId;
  if (query.search) {
    where.OR = [
      { firstName: { contains: query.search, mode: "insensitive" } },
      { lastName: { contains: query.search, mode: "insensitive" } },
      { email: { contains: query.search, mode: "insensitive" } },
      { employeeCode: { contains: query.search, mode: "insensitive" } },
    ];
  }
  if (query.status && query.status !== "all") {
    where.status = query.status;
  }
  if (query.userType) {
    where.role = { userType: query.userType };
  }

  const [total, rows] = await Promise.all([
    prisma.employee.count({ where }),
    prisma.employee.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      include: {
        company: { select: { name: true } },
        role: { select: { name: true, code: true, roleNo: true, approvalLevel: true } },
        user: { select: { loginId: true } },
        _count: { select: { vesselAssignments: true } },
      },
    }),
  ]);

  return {
    employees: rows.map(mapEmployee),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function listEmployeesForExport(companyId?: string) {
  const where: Prisma.EmployeeWhereInput = { ...notDeleted };
  if (companyId) where.companyId = companyId;

  const rows = await prisma.employee.findMany({
    where,
    orderBy: [{ company: { name: "asc" } }, { lastName: "asc" }, { firstName: "asc" }],
    include: {
      company: { select: { name: true, code: true } },
    },
  });

  return rows.map((row) => employeeToExportRow(row));
}

async function resolveCompanyIdByName(name: string): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const company = await prisma.company.findFirst({
    where: {
      ...notDeleted,
      OR: [
        { name: { equals: trimmed, mode: "insensitive" } },
        { code: { equals: trimmed, mode: "insensitive" } },
      ],
    },
    select: { id: true },
  });
  return company?.id ?? null;
}

export async function importEmployees(rows: ParsedEmployeeImportRow[]) {
  const errors: { row: number; message: string }[] = [];
  const imported: string[] = [];
  const seenEmails = new Set<string>();

  for (const row of rows) {
    const emailKey = row.email.toLowerCase();
    if (seenEmails.has(emailKey)) {
      errors.push({ row: row.rowNumber, message: "Duplicate email in upload file" });
      continue;
    }
    seenEmails.add(emailKey);

    const companyId = await resolveCompanyIdByName(row.companyName);
    if (!companyId) {
      errors.push({
        row: row.rowNumber,
        message: `Company "${row.companyName}" not found`,
      });
      continue;
    }

    try {
      const employee = await createEmployee({
        companyId,
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        phone: row.phone,
        designation: row.designation,
        department: row.department,
        status: row.status,
      });
      imported.push(employee.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to create employee";
      errors.push({ row: row.rowNumber, message: msg });
    }
  }

  return {
    imported: imported.length,
    skipped: errors.length,
    employeeIds: imported,
    errors,
  };
}

export async function getEmployee(id: string) {
  const row = await prisma.employee.findFirst({
    where: { id, ...notDeleted },
    include: {
      company: { select: { id: true, name: true, code: true } },
      role: { select: { id: true, name: true, code: true, roleNo: true, approvalLevel: true } },
      user: { select: { id: true, loginId: true } },
      _count: { select: { vesselAssignments: true } },
      vesselAssignments: {
        include: {
          vessel: {
            select: { id: true, code: true, name: true, status: true },
          },
        },
        orderBy: { assignedAt: "desc" },
      },
    },
  });
  if (!row) return null;
  return {
    ...mapEmployee(row),
    company: row.company,
    role: row.role,
    vesselAssignments: row.vesselAssignments.map((a) => ({
      id: a.id,
      vesselId: a.vessel.id,
      vesselCode: a.vessel.code,
      vesselName: a.vessel.name,
      vesselStatus: a.vessel.status,
      isWatchKeeper: a.isWatchKeeper,
      assignedAt: a.assignedAt.toISOString(),
    })),
  };
}

async function resolveRoleIdFromDesignation(
  designation: string | null | undefined,
): Promise<string | null> {
  if (!designation) return null;
  const seed = getDesignationByLabel(designation);
  if (!seed) return null;
  const role = await getRoleByCode(seed.roleCode);
  return role?.id ?? null;
}

async function nextEmployeeCode(companyId: string): Promise<string> {
  const company = await prisma.company.findFirst({
    where: { id: companyId, ...notDeleted },
    select: { code: true },
  });
  if (!company) throw new Error("Company not found");

  const count = await prisma.employee.count({
    where: { companyId },
  });
  let seq = count + 1;
  let code = formatEmployeeCode(company.code, seq);
  while (await prisma.employee.findFirst({ where: { employeeCode: code } })) {
    seq++;
    code = formatEmployeeCode(company.code, seq);
  }
  return code;
}

export async function createEmployee(input: {
  companyId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  designation: string;
  department?: string | null;
  status?: EntityStatus;
}) {
  await prepareEmailForRegistration(input.email);
  const roleId = await resolveRoleIdFromDesignation(input.designation);
  const employeeCode = await nextEmployeeCode(input.companyId);

  const row = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        loginId: employeeCode,
        email: input.email.trim().toLowerCase(),
        displayName: `${input.firstName.trim()} ${input.lastName.trim()}`,
        passwordHash: hashPassword(DEFAULT_EMPLOYEE_PASSWORD),
        status: "active",
        ...(roleId
          ? {
              userRoles: {
                create: {
                  roleId,
                  scopeType: "organization",
                  scopeId: input.companyId,
                },
              },
            }
          : {}),
      },
    });

    return tx.employee.create({
      data: {
        companyId: input.companyId,
        employeeCode,
        firstName: input.firstName.trim(),
        lastName: input.lastName.trim(),
        email: input.email.trim().toLowerCase(),
        phone: input.phone.trim(),
        designation: input.designation.trim(),
        department: input.department?.trim() || null,
        roleId,
        userId: user.id,
        status: input.status ?? "wait",
      },
      include: {
        company: { select: { name: true } },
        role: { select: { name: true, code: true, roleNo: true, approvalLevel: true } },
        user: { select: { loginId: true } },
        _count: { select: { vesselAssignments: true } },
      },
    });
  });

  return mapEmployee(row);
}

export async function updateEmployee(
  id: string,
  input: Partial<{
    companyId: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    designation: string;
    department: string | null;
    status: EntityStatus;
  }>,
) {
  if (input.email != null) {
    await prepareEmailForRegistration(input.email, id);
  }

  let roleId: string | null | undefined;
  if (input.designation !== undefined) {
    roleId = await resolveRoleIdFromDesignation(input.designation);
  }

  const existing = await prisma.employee.findFirst({
    where: { id, ...notDeleted },
    select: { userId: true, companyId: true },
  });

  const row = await prisma.employee.update({
    where: { id },
    data: {
      ...(input.companyId != null ? { companyId: input.companyId } : {}),
      ...(input.firstName != null ? { firstName: input.firstName.trim() } : {}),
      ...(input.lastName != null ? { lastName: input.lastName.trim() } : {}),
      ...(input.email != null ? { email: input.email.trim().toLowerCase() } : {}),
      ...(input.phone !== undefined ? { phone: input.phone.trim() } : {}),
      ...(input.designation !== undefined
        ? { designation: input.designation.trim() }
        : {}),
      ...(input.department !== undefined ? { department: input.department?.trim() || null } : {}),
      ...(roleId !== undefined ? { roleId } : {}),
      ...(input.status != null ? { status: input.status } : {}),
    },
    include: {
      company: { select: { name: true } },
      role: { select: { name: true } },
      user: { select: { loginId: true } },
      _count: { select: { vesselAssignments: true } },
    },
  });

  if (existing?.userId) {
    await updateEmployeeUserProfile(existing.userId, {
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      roleId: roleId !== undefined ? roleId : undefined,
      companyId: input.companyId ?? existing.companyId,
      employeeStatus: input.status,
    });
  }

  return mapEmployee(row);
}

export async function setEmployeeStatus(id: string, status: EntityStatus) {
  return updateEmployee(id, { status });
}

export async function deleteEmployee(id: string) {
  const employee = await prisma.employee.findFirst({
    where: { id, ...notDeleted },
    select: { id: true, userId: true },
  });
  if (!employee) return;

  await releaseEmployeeUniqueFields(id);
  await prisma.employee.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  if (employee.userId) {
    await prisma.user.update({
      where: { id: employee.userId },
      data: { deletedAt: new Date(), status: "disabled" },
    });
  }
}

export async function getAssignVesselsData(employeeId: string) {
  const employee = await getEmployee(employeeId);
  if (!employee) return null;

  const companyIds = await getMasterCompanyIds(employee.companyId);
  const availableVessels = await prisma.vessel.findMany({
    where: {
      companyId: { in: companyIds },
      status: "active",
      ...notDeleted,
    },
    include: { company: { select: { id: true, name: true, code: true } } },
    orderBy: [{ company: { name: "asc" } }, { name: "asc" }],
  });

  const assignedIds = new Set(
    (employee.vesselAssignments ?? []).map((a) => a.vesselId),
  );

  return {
    employee,
    availableVessels: availableVessels.map((v) => ({
      id: v.id,
      code: v.code,
      name: v.name,
      companyId: v.companyId,
      companyName: v.company.name,
      companyCode: v.company.code,
      assigned: assignedIds.has(v.id),
    })),
    assignedVesselIds: [...assignedIds],
  };
}

export async function assignVesselsToEmployee(
  employeeId: string,
  vesselIds: string[],
  watchKeeperVesselIds: string[] = [],
) {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, ...notDeleted },
  });
  if (!employee) return null;

  if (vesselIds.length === 0) {
    throw new Error("At least one vessel must be selected");
  }

  const companyIds = await getMasterCompanyIds(employee.companyId);
  const vessels = await prisma.vessel.findMany({
    where: {
      id: { in: vesselIds },
      companyId: { in: companyIds },
      status: "active",
      ...notDeleted,
    },
  });

  if (vessels.length !== vesselIds.length) {
    throw new Error("One or more vessels are invalid or inactive");
  }

  const watchSet = new Set(watchKeeperVesselIds);

  await prisma.$transaction([
    prisma.employeeVessel.deleteMany({ where: { employeeId } }),
    prisma.employeeVessel.createMany({
      data: vesselIds.map((vesselId) => ({
        employeeId,
        vesselId,
        isWatchKeeper: watchSet.has(vesselId),
      })),
    }),
    prisma.employee.update({
      where: { id: employeeId },
      data: { status: "active" },
    }),
  ]);

  return getEmployee(employeeId);
}
