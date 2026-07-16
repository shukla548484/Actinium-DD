/** Shared L1/L2 grouping for purchase budget tables */

export interface BudgetTypeLike {
  id: string;
  code: string;
  name: string;
  displayOrder: number;
  isActive?: boolean;
  level?: number;
  parentId?: string | null;
  parent?: { id: string; code: string; name: string } | null;
}

export interface GroupedBudgetTableRow {
  l1: BudgetTypeLike;
  l2: BudgetTypeLike;
  isFirstInL1Group: boolean;
  l1RowSpan: number;
}

export function getL2ChildrenForL1(
  l1: BudgetTypeLike,
  level2Types: BudgetTypeLike[]
): BudgetTypeLike[] {
  if (l1.id === "__orphan_l2__") {
    return level2Types
      .filter((t) => !t.parentId && !t.parent)
      .sort((a, b) => a.displayOrder - b.displayOrder || a.code.localeCompare(b.code));
  }
  return level2Types
    .filter((t) => t.parentId === l1.id || t.parent?.id === l1.id)
    .sort((a, b) => a.displayOrder - b.displayOrder || a.code.localeCompare(b.code));
}

export function buildL1Groups(
  level1Types: BudgetTypeLike[],
  level2Types: BudgetTypeLike[]
): BudgetTypeLike[] {
  const groups = [...level1Types]
    .filter((l1) => getL2ChildrenForL1(l1, level2Types).length > 0)
    .sort((a, b) => a.displayOrder - b.displayOrder || a.code.localeCompare(b.code));

  const orphans = level2Types.filter((t) => !t.parentId && !t.parent);
  if (orphans.length > 0) {
    groups.push({
      id: "__orphan_l2__",
      code: "—",
      name: "Other (no L1 parent)",
      displayOrder: 9999,
      isActive: true,
      level: 1,
      parentId: null,
      parent: null,
    });
  }
  return groups;
}

export function buildGroupedBudgetTableRows(
  level1Types: BudgetTypeLike[],
  level2Types: BudgetTypeLike[]
): GroupedBudgetTableRow[] {
  const rows: GroupedBudgetTableRow[] = [];
  for (const l1 of buildL1Groups(level1Types, level2Types)) {
    const children = getL2ChildrenForL1(l1, level2Types);
    children.forEach((l2, index) => {
      rows.push({
        l1,
        l2,
        isFirstInL1Group: index === 0,
        l1RowSpan: children.length,
      });
    });
  }
  return rows;
}
