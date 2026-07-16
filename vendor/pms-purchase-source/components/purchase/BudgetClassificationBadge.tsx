"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  budgetClassificationLabel,
  type BudgetClassificationDisplay,
} from "@/lib/purchase/po-budget-classification";

const BADGE_STYLES: Record<
  BudgetClassificationDisplay,
  string
> = {
  Budgeted: "border-emerald-500 bg-emerald-50 text-emerald-900 hover:bg-emerald-50",
  "Un-Budgeted": "border-red-500 bg-red-50 text-red-900 hover:bg-red-50",
  Unset: "border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-50",
};

type Props = {
  isBudgeted: boolean | null | undefined;
  size?: "sm" | "md" | "lg";
  className?: string;
  showPoLabel?: boolean;
};

export function BudgetClassificationBadge({
  isBudgeted,
  size = "md",
  className,
  showPoLabel = false,
}: Props) {
  const label = budgetClassificationLabel(isBudgeted);
  const sizeClass =
    size === "lg"
      ? "px-3 py-1 text-sm font-semibold"
      : size === "sm"
        ? "h-5 px-2 text-[10px] font-semibold"
        : "px-2.5 py-0.5 text-xs font-semibold";

  return (
    <Badge
      variant="outline"
      className={cn(BADGE_STYLES[label], sizeClass, className)}
    >
      {showPoLabel ? `PO: ${label}` : label}
    </Badge>
  );
}
