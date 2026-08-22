"use client";

import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LabeledSelect } from "@/components/ui/LabeledSelect";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { InputSubmissionDto } from "@/lib/db/superintendent/inputs";
import { notify } from "@/lib/notify";
import {
  SEA_VALVE_GROUPS,
  SEA_VALVE_OVERHAUL_LOCATIONS,
  SEA_VALVE_SPEC_OPTIONS,
  countSeaValveOverhaul,
  createSeaValveRow,
  parseSeaValveRows,
  type SeaValveGroupKey,
  type SeaValveOverhaulLocation,
  type SeaValveRow,
} from "@/lib/superintendent/seaValves";

type OverhaulFilter = "all" | SeaValveOverhaulLocation;

type Props = {
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  dryDockProjectId: string;
  disabled?: boolean;
  onImported?: (submission: InputSubmissionDto) => void;
};

const SPEC_ITEMS = SEA_VALVE_SPEC_OPTIONS.map((o) => ({ value: o.value, label: o.label }));
const OVERHAUL_ITEMS = SEA_VALVE_OVERHAUL_LOCATIONS.map((o) => ({
  value: o.value,
  label: o.label,
}));

function specItemsFor(spec: string) {
  if (spec && !SPEC_ITEMS.some((item) => item.value === spec)) {
    return [...SPEC_ITEMS, { value: spec, label: spec }];
  }
  return SPEC_ITEMS;
}

