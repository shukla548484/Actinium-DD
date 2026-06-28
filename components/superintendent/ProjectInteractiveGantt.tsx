"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fmtDate } from "@/lib/superintendent/formatters";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type Milestone = {
  id: string;
  title: string;
  plannedDate: string | null;
  baselineDate: string | null;
  actualDate: string | null;
  status: string;
  dependsOnMilestoneId: string | null;
  dependsOnTitle: string | null;
};

type TimelineData = {
  plannedStart: string | null;
  plannedEnd: string | null;
  baselineLockedAt: string | null;
  milestones: Milestone[];
};

function parseTime(value: string | null): number | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

function computeCriticalPath(milestones: Milestone[]): Set<string> {
  let longest: string[] = [];
  function walk(id: string, path: string[]) {
    const next = [...path, id];
    const children = milestones.filter((m) => m.dependsOnMilestoneId === id);
    if (children.length === 0) {
      if (next.length > longest.length) longest = next;
      return;
    }
    for (const child of children) walk(child.id, next);
  }
  const roots = milestones.filter((m) => !m.dependsOnMilestoneId);
  if (roots.length === 0 && milestones[0]) walk(milestones[0].id, []);
  else for (const root of roots) walk(root.id, []);
  return new Set(longest);
}

function dateFromPct(pct: number, rangeStart: number, span: number): string {
  const t = rangeStart + (pct / 100) * span;
  return new Date(t).toISOString();
}

type Props = {
  projectId: string;
  timeline: TimelineData;
  onUpdated: () => void;
};

export function ProjectInteractiveGantt({ projectId, timeline, onUpdated }: Props) {
  const [showBaseline, setShowBaseline] = useState(true);
  const [busy, setBusy] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragPct, setDragPct] = useState<number | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const start = parseTime(timeline.plannedStart);
  const end = parseTime(timeline.plannedEnd);
  const rangeStart = start ?? Date.now();
  const rangeEnd = end && end > rangeStart ? end : rangeStart + 1000 * 60 * 60 * 24 * 30;
  const span = rangeEnd - rangeStart;

  const critical = useMemo(() => computeCriticalPath(timeline.milestones), [timeline.milestones]);

  function pct(date: string | null): number {
    const t = parseTime(date);
    if (t == null) return 0;
    return Math.min(100, Math.max(0, ((t - rangeStart) / span) * 100));
  }

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      if (!draggingId || !trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      setDragPct(Math.min(100, Math.max(0, (x / rect.width) * 100)));
    },
    [draggingId],
  );

  const onPointerUp = useCallback(async () => {
    if (!draggingId || dragPct == null) {
      setDraggingId(null);
      setDragPct(null);
      return;
    }
    const plannedDate = dateFromPct(dragPct, rangeStart, span);
    setBusy(true);
    await fetch(`/api/superintendent/projects/${projectId}/timeline/reschedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        updates: [{ id: draggingId, plannedDate }],
      }),
    });
    setBusy(false);
    setDraggingId(null);
    setDragPct(null);
    onUpdated();
  }, [draggingId, dragPct, projectId, rangeStart, span, onUpdated]);

  useEffect(() => {
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  async function lockBaseline() {
    setBusy(true);
    await fetch(`/api/superintendent/projects/${projectId}/timeline/reschedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "lockBaseline" }),
    });
    setBusy(false);
    onUpdated();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="show-baseline"
            checked={showBaseline}
            onCheckedChange={(v) => setShowBaseline(v === true)}
          />
          <Label htmlFor="show-baseline" className="text-sm">
            Show baseline
          </Label>
          {timeline.baselineLockedAt ? (
            <span className="text-xs text-muted-foreground">
              Locked {fmtDate(timeline.baselineLockedAt)}
            </span>
          ) : null}
        </div>
        <Button variant="outline" size="sm" disabled={busy} onClick={() => void lockBaseline()}>
          Lock baseline
        </Button>
      </div>

      <div className="rounded-lg border bg-muted/20 p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Interactive Gantt — drag milestones to reschedule
        </p>
        <div className="space-y-2" ref={trackRef}>
          {timeline.milestones.map((m) => {
            const isCritical = critical.has(m.id);
            const isDragging = draggingId === m.id;
            const plannedPct = isDragging && dragPct != null ? dragPct : pct(m.plannedDate);
            const baselinePct = pct(m.baselineDate);

            return (
              <div
                key={m.id}
                className="grid grid-cols-[minmax(140px,1fr)_minmax(220px,2fr)] items-center gap-3 text-sm"
              >
                <div>
                  <Link
                    href={`/superintendent/planning/milestones/${m.id}/edit`}
                    className={cn("font-medium hover:underline", isCritical && "text-primary")}
                  >
                    {m.title}
                  </Link>
                  {m.dependsOnTitle ? (
                    <p className="text-xs text-muted-foreground">After: {m.dependsOnTitle}</p>
                  ) : null}
                </div>
                <div className="relative h-8 rounded-md bg-muted">
                  {showBaseline && m.baselineDate ? (
                    <div
                      className="absolute inset-y-2 rounded-sm bg-muted-foreground/25"
                      style={{ left: `${Math.max(0, baselinePct - 1)}%`, width: "2%" }}
                      title={`Baseline: ${fmtDate(m.baselineDate)}`}
                    />
                  ) : null}
                  <button
                    type="button"
                    className={cn(
                      "absolute top-1/2 z-10 h-5 w-5 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full ring-2 ring-background active:cursor-grabbing",
                      isCritical ? "bg-primary" : "bg-primary/70",
                      isDragging && "scale-110",
                    )}
                    style={{ left: `${plannedPct}%` }}
                    title={`${m.title} — ${fmtDate(m.plannedDate)}`}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      setDraggingId(m.id);
                      setDragPct(plannedPct);
                    }}
                    disabled={busy}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex justify-between text-xs text-muted-foreground">
          <span>{fmtDate(timeline.plannedStart)}</span>
          <span>{fmtDate(timeline.plannedEnd)}</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-left">
              <th className="px-3 py-2 font-medium">Milestone</th>
              <th className="px-3 py-2 font-medium">Baseline</th>
              <th className="px-3 py-2 font-medium">Planned</th>
              <th className="px-3 py-2 font-medium">Variance</th>
              <th className="px-3 py-2 font-medium">Depends on</th>
            </tr>
          </thead>
          <tbody>
            {timeline.milestones.map((m) => {
              const planned = parseTime(m.plannedDate);
              const baseline = parseTime(m.baselineDate);
              const varianceDays =
                planned != null && baseline != null
                  ? Math.round((planned - baseline) / (1000 * 60 * 60 * 24))
                  : null;
              return (
                <tr
                  key={m.id}
                  className={cn("border-b last:border-0", critical.has(m.id) && "bg-primary/5")}
                >
                  <td className="px-3 py-2">{m.title}</td>
                  <td className="px-3 py-2">{fmtDate(m.baselineDate)}</td>
                  <td className="px-3 py-2">{fmtDate(m.plannedDate)}</td>
                  <td className="px-3 py-2">
                    {varianceDays == null ? (
                      "—"
                    ) : varianceDays === 0 ? (
                      "On baseline"
                    ) : (
                      <span className={varianceDays > 0 ? "text-amber-600" : "text-green-600"}>
                        {varianceDays > 0 ? `+${varianceDays}` : varianceDays} days
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{m.dependsOnTitle ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
