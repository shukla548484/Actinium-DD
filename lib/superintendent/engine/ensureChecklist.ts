import type { DryDockProjectType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/superintendent/helpers";
import { getProjectTemplate } from "./projectTemplates";

/**
 * Adds any template checklist / document items missing from a project (matched by title).
 * Safe to call repeatedly — does not duplicate existing titles.
 */
export async function ensureProjectChecklistFromTemplate(input: {
  dryDockProjectId: string;
  projectType: DryDockProjectType;
}): Promise<{ added: number; titles: string[] }> {
  const template = getProjectTemplate(input.projectType);
  const desired = [
    ...template.checklist.map((item, index) => ({
      title: item.title,
      category: item.category ?? null,
      sortOrder: index,
    })),
    ...template.documents.map((item, index) => ({
      title: item.title,
      category: "Documents",
      sortOrder: 1000 + index,
    })),
  ];

  const existing = await prisma.ddChecklistItem.findMany({
    where: { dryDockProjectId: input.dryDockProjectId, ...notDeleted },
    select: { title: true },
  });
  const existingTitles = new Set(existing.map((row) => row.title.trim().toLowerCase()));

  const missing = desired.filter((item) => !existingTitles.has(item.title.trim().toLowerCase()));
  if (missing.length === 0) {
    return { added: 0, titles: [] };
  }

  await prisma.ddChecklistItem.createMany({
    data: missing.map((item) => ({
      dryDockProjectId: input.dryDockProjectId,
      title: item.title,
      category: item.category,
      sortOrder: item.sortOrder,
    })),
  });

  return { added: missing.length, titles: missing.map((item) => item.title) };
}
