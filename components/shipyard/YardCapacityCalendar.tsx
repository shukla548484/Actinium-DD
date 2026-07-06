"use client";

import { useMemo } from "react";
import { MONTH_LABELS } from "@/lib/shipyard/yardProfileConstants";

type CapacitySlot = {
  slotLabel: string;
  year: number;
  month: number;
  occupancyPct: number;
};

function occupancyClass(pct: number): string {
  if (pct >= 80) return "bg-destructive/80 text-destructive-foreground";
  if (pct >= 50) return "bg-amber-500/80 text-amber-950";
  if (pct >= 20) return "bg-primary/60 text-primary-foreground";
  return "bg-muted text-muted-foreground";
}

export function YardCapacityCalendar({
  slots,
  year,
  editable,
  onCellChange,
}: {
  slots: CapacitySlot[];
  year?: number;
  editable?: boolean;
  onCellChange?: (slotLabel: string, month: number, occupancyPct: number) => void;
}) {
  const displayYear = year ?? new Date().getFullYear();

  const rowLabels = useMemo(() => {
    const labels = new Set<string>();
    for (const s of slots) {
      if (s.year === displayYear) labels.add(s.slotLabel);
    }
    return [...labels].sort();
  }, [slots, displayYear]);

  const matrix = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of slots) {
      if (s.year === displayYear) {
        map.set(`${s.slotLabel}:${s.month}`, s.occupancyPct);
      }
    }
    return map;
  }, [slots, displayYear]);

  if (rowLabels.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No capacity slots for {displayYear}. Add docks to generate the calendar grid.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-xs">
        <thead>
          <tr>
            <th className="border bg-muted/50 p-2 text-left font-medium">Dock / berth</th>
            {MONTH_LABELS.map((m) => (
              <th key={m} className="border bg-muted/50 p-2 text-center font-medium">
                {m}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowLabels.map((label) => (
            <tr key={label}>
              <td className="border p-2 font-medium">{label}</td>
              {MONTH_LABELS.map((_, idx) => {
                const month = idx + 1;
                const pct = matrix.get(`${label}:${month}`) ?? 0;
                return (
                  <td key={month} className="border p-0">
                    {editable && onCellChange ? (
                      <input
                        type="number"
                        min={0}
                        max={100}
                        className="h-9 w-full bg-transparent px-1 text-center tabular-nums outline-none focus:ring-1 focus:ring-primary"
                        value={pct}
                        onChange={(e) =>
                          onCellChange(label, month, Math.min(100, Math.max(0, Number(e.target.value) || 0)))
                        }
                        aria-label={`${label} ${MONTH_LABELS[idx]} occupancy`}
                      />
                    ) : (
                      <div
                        className={`flex h-9 items-center justify-center tabular-nums ${occupancyClass(pct)}`}
                        title={`${pct}% occupied`}
                      >
                        {pct > 0 ? `${Math.round(pct)}%` : "—"}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-muted-foreground">
        Monthly occupancy % per dock/berth — darker cells indicate higher utilization.
      </p>
    </div>
  );
}
