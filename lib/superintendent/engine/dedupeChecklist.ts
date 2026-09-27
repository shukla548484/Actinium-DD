import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/superintendent/helpers";

function normalizeKey(title: string, category: string | null | undefined): string {
  return `${title.trim().toLowerCase()}|${(category ?? "").trim().toLowerCase()}`;
}

function completenessScore(item: {
  isCompleted: boolean;
  completedAt: Date | null;
  dueDate: Date | null;
  assignedTo: string | null;
  notes: string | null;
  classStatusAnalysis: unknown;
  attachmentCount: number;
}): number {
  let score = 0;
  if (item.isCompleted) score += 100;
  if (item.completedAt) score += 10;
  if (item.classStatusAnalysis != null) score += 50;
  if (item.notes?.trim()) score += 5;
  if (item.assignedTo?.trim()) score += 5;
  if (item.dueDate) score += 5;
  score += item.attachmentCount * 10;
  return score;
}

export type DedupeChecklistResult = {
  removed: number;
  keptIds: string[];
  removedIds: string[];
};

/**
 * Soft-deletes duplicate checklist rows within a single dry dock project
 * (same title + category, case-insensitive). Keeps the most complete /
 * completed record; ties prefer the oldest row.
 */
export async function dedupeProjectChecklistItems(
  dryDockProjectId: string,
): Promise<DedupeChecklistResult> {
  const rows = await prisma.ddChecklistItem.findMany({
    where: { dryDockProjectId, ...notDeleted },
    select: {
      id: true,
      title: true,
      category: true,
      isCompleted: true,
      completedAt: true,
      dueDate: true,
      assignedTo: true,
      notes: true,
      classStatusAnalysis: true,
      createdAt: true,
      _count: { select: { attachments: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = normalizeKey(row.title, row.category);
    const list = groups.get(key);
    if (list) list.push(row);
    else groups.set(key, [row]);
  }

  const toRemove: string[] = [];
  const keptIds: string[] = [];

  for (const group of groups.values()) {
    if (group.length === 1) {
      keptIds.push(group[0]!.id);
      continue;
    }

    const ranked = [...group].sort((a, b) => {
      const scoreDiff =
        completenessScore({ ...b, attachmentCount: b._count.attachments }) -
        completenessScore({ ...a, attachmentCount: a._count.attachments });
      if (scoreDiff !== 0) return scoreDiff;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    const winner = ranked[0]!;
    keptIds.push(winner.id);
    for (const loser of ranked.slice(1)) {
      toRemove.push(loser.id);
    }
  }

  if (toRemove.length > 0) {
    await prisma.ddChecklistItem.updateMany({
      where: { id: { in: toRemove }, dryDockProjectId },
      data: { deletedAt: new Date() },
    });
  }

  return { removed: toRemove.length, keptIds, removedIds: toRemove };
}

/**
 * Soft-deletes within-project title+category duplicates across all active projects.
 */
export async function dedupeAllProjectChecklistItems(): Promise<{
  projectsTouched: number;
  removed: number;
}> {
  const projects = await prisma.dryDockProject.findMany({
    where: { ...notDeleted, archivedAt: null },
    select: { id: true },
  });

  let projectsTouched = 0;
  let removed = 0;
  for (const project of projects) {
    const result = await dedupeProjectChecklistItems(project.id);
    if (result.removed > 0) {
      projectsTouched += 1;
      removed += result.removed;
    }
  }

  return { projectsTouched, removed };
}
