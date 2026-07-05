"use client";

import { useCallback, useEffect, useState } from "react";
import { useShipAccessContext } from "@/components/shipAccess/ShipAccessScopeBar";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { VesselMachineryHoursDto } from "@/lib/db/vesselMachineryHours";

export default function ShipAccessMachineryHoursPage() {
  const ctx = useShipAccessContext();
  const [hours, setHours] = useState<VesselMachineryHoursDto | null>(null);
  const [mainHours, setMainHours] = useState("");
  const [auxHours, setAuxHours] = useState("");
  const [boilerHours, setBoilerHours] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    if (!ctx.vesselId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/ship-access/machinery-hours?vesselId=${ctx.vesselId}`);
    const data = (await res.json()) as { hours?: VesselMachineryHoursDto; error?: string };
    setLoading(false);
    if (!res.ok || !data.hours) {
      setError(data.error ?? "Failed to load running hours");
      return;
    }
    setHours(data.hours);
    setMainHours(data.hours.mainEngineRunningHours?.toString() ?? "");
    setAuxHours(data.hours.auxiliaryEngineRunningHours?.toString() ?? "");
    setBoilerHours(data.hours.boilerRunningHours?.toString() ?? "");
  }, [ctx.vesselId]);

  useEffect(() => {
    if (!ctx.loading) void load();
  }, [ctx.loading, load]);

  function parseHours(value: string): number | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const num = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(num) || num < 0) throw new Error("Enter valid running hours");
    return num;
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!ctx.vesselId) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/ship-access/machinery-hours", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vesselId: ctx.vesselId,
          mainEngineRunningHours: parseHours(mainHours),
          auxiliaryEngineRunningHours: parseHours(auxHours),
          boilerRunningHours: parseHours(boilerHours),
        }),
      });
      const data = (await res.json()) as { hours?: VesselMachineryHoursDto; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to save running hours");
        return;
      }
      setHours(data.hours ?? null);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell size="wide">
      <PageHeader
        title="Machinery running hours"
        description={
          ctx.vessel
            ? `Update running hours for ${ctx.vessel.name} (${ctx.vessel.code})`
            : "Update machinery running hours for your assigned vessel"
        }
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !ctx.vesselId ? (
        <Alert>
          <AlertDescription>No vessel assigned to your crew account.</AlertDescription>
        </Alert>
      ) : (
        <Card className="max-w-xl">
          <CardHeader>
            <CardTitle className="text-base">Running hours</CardTitle>
            <CardDescription>
              Record current main engine, auxiliary engine, and boiler running hours for dry dock
              planning.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hours?.updatedAt ? (
              <p className="mb-4 text-xs text-muted-foreground">
                Last updated {new Date(hours.updatedAt).toLocaleString()}
                {hours.updatedBy ? ` by ${hours.updatedBy}` : ""}
              </p>
            ) : null}

            <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="meHours">Main engine hours</Label>
                {hours?.mainEngine ? (
                  <p className="text-xs text-muted-foreground">{hours.mainEngine}</p>
                ) : null}
                <Input
                  id="meHours"
                  inputMode="numeric"
                  value={mainHours}
                  onChange={(e) => setMainHours(e.target.value.replace(/\D/g, ""))}
                  placeholder="e.g. 45230"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="aeHours">Auxiliary engine hours</Label>
                {hours?.auxiliaryEngine ? (
                  <p className="text-xs text-muted-foreground">{hours.auxiliaryEngine}</p>
                ) : null}
                <Input
                  id="aeHours"
                  inputMode="numeric"
                  value={auxHours}
                  onChange={(e) => setAuxHours(e.target.value.replace(/\D/g, ""))}
                  placeholder="e.g. 12800"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="boilerHours">Boiler hours</Label>
                {hours?.boilerInfo ? (
                  <p className="text-xs text-muted-foreground">{hours.boilerInfo}</p>
                ) : null}
                <Input
                  id="boilerHours"
                  inputMode="numeric"
                  value={boilerHours}
                  onChange={(e) => setBoilerHours(e.target.value.replace(/\D/g, ""))}
                  placeholder="e.g. 5600"
                />
              </div>

              {error ? (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              {saved ? (
                <Alert>
                  <AlertDescription>Running hours saved.</AlertDescription>
                </Alert>
              ) : null}

              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Save running hours"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </PageShell>
  );
}
