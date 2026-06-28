type MilestoneNode = {
  id: string;
  dependsOnMilestoneId: string | null;
};

/** Returns true if setting `milestoneId` to depend on `dependsOnId` would create a cycle. */
export function wouldCreateMilestoneCycle(
  milestoneId: string,
  dependsOnId: string | null,
  milestones: MilestoneNode[],
): boolean {
  if (!dependsOnId) return false;
  if (dependsOnId === milestoneId) return true;

  const byId = new Map(milestones.map((m) => [m.id, m]));
  let cursor: string | null = dependsOnId;
  const visited = new Set<string>();

  while (cursor) {
    if (cursor === milestoneId) return true;
    if (visited.has(cursor)) return true;
    visited.add(cursor);
    cursor = byId.get(cursor)?.dependsOnMilestoneId ?? null;
  }

  return false;
}
