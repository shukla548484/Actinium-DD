import prisma from "@/lib/prisma";

type RecipientPolicyInput = {
  moduleNames?: string[];
  accessLevels?: number[];
  minAccessLevel?: number;
  vesselId?: string | null;
  companyId?: string | null;
  excludeUserIds?: string[];
};

function moduleNameFilter(moduleNames: string[]) {
  const names = moduleNames.map((m) => m.trim()).filter(Boolean);
  if (!names.length) return undefined;
  return {
    assignedModules: {
      some: {
        module: {
          OR: names.map((name) => ({ name: { equals: name, mode: "insensitive" as const } })),
        },
      },
    },
  };
}

function vesselFilter(vesselId?: string | null) {
  if (!vesselId) return undefined;
  return {
    assignedVessels: {
      some: {
        vesselId,
        OR: [{ signOffDate: null }, { signOffDate: { gt: new Date() } }],
      },
    },
  };
}

export async function getNotificationRecipientUsers(input: RecipientPolicyInput): Promise<Array<{ id: string; email: string | null }>> {
  // Shore approvers are assigned per vessel; employee.companyId often differs from vessel.companyId.
  // When vesselId is set, vessel assignment is the scope gate — do not also require companyId match.
  const applyCompanyFilter = Boolean(input.companyId) && !input.vesselId;

  const where: any = {
    isActive: true,
    ...(applyCompanyFilter ? { companyId: input.companyId } : {}),
    ...(input.accessLevels?.length ? { designationAccessLevel: { in: input.accessLevels } } : {}),
    ...(typeof input.minAccessLevel === "number"
      ? { designationAccessLevel: { gte: input.minAccessLevel } }
      : {}),
    ...(input.excludeUserIds?.length ? { id: { notIn: input.excludeUserIds } } : {}),
    ...moduleNameFilter(input.moduleNames ?? []),
    ...vesselFilter(input.vesselId),
  };

  let users = await prisma.employee.findMany({
    where,
    select: { id: true, email: true },
  });

  // Shore invoice/PO verifiers are often company-wide (not on vessel crew lists).
  if (users.length === 0 && input.vesselId && input.accessLevels?.length) {
    let scopedCompanyId = input.companyId ?? null;
    if (!scopedCompanyId) {
      const vessel = await prisma.vessel.findUnique({
        where: { id: input.vesselId },
        select: { companyId: true },
      });
      scopedCompanyId = vessel?.companyId ?? null;
    }
    users = await prisma.employee.findMany({
      where: {
        isActive: true,
        ...(scopedCompanyId ? { companyId: scopedCompanyId } : {}),
        designationAccessLevel: { in: input.accessLevels },
        ...(input.excludeUserIds?.length ? { id: { notIn: input.excludeUserIds } } : {}),
        ...moduleNameFilter(input.moduleNames ?? []),
      },
      select: { id: true, email: true },
    });
  }

  // Admins (50) and company-wide roles may lack vessel rows — include them when tier lists level 50.
  if (
    users.length === 0 &&
    input.vesselId &&
    input.accessLevels?.includes(50)
  ) {
    users = await prisma.employee.findMany({
      where: {
        isActive: true,
        designationAccessLevel: 50,
        ...(input.excludeUserIds?.length ? { id: { notIn: input.excludeUserIds } } : {}),
        ...moduleNameFilter(input.moduleNames ?? []),
      },
      select: { id: true, email: true },
    });
  }

  return users;
}

export async function getNotificationRecipientIds(input: RecipientPolicyInput): Promise<string[]> {
  const users = await getNotificationRecipientUsers(input);
  return users.map((u) => u.id);
}
