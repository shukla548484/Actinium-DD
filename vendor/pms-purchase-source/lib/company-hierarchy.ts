import type { PrismaClient } from "@prisma/client";

/**
 * Resolve the master company root for a company and return all company IDs
 * under that hierarchy (master + direct sub-companies + nested sub-companies).
 */
export async function getMasterCompanyIds(
  prisma: PrismaClient,
  employeeCompanyId: string
): Promise<string[]> {
  const company = await prisma.company.findUnique({
    where: { id: employeeCompanyId },
    include: {
      parent: true,
      children: {
        include: {
          children: true,
        },
      },
    },
  });
  if (!company) return [];

  const root =
    company.type === "MASTER_COMPANY" ? company : (company.parent ?? company);
  const rootWithChildren =
    root.id === company.id
      ? company
      : await prisma.company.findUnique({
          where: { id: root.id },
          include: {
            children: {
              include: { children: true },
            },
          },
        });
  if (!rootWithChildren) return [employeeCompanyId];

  const allCompanyIds: string[] = [rootWithChildren.id];
  rootWithChildren.children.forEach((child: { id: string; children: { id: string }[] }) => {
    allCompanyIds.push(child.id);
    (child.children || []).forEach((grandchild: { id: string }) => allCompanyIds.push(grandchild.id));
  });
  return allCompanyIds;
}
