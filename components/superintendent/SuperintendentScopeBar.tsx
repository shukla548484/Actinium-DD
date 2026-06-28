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
import { mapSelectItems, type LabeledOption } from "@/lib/ui/labeledSelect";

type ScopeState = {
  employeeId: string | null;
  employee: { id: string; name: string; designation: string | null } | null;
  vesselIds: string[] | null;
  scoped: boolean;
  employees: { id: string; name: string; designation: string | null; vesselCount: number }[];
};

export function SuperintendentScopeBar() {
  const [state, setState] = useState<ScopeState | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch("/api/superintendent/scope");
    if (res.ok) setState(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    void load();
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

  async function setEmployee(employeeId: string | null) {
    await fetch("/api/superintendent/scope", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId }),
    });
    await load();
    window.location.reload();
  }

  if (loading || !state) return null;

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
        <Badge variant="outline">Unscoped — full fleet visible</Badge>
      )}
    </div>
  );
}
