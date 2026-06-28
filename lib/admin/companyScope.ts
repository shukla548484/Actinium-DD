import { prisma } from "@/lib/prisma";

/** Master company + all sub-companies under the same hierarchy (PMS pattern). */
export async function getMasterCompanyIds(employeeCompanyId: string): Promise<string[]> {
  const company = await prisma.company.findFirst({
    where: { id: employeeCompanyId, deletedAt: null },
    include: {
      parent: true,
      children: { include: { children: true } },
    },
  });
  if (!company) return [];

  const root =
    company.type === "MASTER" ? company : (company.parent ?? company);

  const rootWithChildren =
    root.id === company.id
      ? company
      : await prisma.company.findFirst({
          where: { id: root.id, deletedAt: null },
          include: {
            children: { include: { children: true } },
          },
        });

  if (!rootWithChildren) return [employeeCompanyId];

  const ids: string[] = [rootWithChildren.id];
  for (const child of rootWithChildren.children) {
    ids.push(child.id);
    for (const grandchild of child.children) {
      ids.push(grandchild.id);
    }
  }
  return ids;
}
