"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

type VesselOption = {
  id: string;
  code: string;
  name: string;
  imoNumber?: string | null;
};

type VesselDetails = {
  id: string;
  code: string;
  name: string;
  imoNumber: string | null;
  vesselType: string | null;
  flag: string | null;
  classSociety: string | null;
  yearBuilt: number | null;
  lastIntermediateSurveyDate: string | null;
  dockingSurveyDate: string | null;
  nextDryDockDue: string | null;
  company: { id: string; name: string; code: string } | null;
};

type SurveyStatus = {
  activeWindow: "docking" | "intermediate" | "none" | "unknown";
  label: string;
  message: string;
  inIntermediateRange: boolean;
  inDockingRange: boolean;
};

function formatDisplayDate(value: string | null | undefined): string {
  if (!value) return "Not available";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function CreateProjectForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vessels, setVessels] = useState<VesselOption[]>([]);
  const [vesselsLoading, setVesselsLoading] = useState(true);
  const [vesselId, setVesselId] = useState("");
  const [vesselDetails, setVesselDetails] = useState<VesselDetails | null>(null);
  const [surveyStatus, setSurveyStatus] = useState<SurveyStatus | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [projectCode, setProjectCode] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);
  const [preferredYards, setPreferredYards] = useState(["", "", ""]);

  useEffect(() => {
    let cancelled = false;
    setVesselsLoading(true);
    void fetch("/api/projects/vessels?limit=200")
      .then((r) => r.json())
      .then((d: { items?: VesselOption[] }) => {
        if (!cancelled) setVessels(d.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setVessels([]);
      })
      .finally(() => {
        if (!cancelled) setVesselsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!vesselId) {
      setVesselDetails(null);
      setSurveyStatus(null);
      setProjectCode("");
      return;
    }

    let cancelled = false;
    setDetailsLoading(true);
    setCodeLoading(true);

    void fetch(`/api/projects/vessels/${encodeURIComponent(vesselId)}`)
      .then(async (r) => {
        const d = (await r.json()) as {
          vessel?: VesselDetails;
          surveyStatus?: SurveyStatus;
          error?: string;
        };
        if (cancelled) return;
        if (!r.ok || !d.vessel) {
          setVesselDetails(null);
          setSurveyStatus(null);
          return;
        }
        setVesselDetails(d.vessel);
        setSurveyStatus(d.surveyStatus ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setVesselDetails(null);
          setSurveyStatus(null);
        }
      })
      .finally(() => {
        if (!cancelled) setDetailsLoading(false);
      });

    void fetch(`/api/projects/preview-code?vesselId=${encodeURIComponent(vesselId)}`)
      .then((r) => r.json())
      .then((d: { projectCode?: string }) => {
        if (!cancelled) setProjectCode(d.projectCode ?? "");
      })
      .catch(() => {
        if (!cancelled) setProjectCode("");
      })
      .finally(() => {
        if (!cancelled) setCodeLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [vesselId]);

  const vesselItems = useMemo(
    () =>
      vessels.map((v) => ({
        value: v.id,
        label: `${v.name} (${v.code})`,
        searchText: `${v.name} ${v.code} ${v.imoNumber ?? ""}`,
      })),
    [vessels],
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!vesselId) {
      setError("Select an assigned vessel.");
      setLoading(false);
      return;
    }

    const fd = new FormData(e.currentTarget);
    const body = {
      name: String(fd.get("name") ?? ""),
      vesselId,
      vesselName: vesselDetails?.name,
      referenceCode: projectCode || undefined,
      currency: String(fd.get("currency") ?? "USD"),
      shipyardDays: fd.get("shipyardDays") ? Number(fd.get("shipyardDays")) : undefined,
      dryDockDays: fd.get("dryDockDays") ? Number(fd.get("dryDockDays")) : undefined,
      cprDays: fd.get("cprDays") ? Number(fd.get("cprDays")) : undefined,
      notes: String(fd.get("notes") ?? "") || undefined,
      preferredShipyards: preferredYards.map((s) => s.trim()).filter(Boolean),
    };

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    let data: { project?: { id: string }; error?: string } = {};
    try {
      data = (await res.json()) as { project?: { id: string }; error?: string };
    } catch {
      setLoading(false);
      setError(res.ok ? "Unexpected empty response." : "Failed to create project.");
      return;
    }
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Failed to create project.");
      return;
    }

    if (!data.project?.id) {
      setError("Project created but no id returned.");
      return;
    }

    router.push(`/projects/${data.project.id}`);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto grid max-w-6xl items-stretch gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)]"
    >
      <Card className="flex h-full flex-col">
        <CardHeader>
          <CardTitle>New tender project</CardTitle>
          <CardDescription>
            Create a dry-dock tender for one of your assigned vessels.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Project name *</Label>
            <Input
              id="name"
              name="name"
              required
              placeholder="MV Example — DD 2026"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vessel">Vessel *</Label>
            <SearchableSelect
              id="vessel"
              items={vesselItems}
              value={vesselId}
              onValueChange={setVesselId}
              placeholder={
                vesselsLoading
                  ? "Loading assigned vessels…"
                  : vessels.length === 0
                    ? "No vessels assigned"
                    : "Search assigned vessels…"
              }
              searchPlaceholder="Search by name, code, or IMO…"
              disabled={vesselsLoading || vessels.length === 0}
            />
            <p className="text-xs text-muted-foreground">
              Only vessels assigned to you are listed.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="projectId">Auto-generated project ID</Label>
            <Input
              id="projectId"
              value={
                !vesselId
                  ? "Select a vessel first"
                  : codeLoading
                    ? "Generating…"
                    : projectCode || "Unavailable"
              }
              disabled
              readOnly
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Assigned from the vessel code when the project is saved.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Preferred shipyards (Plan 3) — optional</Label>
            <p className="text-xs text-muted-foreground">
              Name up to three preferred yards for planning. You can invite them later.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {[0, 1, 2].map((index) => (
                <div key={index} className="space-y-1.5">
                  <Label htmlFor={`yard-${index}`} className="text-xs text-muted-foreground">
                    Shipyard {index + 1}
                  </Label>
                  <Input
                    id={`yard-${index}`}
                    value={preferredYards[index]}
                    onChange={(e) => {
                      const next = [...preferredYards];
                      next[index] = e.target.value;
                      setPreferredYards(next);
                    }}
                    placeholder={`Yard ${index + 1} name`}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" name="currency" defaultValue="USD" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shipyardDays">Shipyard days</Label>
              <Input id="shipyardDays" name="shipyardDays" type="number" min={0} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dryDockDays">Dry-dock days</Label>
              <Input id="dryDockDays" name="dryDockDays" type="number" min={0} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cprDays">CPR days</Label>
              <Input id="cprDays" name="cprDays" type="number" min={0} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={3} />
          </div>

          <div className="mt-auto pt-2">
            <Button type="submit" disabled={loading || !vesselId}>
              {loading ? "Creating…" : "Create project"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="flex h-full flex-col">
        <CardHeader>
          <CardTitle>Vessel details</CardTitle>
          <CardDescription>
            Survey and build data for the selected vessel.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col">
          {!vesselId ? (
            <p className="text-sm text-muted-foreground">
              Select a vessel to load built year and survey dates.
            </p>
          ) : detailsLoading ? (
            <p className="text-sm text-muted-foreground">Loading vessel details…</p>
          ) : !vesselDetails ? (
            <p className="text-sm text-destructive">Could not load vessel details.</p>
          ) : (
            <dl className="flex flex-1 flex-col justify-between gap-4 text-sm">
              <div className="space-y-4">
              <div>
                <dt className="text-muted-foreground">Vessel</dt>
                <dd className="font-medium">
                  {vesselDetails.name}{" "}
                  <span className="font-mono text-muted-foreground">({vesselDetails.code})</span>
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Company</dt>
                <dd className="font-medium">{vesselDetails.company?.name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Built year</dt>
                <dd className="font-medium">
                  {vesselDetails.yearBuilt != null ? vesselDetails.yearBuilt : "Not available"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Last Intermediate Survey date</dt>
                <dd className="font-medium">
                  {formatDisplayDate(vesselDetails.lastIntermediateSurveyDate)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Docking Survey date</dt>
                <dd className="font-medium">
                  {formatDisplayDate(vesselDetails.dockingSurveyDate)}
                </dd>
              </div>
              {surveyStatus ? (
                <div
                  className={
                    surveyStatus.activeWindow === "docking"
                      ? "rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2"
                      : surveyStatus.activeWindow === "intermediate"
                        ? "rounded-md border border-sky-500/40 bg-sky-500/10 px-3 py-2"
                        : "rounded-md border bg-muted/40 px-3 py-2"
                  }
                >
                  <p className="font-medium">{surveyStatus.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{surveyStatus.message}</p>
                </div>
              ) : null}
              <div>
                <dt className="text-muted-foreground">Next dry dock due</dt>
                <dd className="font-medium">
                  {formatDisplayDate(vesselDetails.nextDryDockDue)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">IMO</dt>
                <dd className="font-mono font-medium">{vesselDetails.imoNumber ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Class society</dt>
                <dd className="font-medium">{vesselDetails.classSociety ?? "—"}</dd>
              </div>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>
    </form>
  );
}
