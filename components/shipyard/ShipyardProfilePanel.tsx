"use client";

import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";
import { YardCapacityCalendar } from "@/components/shipyard/YardCapacityCalendar";
import type { YardProfileRecord } from "@/lib/db/yardProfile";
import {
  YARD_DOCK_TYPE_OPTIONS,
  YARD_FACILITY_TYPE_OPTIONS,
} from "@/lib/shipyard/yardProfileConstants";

type ProfileForm = {
  country: string;
  port: string;
  address: string;
  website: string;
  establishedYear: string;
  repairBerths: string;
  totalEmployees: string;
  dockTypes: string[];
  docks: {
    id?: string;
    dockNo: string;
    dockType: string;
    maxLoaM: string;
    maxBeamM: string;
    maxDraftM: string;
    liftingCapacityT: string;
  }[];
  facilities: { id?: string; facilityType: string; name: string; capabilities: string }[];
  cranes: {
    id?: string;
    name: string;
    capacityT: string;
    radiusM: string;
    location: string;
    available: boolean;
  }[];
  capacitySlots: { slotLabel: string; year: number; month: number; occupancyPct: number }[];
};

function profileToForm(profile: YardProfileRecord): ProfileForm {
  return {
    country: profile.country ?? "",
    port: profile.port ?? "",
    address: profile.address ?? "",
    website: profile.website ?? "",
    establishedYear: profile.establishedYear?.toString() ?? "",
    repairBerths: profile.repairBerths?.toString() ?? "",
    totalEmployees: profile.totalEmployees?.toString() ?? "",
    dockTypes: profile.dockTypes ?? [],
    docks: profile.docks.map((d) => ({
      id: d.id,
      dockNo: d.dockNo,
      dockType: d.dockType,
      maxLoaM: d.maxLoaM?.toString() ?? "",
      maxBeamM: d.maxBeamM?.toString() ?? "",
      maxDraftM: d.maxDraftM?.toString() ?? "",
      liftingCapacityT: d.liftingCapacityT?.toString() ?? "",
    })),
    facilities: profile.facilities.map((f) => ({
      id: f.id,
      facilityType: f.facilityType,
      name: f.name,
      capabilities: f.capabilities ?? "",
    })),
    cranes: profile.cranes.map((c) => ({
      id: c.id,
      name: c.name,
      capacityT: c.capacityT?.toString() ?? "",
      radiusM: c.radiusM?.toString() ?? "",
      location: c.location ?? "",
      available: c.available,
    })),
    capacitySlots: profile.capacitySlots.map((s) => ({
      slotLabel: s.slotLabel,
      year: s.year,
      month: s.month,
      occupancyPct: s.occupancyPct,
    })),
  };
}

