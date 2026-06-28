"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { mapSelectItems } from "@/lib/ui/labeledSelect";

type VesselOption = { id: string; code: string; name: string };

type ContextState = {
  vessels: VesselOption[];
  vesselId: string | null;
  vessel: VesselOption | null;
  dryDockProject: { id: string; name: string; referenceCode: string | null } | null;
};

export function ShipAccessScopeBar() {
  const [state, setState] = useState<ContextState | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch("/api/ship-access/context");
    if (res.ok) setState(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function setVessel(vesselId: string) {
    await fetch("/api/ship-access/vessel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vesselId }),
    });
    await load();
  }

  if (loading || !state) return null;

  const vesselItems = mapSelectItems(
    state.vessels,
    (v) => v.id,
    (v) => `${v.name} (${v.code})`,
  );

  return (
    <div className="flex flex-wrap items-center gap-3 border-b bg-muted/40 px-4 py-2 text-sm">
      <span className="font-medium text-muted-foreground">Ship Access · Vessel:</span>
      {state.vessels.length <= 1 ? (
        <span className="font-medium">
          {state.vessel ? `${state.vessel.name} (${state.vessel.code})` : "No vessel assigned"}
        </span>
      ) : (
        <Select
          items={vesselItems}
          value={state.vesselId ?? undefined}
          onValueChange={(v) => {
            if (v) void setVessel(v);
          }}
        >
          <SelectTrigger className="h-8 w-64">
            <SelectValue placeholder="Select vessel" />
          </SelectTrigger>
          <SelectContent>
            {state.vessels.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.name} ({v.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {state.dryDockProject ? (
        <Badge variant="secondary">
          {state.dryDockProject.referenceCode ?? state.dryDockProject.name}
        </Badge>
      ) : (
        <Badge variant="outline">No active dry dock project</Badge>
      )}
    </div>
  );
}

/** Client hook for ship access pages that need vessel + project context. */
export function useShipAccessContext() {
  const [state, setState] = useState<ContextState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ship-access/context");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to load ship context");
        setState(null);
        return;
      }
      setState(data as ContextState);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...state, loading, error, reload };
}
