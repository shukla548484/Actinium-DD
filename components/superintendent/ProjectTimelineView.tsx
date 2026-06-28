"use client";

import Link from "next/link";
import { fmtDate } from "@/lib/superintendent/formatters";
import { cn } from "@/lib/utils";

type Milestone = {
  id: string;
  title: string;
  plannedDate: string | null;
  actualDate: string | null;
  status: string;
  dependsOnMilestoneId: string | null;
  dependsOnTitle: string | null;
};

type TimelineData = {
  plannedStart: string | null;
  plannedEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  expectedSailing: string | null;
  milestones: Milestone[];
};

function parseTime(value: string | null): number | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

function computeCriticalPath(milestones: Milestone[]): Set<string> {
  const byId = new Map(milestones.map((m) => [m.id, m]));
  let longest: string[] = [];

  function walk(id: string, path: string[]) {
    const next = [...path, id];
    const children = milestones.filter((m) => m.dependsOnMilestoneId === id);
    if (children.length === 0) {
      if (next.length > longest.length) longest = next;
      return;
    }
    for (const child of children) {
      if (byId.has(child.id)) walk(child.id, next);
    }
  }

  const roots = milestones.filter((m) => !m.dependsOnMilestoneId);
  if (roots.length === 0 && milestones.length > 0) {
    walk(milestones[0]!.id, []);
  } else {
    for (const root of roots) walk(root.id, []);
  }

  return new Set(longest);
}

export function ProjectTimelineView({ timeline }: { timeline: TimelineData }) {
  const start = parseTime(timeline.plannedStart) ?? parseTime(timeline.actualStart);
  const end =
    parseTime(timeline.plannedEnd) ??
    parseTime(timeline.expectedSailing) ??
    parseTime(timeline.actualEnd);

  const rangeStart = start ?? Date.now();
  const rangeEnd = end && end > rangeStart ? end : rangeStart + 1000 * 60 * 60 * 24 * 30;
  const span = rangeEnd - rangeStart;

  function pct(date: string | null): number {
    const t = parseTime(date);
    if (t == null) return 0;
    return Math.min(100, Math.max(0, ((t - rangeStart) / span) * 100));
  }

  const critical = computeCriticalPath(timeline.milestones);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
        <div>
          <p className="text-muted-foreground">Planned start</p>
          <p className="font-medium">{fmtDate(timeline.plannedStart)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Planned completion</p>
          <p className="font-medium">{fmtDate(timeline.plannedEnd)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Expected sailing</p>
          <p className="font-medium">{fmtDate(timeline.expectedSailing)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Critical path</p>
          <p className="font-medium">{critical.size} milestones</p>
        </div>
      </div>

      <div className="rounded-lg border bg-muted/20 p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Gantt schedule
        </p>
        <div className="space-y-2">
          {timeline.milestones.length === 0 ? (
            <p className="text-sm text-muted-foreground">No milestones yet.</p>
          ) : (
            timeline.milestones.map((m) => {
              const left = pct(m.plannedDate);
              const isCritical = critical.has(m.id);
              return (
                <div key={m.id} className="grid grid-cols-[minmax(140px,1fr)_minmax(200px,2fr)] items-center gap-3 text-sm">
                  <div>
                    <p className={cn("font-medium leading-tight", isCritical && "text-primary")}>
                      {m.title}
                    </p>
                    {m.dependsOnTitle ? (
                      <p className="text-xs text-muted-foreground">After: {m.dependsOnTitle}</p>
                    ) : null}
                  </div>
                  <div className="relative h-7 rounded-md bg-muted">
                    <div
                      className={cn(
                        "absolute inset-y-1.5 rounded-sm",
                        isCritical ? "bg-primary/70" : "bg-primary/30",
                      )}
                      style={{ left: `${Math.max(0, left - 2)}%`, width: "4%" }}
                      title={fmtDate(m.plannedDate)}
                    />
                    <span
                      className="absolute top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground"
                      style={{ left: `${Math.min(96, left + 5)}%` }}
                    >
                      {fmtDate(m.plannedDate)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="mt-3 flex justify-between text-xs text-muted-foreground">
          <span>{fmtDate(timeline.plannedStart)}</span>
          <span>{fmtDate(timeline.plannedEnd ?? timeline.expectedSailing)}</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="px-3 py-2 font-medium">Milestone</th>
              <th className="px-3 py-2 font-medium">Depends on</th>
              <th className="px-3 py-2 font-medium">Planned</th>
              <th className="px-3 py-2 font-medium">Actual</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {timeline.milestones.map((m) => (
              <tr
                key={m.id}
                className={cn(
                  "border-b last:border-0",
                  critical.has(m.id) && "bg-primary/5",
                )}
              >
                <td className="px-3 py-2">
                  <Link
                    href={`/superintendent/planning/milestones/${m.id}/edit`}
                    className="font-medium text-primary hover:underline"
                  >
                    {m.title}
                  </Link>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{m.dependsOnTitle ?? "—"}</td>
                <td className="px-3 py-2">{fmtDate(m.plannedDate)}</td>
                <td className="px-3 py-2">{fmtDate(m.actualDate)}</td>
                <td className={cn("px-3 py-2 capitalize")}>{m.status.replace(/_/g, " ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
