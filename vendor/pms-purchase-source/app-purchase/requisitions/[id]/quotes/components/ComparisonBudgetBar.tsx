"use client";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type Props = {
  budgetCode?: string | null;
  isBudgeted: boolean | null | undefined;
  onBudgetedChange: (next: boolean | null) => void;
  disabled?: boolean;
};

export function ComparisonBudgetBar({
  budgetCode,
  isBudgeted,
  onBudgetedChange,
  disabled = false,
}: Props) {
  return (
    <div
      className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border/80 bg-background px-2.5 py-1.5"
      aria-label="Budget classification"
    >
      <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        Budget
      </span>
      {budgetCode && (
        <Badge variant="outline" className="h-5 text-[10px] font-normal">
          Code: {budgetCode}
        </Badge>
      )}
      <div className="flex items-center gap-1.5">
        <Checkbox
          id="comparison-budgeted"
          checked={isBudgeted === true}
          disabled={disabled}
          onCheckedChange={(c) => onBudgetedChange(c === true ? true : null)}
        />
        <Label htmlFor="comparison-budgeted" className="cursor-pointer text-xs font-medium">
          Budgeted
        </Label>
      </div>
      <div className="flex items-center gap-1.5">
        <Checkbox
          id="comparison-unbudgeted"
          checked={isBudgeted === false}
          disabled={disabled}
          onCheckedChange={(c) => onBudgetedChange(c === true ? false : null)}
        />
        <Label htmlFor="comparison-unbudgeted" className="cursor-pointer text-xs font-medium">
          Un-budgeted
        </Label>
      </div>
    </div>
  );
}
