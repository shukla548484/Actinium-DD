"use client";

import { ProgressBar } from "@/components/ui/progress-bar";
import { fmtPct } from "@/lib/superintendent/formatters";
import { cn } from "@/lib/utils";

type Props = {
  completed: number;
  total: number;
  className?: string;
};

/** Checklist completion summary with a full-width progress track. */
export function ChecklistCompletionRing({ completed, total, className }: Props) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div
      className={cn("min-w-[12rem] space-y-2", className)}
      role="img"
      aria-label={`${fmtPct(pct)} complete — ${completed} of ${total} checklist items`}
    >
      <ProgressBar value={pct} className="w-48 sm:w-56" />
      <div>
        <p className="text-2xl font-semibold tabular-nums tracking-tight">{fmtPct(pct)}</p>
        <p className="text-sm text-muted-foreground">
          {completed}/{total} completed
        </p>
      </div>
    </div>
  );
}
