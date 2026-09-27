"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useActiveDryDockProject } from "@/components/superintendent/ActiveDryDockProjectProvider";
import { mapSelectItems, type LabeledOption } from "@/lib/ui/labeledSelect";

type ScopeState = {
  employeeId: string | null;
  employee: { id: string; name: string; designation: string | null } | null;
  vesselIds: string[] | null;
  scoped: boolean;
  employees: { id: string; name: string; designation: string | null; vesselCount: number }[];
};

type ProjectOption = { id: string; name: string };

export function SuperintendentScopeBar() {
  const [state, setState] = useState<ScopeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const { activeProjectId, activeProject, setActiveProjectId, refresh } =
    useActiveDryDockProject();

  async function load() {
    const res = await fetch("/api/superintendent/scope");
    if (res.ok) {
      const data = (await res.json()) as ScopeState;
      setState(data);
    }
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    void fetch("/api/superintendent/project-options")
      .then((r) => r.json())
      .then((d: { projects?: ProjectOption[] }) => setProjects(d.projects ?? []));
  }, []);

  const employeeItems = useMemo((): LabeledOption[] => {
    if (!state) return [{ value: "office", label: "Office mode — all vessels" }];
    return [
      { value: "office", label: "Office mode — all vessels" },
      ...mapSelectItems(state.employees, (e) => e.id, (e) => {
        const suffix = e.designation ? ` · ${e.designation}` : "";
        return `${e.name}${suffix} (${e.vesselCount} vessels)`;
      }),
    ];
  }, [state]);

  const projectItems = useMemo((): LabeledOption[] => {
    return [
      { value: "none", label: "No active project — fleet-wide" },
      ...mapSelectItems(projects, (p) => p.id, (p) => p.name),
    ];
  }, [projects]);

  async function setEmployee(employeeId: string | null) {
    await fetch("/api/superintendent/scope", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId }),
    });
    await load();
    await refresh();
    window.location.reload();
  }

  async function onActiveProjectChange(value: string | null) {
    const id = !value || value === "none" ? null : value;
    await setActiveProjectId(id);
  }

  if (loading || !state) return null;

  const projectLabel = activeProject
    ? `${activeProject.name}${activeProject.referenceCode ? ` · ${activeProject.referenceCode}` : ""}`
    : "No active project — fleet-wide";

  return (
    <div className="flex flex-wrap items-center gap-3 border-b bg-muted/40 px-4 py-2 text-sm">
      <span className="font-medium text-muted-foreground">Acting as:</span>
      <Select
        items={employeeItems}
        value={state.employeeId ?? "office"}
        onValueChange={(v) => void setEmployee(v === "office" ? null : v)}
      >
        <SelectTrigger className="h-8 w-64">
          <SelectValue placeholder="Office (all vessels)" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="office">Office mode — all vessels</SelectItem>
          {state.employees.map((e) => (
            <SelectItem key={e.id} value={e.id}>
              {e.name}
              {e.designation ? ` · ${e.designation}` : ""} ({e.vesselCount} vessels)
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {state.scoped ? (
        <Badge variant="secondary">
          {state.vesselIds?.length ?? 0} assigned vessel
          {(state.vesselIds?.length ?? 0) === 1 ? "" : "s"}
        </Badge>
      ) : (
        <Badge variant="outline">Unscoped vessels — full fleet visible</Badge>
      )}

      <span className="ml-1 hidden h-4 w-px bg-border sm:inline-block" aria-hidden />

      <span className="font-medium text-muted-foreground">Active project:</span>
      <Select
        items={projectItems}
        value={activeProjectId ?? "none"}
        onValueChange={(v) => void onActiveProjectChange(v)}
      >
        <SelectTrigger className="h-8 min-w-[14rem] max-w-xs">
          <SelectValue placeholder="No active project">{projectLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No active project — fleet-wide</SelectItem>
          {projects.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {activeProject ? (
        <Badge variant="secondary">
          {activeProject.vessel.code}
        </Badge>
      ) : (
        <Badge variant="outline">Fleet-wide lists</Badge>
      )}
    </div>
  );
}
