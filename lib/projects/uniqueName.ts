import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/superintendent/helpers";

export class DuplicateProjectNameError extends Error {
  constructor(name: string) {
    super(`A project named "${name}" already exists. Choose a unique name.`);
    this.name = "DuplicateProjectNameError";
  }
}

/** Active tender + dry-dock project names must be unique (case-insensitive). */
export async function assertUniqueProjectName(
  name: string,
  options?: { excludeProjectId?: string; excludeDryDockProjectId?: string },
): Promise<void> {
  const normalized = name.trim();
  if (!normalized) return;

  const [tender, dryDock] = await Promise.all([
    prisma.project.findFirst({
      where: {
        ...notDeleted,
        archivedAt: null,
        name: { equals: normalized, mode: "insensitive" },
        ...(options?.excludeProjectId ? { id: { not: options.excludeProjectId } } : {}),
      },
      select: { id: true },
    }),
    prisma.dryDockProject.findFirst({
      where: {
        ...notDeleted,
        archivedAt: null,
        name: { equals: normalized, mode: "insensitive" },
        ...(options?.excludeDryDockProjectId
          ? { id: { not: options.excludeDryDockProjectId } }
          : {}),
      },
      select: { id: true },
    }),
  ]);

  if (tender || dryDock) {
    throw new DuplicateProjectNameError(normalized);
  }
}
