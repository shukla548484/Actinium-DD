"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableSerialHead, TableSerialCell } from "@/components/ui/table-serial-column";

export interface BudgetEntryForGrouping {
  id: string;
  monthlyAmount?: number;
  yearlyAmount?: number;
  budgetType?: {
    code: string;
    name: string;
    parent?: { code: string; name: string } | null;
  } | null;
}

export interface GroupedBudgetEntryRow<T extends BudgetEntryForGrouping> {
  l1Name: string;
  l1Code: string;
  l2Name: string;
  l2Code: string;
  entry: T;
  isFirstInL1Group: boolean;
  l1RowSpan: number;
}

export function buildGroupedBudgetEntryRows<T extends BudgetEntryForGrouping>(
  entries: T[]
): GroupedBudgetEntryRow<T>[] {
  const byL1 = new Map<
    string,
    { l1Name: string; l1Code: string; items: T[] }
  >();

  for (const entry of entries) {
    const bt = entry.budgetType;
    const parent = bt?.parent;
    const l1Code = parent?.code ?? "—";
    const l1Name = parent?.name ?? "Uncategorized";
    const key = parent ? `${parent.code}\0${parent.name}` : `__orphan__\0${bt?.id ?? entry.id}`;

    if (!byL1.has(key)) {
      byL1.set(key, { l1Name, l1Code, items: [] });
    }
    byL1.get(key)!.items.push(entry);
  }

  const groups = [...byL1.values()].sort((a, b) =>
    a.l1Code.localeCompare(b.l1Code, undefined, { numeric: true })
  );

  const rows: GroupedBudgetEntryRow<T>[] = [];
  for (const group of groups) {
    const sorted = group.items.sort((a, b) =>
      (a.budgetType?.code ?? "").localeCompare(b.budgetType?.code ?? "", undefined, {
        numeric: true,
      })
    );
    sorted.forEach((entry, index) => {
      rows.push({
        l1Name: group.l1Name,
        l1Code: group.l1Code,
        l2Name: entry.budgetType?.name ?? "—",
        l2Code: entry.budgetType?.code ?? "—",
        entry,
        isFirstInL1Group: index === 0,
        l1RowSpan: sorted.length,
      });
    });
  }
  return rows;
}

interface BudgetGroupedEntryTableProps<T extends BudgetEntryForGrouping> {
  entries: T[];
  renderAllotted: (entry: T) => ReactNode;
  renderExtraColumns?: (entry: T) => ReactNode;
  extraHeads?: ReactNode;
  allottedHead?: string;
  /** Tighter columns and no horizontal scroll wrapper (define tab wide table). */
  compact?: boolean;
  /** Show monthly / quarterly / yearly derived from stored amounts. */
  showDerivedPeriodAmounts?: boolean;
  formatDerivedAmount?: (entry: T, kind: "monthly" | "quarterly" | "yearly") => ReactNode;
}

export function BudgetGroupedEntryTable<T extends BudgetEntryForGrouping>({
  entries,
  renderAllotted,
  renderExtraColumns,
  extraHeads,
  allottedHead = "Allocated budget",
  compact = false,
  showDerivedPeriodAmounts = false,
  formatDerivedAmount,
}: BudgetGroupedEntryTableProps<T>) {
  const grouped = buildGroupedBudgetEntryRows(entries);

  const l1Min = compact ? "min-w-[120px]" : "min-w-[180px]";
  const l2Min = compact ? "min-w-[120px]" : "min-w-[180px]";

  return (
    <div
      className={cn(
        "rounded-lg border",
        compact ? "overflow-x-visible" : "overflow-x-auto"
      )}
    >
      <Table className={cn("border-collapse w-full", compact && "text-sm")}>
        <TableHeader>
          <TableRow className="bg-muted/60 hover:bg-muted/60">
                      <TableSerialHead />
            <TableHead className={cn("border-r", l1Min)}>L1 Budget ID</TableHead>
            <TableHead className="border-r w-[88px] text-center">L1 Code</TableHead>
            <TableHead className={cn("border-r", l2Min)}>L2 Budget ID</TableHead>
            <TableHead className="border-r w-[88px] text-center">L2 Code</TableHead>
            {extraHeads}
            {showDerivedPeriodAmounts ? (
              <>
                <TableHead className="border-r text-right min-w-[96px]">Monthly</TableHead>
                <TableHead className="border-r text-right min-w-[96px]">Quarterly</TableHead>
                <TableHead className="border-r text-right min-w-[96px]">Yearly</TableHead>
              </>
            ) : null}
            <TableHead className={cn("text-right", compact ? "min-w-[100px]" : "min-w-[120px]")}>
              {allottedHead}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {grouped.map(({ l1Name, l1Code, l2Name, l2Code, entry, isFirstInL1Group, l1RowSpan }, index) => (
              <TableRow
                key={entry.id}
                className={cn(isFirstInL1Group && "border-t-2 border-t-border")}
              >
                {isFirstInL1Group ? (
                  <>
                    <TableCell
                      rowSpan={l1RowSpan}
                      className="border-r align-top bg-muted/25 font-medium"
                    >
                      {l1Name}
                    </TableCell>
                    <TableCell
                      rowSpan={l1RowSpan}
                      className="border-r align-middle text-center font-mono text-sm bg-muted/25"
                    >
                      {l1Code}
                    </TableCell>
                  </>
                ) : null}
                <TableCell className="border-r">{l2Name}</TableCell>
                <TableCell className="border-r text-center font-mono text-sm">
                  {l2Code}
                </TableCell>
                {renderExtraColumns?.(entry)}
                {showDerivedPeriodAmounts && formatDerivedAmount ? (
                  <>
                    <TableCell className="border-r text-right tabular-nums text-muted-foreground">
                      {formatDerivedAmount(entry, "monthly")}
                    </TableCell>
                    <TableCell className="border-r text-right tabular-nums text-muted-foreground">
                      {formatDerivedAmount(entry, "quarterly")}
                    </TableCell>
                    <TableCell className="border-r text-right tabular-nums text-muted-foreground">
                      {formatDerivedAmount(entry, "yearly")}
                    </TableCell>
                  </>
                ) : null}
                <TableCell className="text-right tabular-nums">{renderAllotted(entry)}</TableCell>
              </TableRow>
            )
          )}
        </TableBody>
      </Table>
    </div>
  );
}
