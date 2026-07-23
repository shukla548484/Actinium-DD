"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";
import type { EmployeeModuleAccessDto } from "@/lib/db/employeeModuleAccess";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";

type Props = {
  employeeId: string;
};

export function AssignModulesPanel({ employeeId }: Props) {
  const [detail, setDetail] = useState<EmployeeModuleAccessDto | null>(null);
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set());
  const [selectedPages, setSelectedPages] = useState<Map<string, Set<string>>>(new Map());
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/employees/${employeeId}/assign-modules`);
      const text = await res.text();
      let data: EmployeeModuleAccessDto & { error?: string };
      try {
        data = text ? (JSON.parse(text) as EmployeeModuleAccessDto & { error?: string }) : {};
      } catch {
        setLoading(false);
        notify.error("Failed to load module assignments", {
          description: res.ok
            ? "Server returned an invalid response."
            : `HTTP ${res.status}`,
        });
        return;
      }
      setLoading(false);
      if (!res.ok) {
        notify.error(data.error ?? `Failed to load module assignments (HTTP ${res.status}).`);
        return;
      }
      if (!data.employee || !data.availableModules) {
        notify.error("Module assignment data was incomplete.");
        return;
      }
      setDetail(data);
      setSelectedModules(new Set(data.assignedModuleCodes ?? []));
      const pages = new Map<string, Set<string>>();
      for (const row of data.assignedPages ?? []) {
        const set = pages.get(row.moduleCode) ?? new Set();
        set.add(row.pageKey);
        pages.set(row.moduleCode, set);
      }
      setSelectedPages(pages);
      setActiveModule(
        data.assignedModuleCodes?.[0] ?? data.availableModules[0]?.code ?? null,
      );
    } catch (e) {
      setLoading(false);
      notify.error(e instanceof Error ? e.message : "Failed to load module assignments");
    }
  }, [employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeModuleDef = useMemo(
    () => detail?.availableModules.find((m) => m.code === activeModule) ?? null,
    [activeModule, detail],
  );

  function togglePage(moduleCode: string, pageKey: string, checked: boolean) {
    setSelectedPages((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(moduleCode) ?? []);
      if (checked) set.add(pageKey);
      else set.delete(pageKey);
      next.set(moduleCode, set);
      return next;
    });
  }

  function selectAllPages(moduleCode: string, pageKeys: string[]) {
    setSelectedPages((prev) => {
      const next = new Map(prev);
      next.set(moduleCode, new Set(pageKeys));
      return next;
    });
  }

  function clearPages(moduleCode: string) {
    setSelectedPages((prev) => {
      const next = new Map(prev);
      next.set(moduleCode, new Set());
      return next;
    });
  }

  async function handleSave() {
    if (!detail) return;
    setSaving(true);

    try {
      const assignments = [...selectedModules].map((moduleCode) => ({
        moduleCode,
        pageKeys: [...(selectedPages.get(moduleCode) ?? [])],
      }));

      if (assignments.length === 0) {
        notify.warning("Select at least one module and one or more pages inside it.");
        return;
      }

      const missingPages = assignments.filter((a) => a.pageKeys.length === 0);
      if (missingPages.length > 0) {
        const labels = missingPages.map((m) => {
          const mod = detail.availableModules.find((x) => x.code === m.moduleCode);
          return mod?.label ?? m.moduleCode;
        });
        notify.alert(`Select at least one page for: ${labels.join(", ")}`);
        return;
      }

      const res = await fetch(`/api/admin/employees/${employeeId}/assign-modules`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignments }),
      });
      const text = await res.text();
      let data: {
        error?: string;
        message?: string;
        detail?: EmployeeModuleAccessDto;
      };
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        notify.failure(`Failed to save assignments (HTTP ${res.status}).`);
        return;
      }
      if (!res.ok) {
        notify.error(data.error ?? "Failed to save assignments");
        return;
      }
      if (data.detail) {
        setDetail(data.detail);
        setSelectedModules(new Set(data.detail.assignedModuleCodes));
        const pages = new Map<string, Set<string>>();
        for (const row of data.detail.assignedPages) {
          const set = pages.get(row.moduleCode) ?? new Set();
          set.add(row.pageKey);
          pages.set(row.moduleCode, set);
        }
        setSelectedPages(pages);
      }
      notify.success("Module assignments saved", {
        description:
          data.message ??
          "This user can open only the assigned modules and pages on next load.",
      });
    } catch (e) {
      notify.error(e instanceof Error ? e.message : "Failed to save assignments");
    } finally {
      setSaving(false);
    }
  }

  function toggleModule(code: string, checked: boolean) {
    setSelectedModules((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(code);
        const mod = detail?.availableModules.find((m) => m.code === code);
        if (mod && mod.pages.length > 0) {
          setSelectedPages((pages) => {
            const copy = new Map(pages);
            if (!copy.get(code)?.size) {
              copy.set(code, new Set(mod.pages.map((p) => p.key)));
            }
            return copy;
          });
        }
      } else {
        next.delete(code);
        setSelectedPages((pages) => {
          const copy = new Map(pages);
          copy.delete(code);
          return copy;
        });
      }
      return next;
    });
    if (checked) setActiveModule(code);
  }

  if (loading) {
    return <ActiniumLoadingState label="Loading module assignments…" size="sm" />;
  }

  if (!detail) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Could not load module assignments.</p>
        <Button type="button" variant="outline" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {detail.employee.firstName} {detail.employee.lastName}
          </CardTitle>
          <CardDescription>
            {detail.employee.employeeCode}
            {detail.employee.designation ? ` · ${detail.employee.designation}` : ""}
            {detail.employee.roleName ? ` · ${detail.employee.roleName}` : ""}
            {detail.employee.vesselLoginId
              ? ` · Vessel login ${detail.employee.vesselLoginId}`
              : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Step 1 — assign modules. Step 2 — choose pages inside each module. Users with the same
            module can receive different pages. Unassigned modules and pages are blocked.
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">User type: {detail.employee.userType}</Badge>
            <Badge variant="outline">
              {selectedModules.size} module{selectedModules.size === 1 ? "" : "s"} selected
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">1. Modules</CardTitle>
            <CardDescription>Enable modules this user may access.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {detail.availableModules.length === 0 ? (
              <p className="text-sm text-muted-foreground">No modules available for this user type.</p>
            ) : (
              detail.availableModules.map((mod) => {
                const checked = selectedModules.has(mod.code);
                const pageCount = selectedPages.get(mod.code)?.size ?? 0;
                return (
                  <div
                    key={mod.code}
                    className={cn(
                      "rounded-md border px-3 py-2 transition-colors",
                      activeModule === mod.code && "border-primary bg-primary/5",
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <Checkbox
                        id={`mod-${mod.code}`}
                        checked={checked}
                        onCheckedChange={(v) => toggleModule(mod.code, v === true)}
                      />
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => setActiveModule(mod.code)}
                      >
                        <Label htmlFor={`mod-${mod.code}`} className="cursor-pointer font-medium">
                          {mod.label}
                        </Label>
                        <p className="text-xs text-muted-foreground">{mod.description}</p>
                        {checked ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {pageCount} page{pageCount === 1 ? "" : "s"} selected
                          </p>
                        ) : null}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="text-sm">2. Pages in module</CardTitle>
                <CardDescription>
                  {activeModuleDef
                    ? `Choose pages for ${activeModuleDef.label}.`
                    : "Select a module to assign pages."}
                </CardDescription>
              </div>
              {activeModuleDef && selectedModules.has(activeModuleDef.code) ? (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      selectAllPages(
                        activeModuleDef.code,
                        activeModuleDef.pages.map((p) => p.key),
                      )
                    }
                  >
                    Select all
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => clearPages(activeModuleDef.code)}
                  >
                    Clear
                  </Button>
                </div>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {!activeModuleDef ? (
              <p className="text-sm text-muted-foreground">Pick a module on the left.</p>
            ) : !selectedModules.has(activeModuleDef.code) ? (
              <p className="text-sm text-muted-foreground">
                Enable <span className="font-medium">{activeModuleDef.label}</span> first, then choose
                pages.
              </p>
            ) : activeModuleDef.pages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pages defined for this module.</p>
            ) : (
              <ul className="space-y-2">
                {activeModuleDef.pages.map((page) => {
                  const checked = selectedPages.get(activeModuleDef.code)?.has(page.key) ?? false;
                  return (
                    <li
                      key={`${activeModuleDef.code}:${page.key}`}
                      className="flex items-start gap-3 rounded-md border px-3 py-2"
                    >
                      <Checkbox
                        id={`page-${page.key}`}
                        checked={checked}
                        onCheckedChange={(v) =>
                          togglePage(activeModuleDef.code, page.key, v === true)
                        }
                      />
                      <div className="min-w-0">
                        <Label htmlFor={`page-${page.key}`} className="cursor-pointer font-medium">
                          {page.label}
                        </Label>
                        {page.description ? (
                          <p className="text-xs text-muted-foreground">{page.description}</p>
                        ) : null}
                        {page.route ? (
                          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                            {page.route}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          disabled={saving}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void handleSave();
          }}
        >
          {saving ? "Saving…" : "Save assignments"}
        </Button>
        <Button type="button" variant="outline" render={<Link href="/admin/employees" />} nativeButton={false}>
          Back to employees
        </Button>
        {!saving && selectedModules.size > 0 ? (
          <p className="text-xs text-muted-foreground">
            {selectedModules.size} module{selectedModules.size === 1 ? "" : "s"} ready to save
          </p>
        ) : null}
      </div>
    </div>
  );
}