export function SeaValvesPanel({
  values,
  onChange,
  dryDockProjectId,
  disabled,
  onImported,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [loadingPrevious, setLoadingPrevious] = useState(false);
  const [filter, setFilter] = useState<OverhaulFilter>("all");

  const valves = useMemo(() => parseSeaValveRows(values.valves), [values.valves]);
  const counts = useMemo(() => countSeaValveOverhaul(valves), [valves]);
  const notes = values.notes == null ? "" : String(values.notes);

  function setValves(next: SeaValveRow[]) {
    onChange("valves", next);
  }

  function updateRow(id: string, patch: Partial<SeaValveRow>) {
    setValves(valves.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function addValve(group: SeaValveGroupKey) {
    const row = createSeaValveRow(group);
    if (filter !== "all") row.overhaulLocation = filter;
    setValves([...valves, row]);
  }

  function removeValve(id: string) {
    setValves(valves.filter((row) => row.id !== id));
  }

  async function onUpload(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("valves", JSON.stringify(valves));
    try {
      const res = await fetch(
        `/api/superintendent/projects/${dryDockProjectId}/inputs/sea-valves/import`,
        {
          method: "POST",
          body: fd,
          cache: "no-store",
        },
      );
      const data = (await res.json()) as {
        error?: string;
        message?: string;
        valves?: SeaValveRow[];
        submission?: InputSubmissionDto;
      };
      if (!res.ok) {
        notify.error(data.error ?? "Import failed");
        return;
      }
      if (Array.isArray(data.valves)) setValves(data.valves);
      if (data.submission) onImported?.(data.submission);
      notify.success(data.message ?? "Sea valves imported");
    } catch {
      notify.error("Import failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function loadPrevious() {
    setLoadingPrevious(true);
    try {
      const res = await fetch(
        `/api/superintendent/projects/${dryDockProjectId}/inputs/sea-valves/previous`,
        { cache: "no-store" },
      );
      const data = (await res.json()) as {
        error?: string;
        valves?: SeaValveRow[];
        project?: { name: string; referenceCode: string | null } | null;
      };
      if (!res.ok) {
        notify.error(data.error ?? "Could not load previous dry dock valves");
        return;
      }
      const next = data.valves ?? [];
      if (next.length === 0) {
        notify.info("No sea valves found on a previous dry dock for this vessel.");
        return;
      }
      setValves(next);
      const projectLabel = data.project?.referenceCode || data.project?.name || "previous dry dock";
      notify.success(`Loaded ${next.length} valve(s) from ${projectLabel}. Add or remove as needed.`);
    } catch {
      notify.error("Could not load previous dry dock valves");
    } finally {
      setLoadingPrevious(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium">Overhaul counts</p>
          <p className="text-xs text-muted-foreground">
            Derived from valve rows. Add overboard / sea valves by group. Rows stay on this dry
            dock until deleted.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["all", `All: ${counts.total}`],
              ["in_situ", `In situ: ${counts.inSitu}`],
              ["workshop", `Workshop: ${counts.workshop}`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums ${
                filter === key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {!disabled ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            render={
              <a
                href={`/api/superintendent/projects/${dryDockProjectId}/inputs/sea-valves/template`}
              />
            }
            nativeButton={false}
          >
            Download Excel template
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onUpload(file);
            }}
          />
          <Button size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? "Importing…" : "Upload Excel"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={loadingPrevious}
            onClick={() => void loadPrevious()}
          >
            {loadingPrevious ? "Loading…" : "Load from last dry dock"}
          </Button>
        </div>
      ) : null}

      {SEA_VALVE_GROUPS.map((group) => {
        const rows = valves.filter((row) => {
          if (row.group !== group.key) return false;
          if (filter === "all") return true;
          return row.overhaulLocation === filter;
        });
        return (
          <div key={group.key} className="space-y-2 rounded-lg border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{group.label}</p>
                <p className="text-xs text-muted-foreground tabular-nums">
                  {rows.length === 0 ? "No valves yet" : `${rows.length} valve(s)`}
                </p>
              </div>
              {!disabled ? (
                <Button type="button" variant="outline" size="sm" onClick={() => addValve(group.key)}>
                  Add valve
                </Button>
              ) : null}
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[10rem]">Specification / type</TableHead>
                    <TableHead className="min-w-[9rem]">Overhaul</TableHead>
                    <TableHead className="min-w-[10rem]">Location / line</TableHead>
                    <TableHead className="min-w-[8rem]">Condition / leakage</TableHead>
                    {!disabled ? <TableHead className="w-[4.5rem]" /> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={disabled ? 4 : 5}
                        className="py-4 text-muted-foreground whitespace-normal"
                      >
                        Add valves one by one, or import from Excel.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="align-top">
                          <SearchableSelect
                            id={`sea-valve-spec-${row.id}`}
                            items={specItemsFor(row.spec)}
                            value={row.spec}
                            onValueChange={(spec) => updateRow(row.id, { spec })}
                            placeholder="Search spec…"
                            searchPlaceholder="Search or type custom…"
                            allowCustom
                            disabled={disabled}
                            className="min-w-0"
                            menuClassName="min-w-[16rem]"
                          />
                        </TableCell>
                        <TableCell className="align-top">
                          <LabeledSelect
                            id={`sea-valve-overhaul-${row.id}`}
                            items={OVERHAUL_ITEMS}
                            value={row.overhaulLocation}
                            onValueChange={(overhaulLocation) =>
                              updateRow(row.id, {
                                overhaulLocation: overhaulLocation as SeaValveOverhaulLocation | "",
                              })
                            }
                            placeholder="Select…"
                            disabled={disabled}
                            className="min-w-0 w-full"
                          />
                        </TableCell>
                        <TableCell className="align-top">
                          <Input
                            className="h-8"
                            value={row.locationName}
                            onChange={(e) => updateRow(row.id, { locationName: e.target.value })}
                            placeholder="e.g. ME SW overboard P"
                            disabled={disabled}
                          />
                        </TableCell>
                        <TableCell className="align-top">
                          <Input
                            className="h-8"
                            value={row.notes}
                            onChange={(e) => updateRow(row.id, { notes: e.target.value })}
                            placeholder="Optional"
                            disabled={disabled}
                          />
                        </TableCell>
                        {!disabled ? (
                          <TableCell className="align-top">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeValve(row.id)}
                            >
                              Remove
                            </Button>
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        );
      })}

      <div>
        <Label htmlFor="field-sea-valve-notes">Notes</Label>
        <Textarea
          id="field-sea-valve-notes"
          className="mt-1.5"
          rows={3}
          value={notes}
          onChange={(e) => onChange("notes", e.target.value)}
          placeholder="Optional section notes for the yard"
          disabled={disabled}
        />
      </div>
    </div>
  );
}
