import { prisma } from "@/lib/prisma";
import { mapProjectCategory } from "@/lib/db/mappers";
import {
  STANDARD_DOCKING_CATEGORIES,
  formatCategoryNo,
  nextCategoryNumber,
  slugifyCategoryName,
} from "@/lib/tender/categories";
import type { ProjectCategory } from "@/lib/tender/types";
import type { SyncOriginNode } from "@/lib/sync/constants";
import { nanoid } from "nanoid";

const notDeleted = { deletedAt: null };

export async function listProjectCategories(projectId: string): Promise<ProjectCategory[]> {
  const rows = await prisma.projectCategory.findMany({
    where: { projectId, ...notDeleted },
    orderBy: { sortOrder: "asc" },
  });
  return rows.map(mapProjectCategory);
}

export async function seedStandardCategories(
  projectId: string,
  originNode: SyncOriginNode = "office",
): Promise<void> {
  const existing = await prisma.projectCategory.count({
    where: { projectId, ...notDeleted },
  });
  if (existing > 0) return;

  const now = new Date();
  await prisma.projectCategory.createMany({
    data: STANDARD_DOCKING_CATEGORIES.map((cat, index) => ({
      id: nanoid(),
      projectId,
      categoryNo: cat.categoryNo,
      slug: cat.slug,
      name: cat.name,
      shortcut: cat.shortcut,
      sortOrder: index,
      isSystem: true,
      originNode,
      officeChangedAt: now,
    })),
  });
}

export async function ensureProjectCategories(projectId: string): Promise<ProjectCategory[]> {
  await seedStandardCategories(projectId);
  return listProjectCategories(projectId);
}

export async function createProjectCategory(input: {
  projectId: string;
  name: string;
  shortcut?: string;
}): Promise<ProjectCategory> {
  const existing = await listProjectCategories(input.projectId);
  const categoryNo = nextCategoryNumber(existing.map((c) => c.categoryNo));
  const baseSlug = slugifyCategoryName(input.name) || "custom";
  let slug = baseSlug;
  let n = 1;
  while (existing.some((c) => c.slug === slug)) {
    slug = `${baseSlug}_${n++}`;
  }

  const usedShortcuts = new Set(existing.map((c) => c.shortcut.toUpperCase()));
  let shortcut = (input.shortcut ?? categoryNo).trim().toUpperCase().slice(0, 8);
  if (!shortcut || usedShortcuts.has(shortcut)) {
    shortcut = categoryNo;
    while (usedShortcuts.has(shortcut)) {
      shortcut = `${categoryNo}${n++}`;
    }
  }

  const sortOrder =
    existing.length > 0 ? Math.max(...existing.map((c) => c.sortOrder)) + 1 : 0;

  const row = await prisma.projectCategory.create({
    data: {
      projectId: input.projectId,
      categoryNo,
      slug,
      name: input.name.trim(),
      shortcut,
      sortOrder,
      isSystem: false,
      originNode: "office",
      officeChangedAt: new Date(),
    },
  });
  return mapProjectCategory(row);
}

export async function updateProjectCategory(
  projectId: string,
  categoryId: string,
  patch: { name?: string; shortcut?: string },
): Promise<ProjectCategory | null> {
  const row = await prisma.projectCategory.findFirst({
    where: { id: categoryId, projectId, ...notDeleted },
  });
  if (!row) return null;

  if (patch.shortcut) {
    const shortcut = patch.shortcut.trim().toUpperCase().slice(0, 8);
    const conflict = await prisma.projectCategory.findFirst({
      where: {
        projectId,
        shortcut,
        id: { not: categoryId },
        ...notDeleted,
      },
    });
    if (conflict) {
      throw new Error(`Shortcut "${shortcut}" is already used by another category.`);
    }
  }

  const updated = await prisma.projectCategory.update({
    where: { id: categoryId },
    data: {
      ...(patch.name != null ? { name: patch.name.trim() } : {}),
      ...(patch.shortcut != null
        ? { shortcut: patch.shortcut.trim().toUpperCase().slice(0, 8) }
        : {}),
      officeChangedAt: new Date(),
    },
  });
  return mapProjectCategory(updated);
}

export async function deleteProjectCategory(
  projectId: string,
  categoryId: string,
): Promise<boolean> {
  const row = await prisma.projectCategory.findFirst({
    where: { id: categoryId, projectId, ...notDeleted },
  });
  if (!row || row.isSystem) return false;

  const now = new Date();
  await prisma.$transaction([
    prisma.projectCategory.update({
      where: { id: categoryId },
      data: { deletedAt: now, officeChangedAt: now },
    }),
    prisma.specLine.updateMany({
      where: { projectId, bucket: row.slug, ...notDeleted },
      data: { bucket: "miscellaneous", officeChangedAt: now },
    }),
  ]);
  return true;
}

export function categoryByShortcut(
  categories: ProjectCategory[],
  shortcut: string,
): ProjectCategory | undefined {
  const key = shortcut.trim().toUpperCase();
  return categories.find((c) => c.shortcut.toUpperCase() === key);
}

export function categoryBySlug(
  categories: ProjectCategory[],
  slug: string,
): ProjectCategory | undefined {
  return categories.find((c) => c.slug === slug);
}
