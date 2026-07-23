"use client";

import { cn } from "@/lib/utils";
import { fmtPct } from "@/lib/superintendent/formatters";

type Props = {
  completed: number;
  total: number;
  className?: string;
  size?: number;
};

/** Circular completion ring for pre-dock checklist progress. */
export function ChecklistCompletionRing({
  completed,
  total,
  className,
  size = 88,
}: Props) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(100, Math.max(0, pct)) / 100);

  return (
    <div
      className={cn("flex items-center gap-4", className)}
      role="img"
      aria-label={`${fmtPct(pct)} complete — ${completed} of ${total} checklist items`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-primary transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <div>
        <p className="text-2xl font-semibold tabular-nums tracking-tight">{fmtPct(pct)}</p>
        <p className="text-sm text-muted-foreground">
          {completed}/{total} completed
        </p>
      </div>
    </div>
  );
}