function parseNum(value: string): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function dockTypeLabel(value: string): string {
  return YARD_DOCK_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function ShipyardProfilePanel({ initialProfile }: { initialProfile: YardProfileRecord }) {
  const [profile, setProfile] = useState(initialProfile);
  const [form, setForm] = useState<ProfileForm>(() => profileToForm(initialProfile));
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calendarYear = new Date().getFullYear();

  const handleCapacityChange = useCallback((slotLabel: string, month: number, occupancyPct: number) => {
    setForm((prev) => {
      const slots = [...prev.capacitySlots];
      const idx = slots.findIndex(
        (s) => s.slotLabel === slotLabel && s.year === calendarYear && s.month === month,
      );
      if (idx >= 0) {
        slots[idx] = { ...slots[idx]!, occupancyPct };
      } else {
        slots.push({ slotLabel, year: calendarYear, month, occupancyPct });
      }
      return { ...prev, capacitySlots: slots };
    });
  }, [calendarYear]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/shipyard/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country: form.country || null,
          port: form.port || null,
          address: form.address || null,
          website: form.website || null,
          establishedYear: parseNum(form.establishedYear),
          repairBerths: parseNum(form.repairBerths),
          totalEmployees: parseNum(form.totalEmployees),
          dockTypes: form.dockTypes,
          docks: form.docks.map((d) => ({
            id: d.id,
            dockNo: d.dockNo,
            dockType: d.dockType,
            maxLoaM: parseNum(d.maxLoaM),
            maxBeamM: parseNum(d.maxBeamM),
            maxDraftM: parseNum(d.maxDraftM),
            liftingCapacityT: parseNum(d.liftingCapacityT),
          })),
          facilities: form.facilities.map((f) => ({
            id: f.id,
            facilityType: f.facilityType,
            name: f.name,
            capabilities: f.capabilities || null,
          })),
          cranes: form.cranes.map((c) => ({
            id: c.id,
            name: c.name,
            capacityT: parseNum(c.capacityT),
            radiusM: parseNum(c.radiusM),
            location: c.location || null,
            available: c.available,
          })),
          capacitySlots: form.capacitySlots.filter((s) => s.year === calendarYear),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setProfile(data.profile as YardProfileRecord);
      setForm(profileToForm(data.profile as YardProfileRecord));
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function toggleDockType(value: string) {
    setForm((prev) => ({
      ...prev,
      dockTypes: prev.dockTypes.includes(value)
        ? prev.dockTypes.filter((t) => t !== value)
        : [...prev.dockTypes, value],
    }));
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle>{profile.company.name}</CardTitle>
            <CardDescription>
              {profile.company.code} · Shipyard organization profile
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {editing ? (
              <>
                <Button variant="outline" onClick={() => { setForm(profileToForm(profile)); setEditing(false); }}>
                  Cancel
                </Button>
                <Button onClick={() => void handleSave()} disabled={saving}>
                  {saving ? "Saving…" : "Save profile"}
                </Button>
              </>
            ) : (
              <Button onClick={() => setEditing(true)}>Edit profile</Button>
            )}
          </div>
        </CardHeader>
        {error ? <p className="px-6 pb-2 text-sm text-destructive">{error}</p> : null}
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {editing ? (
            <>
              <div className="space-y-1">
                <Label htmlFor="country">Country</Label>
                <Input id="country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="port">Port</Label>
                <Input id="port" value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="website">Website</Label>
                <Input id="website" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label htmlFor="address">Address</Label>
                <Textarea id="address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={2} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="established">Established year</Label>
                <Input id="established" type="number" value={form.establishedYear} onChange={(e) => setForm({ ...form, establishedYear: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="berths">Repair berths</Label>
                <Input id="berths" type="number" value={form.repairBerths} onChange={(e) => setForm({ ...form, repairBerths: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="employees">Total employees</Label>
                <Input id="employees" type="number" value={form.totalEmployees} onChange={(e) => setForm({ ...form, totalEmployees: e.target.value })} />
              </div>
            </>
          ) : (
            <>
              <Field label="Country" value={profile.country} />
              <Field label="Port" value={profile.port} />
              <Field label="Website" value={profile.website} />
              <Field label="Address" value={profile.address} />
              <Field label="Established" value={profile.establishedYear?.toString()} />
              <Field label="Repair berths" value={profile.repairBerths?.toString()} />
              <Field label="Employees" value={profile.totalEmployees?.toString()} />
              <Field label="Contact" value={profile.company.contactEmail ?? profile.company.contactPhone} />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dock types</CardTitle>
          <CardDescription>Infrastructure categories available at this yard</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {YARD_DOCK_TYPE_OPTIONS.map((opt) => {
            const active = (editing ? form.dockTypes : profile.dockTypes).includes(opt.value);
            return editing ? (
              <Button
                key={opt.value}
                size="sm"
                variant={active ? "default" : "outline"}
                onClick={() => toggleDockType(opt.value)}
              >
                {opt.label}
              </Button>
            ) : active ? (
              <Badge key={opt.value} variant="secondary">
                {opt.label}
              </Badge>
            ) : null;
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Docks & berths</CardTitle>
            <CardDescription>LOA, beam, draft, and lifting capacity</CardDescription>
          </div>
          {editing ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setForm({
                  ...form,
                  docks: [
                    ...form.docks,
                    { dockNo: "", dockType: "graving_dock", maxLoaM: "", maxBeamM: "", maxDraftM: "", liftingCapacityT: "" },
                  ],
                })
              }
            >
              Add dock
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
          {editing
            ? form.docks.map((dock, i) => (
                <div key={dock.id ?? `new-${i}`} className="grid gap-2 rounded-md border p-3 sm:grid-cols-4">
                  <Input
                    placeholder="Dock No"
                    value={dock.dockNo}
                    onChange={(e) => {
                      const docks = [...form.docks];
                      docks[i] = { ...docks[i]!, dockNo: e.target.value };
                      setForm({ ...form, docks });
                    }}
                  />
                  <select
                    className="h-9 rounded-md border bg-background px-2 text-sm"
                    value={dock.dockType}
                    onChange={(e) => {
                      const docks = [...form.docks];
                      docks[i] = { ...docks[i]!, dockType: e.target.value };
                      setForm({ ...form, docks });
                    }}
                  >
                    {YARD_DOCK_TYPE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <Input
                    placeholder="LOA (m)"
                    value={dock.maxLoaM}
                    onChange={(e) => {
                      const docks = [...form.docks];
                      docks[i] = { ...docks[i]!, maxLoaM: e.target.value };
                      setForm({ ...form, docks });
                    }}
                  />
                  <Input
                    placeholder="Capacity (t)"
                    value={dock.liftingCapacityT}
                    onChange={(e) => {
                      const docks = [...form.docks];
                      docks[i] = { ...docks[i]!, liftingCapacityT: e.target.value };
                      setForm({ ...form, docks });
                    }}
                  />
                </div>
              ))
            : profile.docks.map((dock) => (
                <div key={dock.id} className="grid gap-2 rounded-md border p-3 sm:grid-cols-4">
                  <p className="font-medium">{dock.dockNo}</p>
                  <p className="text-sm text-muted-foreground">{dockTypeLabel(dock.dockType)}</p>
                  <p className="text-sm tabular-nums">LOA {dock.maxLoaM ?? "—"} m</p>
                  <p className="text-sm tabular-nums">Lift {dock.liftingCapacityT ?? "—"} t</p>
                </div>
              ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Workshops & facilities</CardTitle>
          </div>
          {editing ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setForm({
                  ...form,
                  facilities: [...form.facilities, { facilityType: "steel_workshop", name: "", capabilities: "" }],
                })
              }
            >
              Add facility
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
          {editing
            ? form.facilities.map((f, i) => (
                <div key={f.id ?? `fac-${i}`} className="rounded-md border p-3 text-sm">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      placeholder="Name"
                      value={f.name}
                      onChange={(e) => {
                        const facilities = [...form.facilities];
                        facilities[i] = { ...facilities[i]!, name: e.target.value };
                        setForm({ ...form, facilities });
                      }}
                    />
                    <select
                      className="h-9 rounded-md border bg-background px-2 text-sm"
                      value={f.facilityType}
                      onChange={(e) => {
                        const facilities = [...form.facilities];
                        facilities[i] = { ...facilities[i]!, facilityType: e.target.value };
                        setForm({ ...form, facilities });
                      }}
                    >
                      {YARD_FACILITY_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <Textarea
                      className="sm:col-span-2"
                      placeholder="Capabilities"
                      value={f.capabilities}
                      onChange={(e) => {
                        const facilities = [...form.facilities];
                        facilities[i] = { ...facilities[i]!, capabilities: e.target.value };
                        setForm({ ...form, facilities });
                      }}
                      rows={2}
                    />
                  </div>
                </div>
              ))
            : profile.facilities.map((f) => (
                <div key={f.id} className="rounded-md border p-3 text-sm">
                  <p className="font-medium">{f.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {YARD_FACILITY_TYPE_OPTIONS.find((o) => o.value === f.facilityType)?.label ?? f.facilityType}
                  </p>
                  {f.capabilities ? <p className="mt-1 text-muted-foreground">{f.capabilities}</p> : null}
                </div>
              ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-base">Cranes</CardTitle>
          </div>
          {editing ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setForm({
                  ...form,
                  cranes: [...form.cranes, { name: "", capacityT: "", radiusM: "", location: "", available: true }],
                })
              }
            >
              Add crane
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {editing
            ? form.cranes.map((c, i) => (
                <div key={c.id ?? `crane-${i}`} className="rounded-md border p-3 text-sm">
                  <div className="space-y-2">
                    <Input
                      placeholder="Name"
                      value={c.name}
                      onChange={(e) => {
                        const cranes = [...form.cranes];
                        cranes[i] = { ...cranes[i]!, name: e.target.value };
                        setForm({ ...form, cranes });
                      }}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Capacity (t)"
                        value={c.capacityT}
                        onChange={(e) => {
                          const cranes = [...form.cranes];
                          cranes[i] = { ...cranes[i]!, capacityT: e.target.value };
                          setForm({ ...form, cranes });
                        }}
                      />
                      <Input
                        placeholder="Radius (m)"
                        value={c.radiusM}
                        onChange={(e) => {
                          const cranes = [...form.cranes];
                          cranes[i] = { ...cranes[i]!, radiusM: e.target.value };
                          setForm({ ...form, cranes });
                        }}
                      />
                    </div>
                    <Input
                      placeholder="Location"
                      value={c.location}
                      onChange={(e) => {
                        const cranes = [...form.cranes];
                        cranes[i] = { ...cranes[i]!, location: e.target.value };
                        setForm({ ...form, cranes });
                      }}
                    />
                  </div>
                </div>
              ))
            : profile.cranes.map((c) => (
                <div key={c.id} className="rounded-md border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{c.name}</p>
                    <Badge variant={c.available ? "secondary" : "outline"}>
                      {c.available ? "Available" : "Unavailable"}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground">
                    {c.capacityT ?? "—"} t · {c.radiusM ?? "—"} m radius · {c.location ?? "—"}
                  </p>
                </div>
              ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dry dock capacity calendar</CardTitle>
          <CardDescription>Monthly occupancy grid per dock/berth ({calendarYear})</CardDescription>
        </CardHeader>
        <CardContent>
          {saving ? (
            <ActiniumLoadingState label="Saving…" size="sm" />
          ) : (
            <YardCapacityCalendar
              slots={editing ? form.capacitySlots : profile.capacitySlots}
              year={calendarYear}
              editable={editing}
              onCellChange={handleCapacityChange}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value?.trim() ? value : "—"}</p>
    </div>
  );
}
