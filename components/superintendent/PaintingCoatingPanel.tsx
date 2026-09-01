"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { Textarea } from "@/components/ui/textarea";
import {
  createEmptyHullTreatment,
  createEmptyHullZoneScope,
  HULL_TREATMENT_TYPE_OPTIONS,
  PAINTING_AREA_DEFS,
  PAINTING_HULL_ZONE_FIELDS,
  hullHasZoneArea,
  parsePaintingAreas,
  seedHullZones,
  serializePaintingAreas,
  visiblePaintingAreaIds,
  type HullTreatmentAssignment,
  type HullZoneScope,
  type PaintingAreaEntry,
  type PaintingAreaId,
  type PaintingHullZoneKey,
} from "@/lib/superintendent/paintingCoating";
import { parsePaintingJobIds } from "@/lib/superintendent/paintingScopeJobs";
import { PaintingScopeJobLinks } from "@/components/superintendent/PaintingScopeJobLinks";

type Props = {
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  /** Atomic multi-key updates so nested `areas` patches cannot clobber each other. */
  onPatchValues?: (updater: (prev: Record<string, unknown>) => Record<string, unknown>) => void;
  disabled?: boolean;
  vesselType?: string | null;
  dryDockProjectId?: string;
};

function textValue(value: unknown): string {
  return value == null ? "" : String(value);
}

function numberValue(value: unknown): string {
  return value == null || value === "" ? "" : String(value);
}

function toNumberOrNull(raw: string): number | null {
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

const HULL_TREATMENT_ITEMS = HULL_TREATMENT_TYPE_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}));

export function PaintingCoatingPanel({
  values,
  onChange,
  onPatchValues,
  disabled,
  vesselType,
  dryDockProjectId,
}: Props) {
  const areas = parsePaintingAreas(values);
  const visibleIds = visiblePaintingAreaIds(vesselType);
  const jobIds = parsePaintingJobIds(values);

  const patchValues = (updater: (prev: Record<string, unknown>) => Record<string, unknown>) => {
    if (onPatchValues) {
      onPatchValues(updater);
      return;
    }
    const next = updater({ ...values });
    for (const [key, value] of Object.entries(next)) {
      if (!Object.is(values[key], value)) onChange(key, value);
    }
  };

  const writeAreasFrom = (prev: Record<string, unknown>, next: ReturnType<typeof parsePaintingAreas>) => {
    return {
      ...prev,
      areas: serializePaintingAreas(next, { hullZonesPresent: hullHasZoneArea(prev) }),
    };
  };

  const patchArea = (id: PaintingAreaId, patch: Partial<PaintingAreaEntry>) => {
    patchValues((prev) => {
      const next = parsePaintingAreas(prev);
      next[id] = { ...next[id], ...patch };
      return writeAreasFrom(prev, next);
    });
  };

  const onHullZoneChange = (key: string, raw: string) => {
    const nextVal = toNumberOrNull(raw);
    patchValues((prev) => {
      const nextValues = { ...prev, [key]: nextVal };
      const nextAreas = parsePaintingAreas(nextValues);
      if (hullHasZoneArea(nextValues) && nextAreas.hull.included) {
        return writeAreasFrom(nextValues, nextAreas);
      }
      return nextValues;
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium">Paint scheme and DFT</p>
          <p className="text-xs text-muted-foreground">
            Current system on board and owner / class DFT. Areas below are optional — include only
            what the shipyard should paint. Hull zones each have their own treatments and coat
            scheme.
          </p>
        </div>
        <div>
          <Label htmlFor="field-currentPaintScheme">Current paint scheme</Label>
          <Textarea
            id="field-currentPaintScheme"
            className="mt-1.5"
            rows={3}
            value={textValue(values.currentPaintScheme)}
            onChange={(e) => onChange("currentPaintScheme", e.target.value)}
            placeholder="Maker / product / last applied system"
            disabled={disabled}
          />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label htmlFor="field-antifoulingType">Antifouling type</Label>
            <Input
              id="field-antifoulingType"
              className="mt-1.5"
              value={textValue(values.antifoulingType)}
              onChange={(e) => onChange("antifoulingType", e.target.value)}
              placeholder="e.g. SPC, silyl acrylate"
              disabled={disabled}
            />
          </div>
          <div>
            <Label htmlFor="field-dftRequirement">DFT requirement (owner / class)</Label>
            <div className="mt-1.5 flex items-center gap-2">
              <Input
                id="field-dftRequirement"
                value={textValue(values.dftRequirement)}
                onChange={(e) => onChange("dftRequirement", e.target.value)}
                placeholder="e.g. 320"
                disabled={disabled}
              />
              <span className="shrink-0 text-sm text-muted-foreground">µm</span>
            </div>
          </div>
        </div>
        <div>
          <Label htmlFor="field-areaNotes">Additional area notes</Label>
          <Textarea
            id="field-areaNotes"
            className="mt-1.5"
            rows={3}
            value={textValue(values.areaNotes)}
            onChange={(e) => onChange("areaNotes", e.target.value)}
            placeholder="Stripe coat, anodes, owner specification references"
            disabled={disabled}
          />
        </div>
      </div>

      {visibleIds.map((id) => {
        const def = PAINTING_AREA_DEFS.find((d) => d.id === id)!;
        const entry = areas[id];
        return (
          <div key={id} className="space-y-3 rounded-lg border p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{def.label}</p>
                <p className="text-xs text-muted-foreground">{def.hint}</p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  id={`paint-include-${id}`}
                  checked={entry.included}
                  disabled={disabled}
                  onCheckedChange={(v) => {
                    const included = v === true;
                    const patch: Partial<PaintingAreaEntry> = { included };
                    if (included && id === "hull") {
                      patch.hullZones = seedHullZones(entry.hullZones);
                    }
                    patchArea(id, patch);
                  }}
                />
                <span>Include this area</span>
              </label>
            </div>

            {def.hasZoneAreas ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {PAINTING_HULL_ZONE_FIELDS.map((zone) => (
                  <div key={zone.key}>
                    <Label htmlFor={`field-${zone.key}`}>{zone.label}</Label>
                    <div className="mt-1.5 flex items-center gap-2">
                      <Input
                        id={`field-${zone.key}`}
                        type="number"
                        min={0}
                        step="any"
                        inputMode="decimal"
                        className="tabular-nums"
                        value={numberValue(values[zone.key])}
                        onChange={(e) => onHullZoneChange(zone.key, e.target.value)}
                        disabled={disabled}
                      />
                      <span className="shrink-0 text-sm text-muted-foreground">m²</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {entry.included ? (
              <IncludedAreaFields
                id={id}
                entry={entry}
                showAreaM2={def.hasAreaM2}
                isHull={id === "hull"}
                disabled={disabled}
                scopeJobId={jobIds[id]}
                onPatch={(patch) => patchArea(id, patch)}
              />
            ) : null}
          </div>
        );
      })}

      {dryDockProjectId ? (
        <PaintingScopeJobLinks values={values} dryDockProjectId={dryDockProjectId} />
      ) : null}
    </div>
  );
}

function HullZoneScopeEditor({
  zoneKey,
  zoneLabel,
  scope,
  disabled,
  onChange,
}: {
  zoneKey: PaintingHullZoneKey;
  zoneLabel: string;
  scope: HullZoneScope;
  disabled?: boolean;
  onChange: (scope: HullZoneScope) => void;
}) {
  function updateTreatments(treatments: HullTreatmentAssignment[]) {
    onChange({ ...scope, treatments });
  }

  function updateRow(rowId: string, patch: Partial<HullTreatmentAssignment>) {
    updateTreatments(scope.treatments.map((r) => (r.id === rowId ? { ...r, ...patch } : r)));
  }

  return (
    <div className="space-y-3 rounded-md border bg-background p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{zoneLabel}</p>
          <p className="text-xs text-muted-foreground">
            Treatments and yard % for this zone only (e.g. SA 2 — 35%).
          </p>
        </div>
        {!disabled ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              updateTreatments([...scope.treatments, createEmptyHullTreatment()])
            }
          >
            Add treatment
          </Button>
        ) : null}
      </div>

      {scope.treatments.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No treatments yet — click Add treatment for {zoneLabel.toLowerCase()}.
        </p>
      ) : (
        <ul className="space-y-2">
          {scope.treatments.map((row) => (
            <li
              key={row.id}
              className="grid gap-2 rounded-md border bg-muted/10 p-2 sm:grid-cols-[1fr_7rem_auto]"
            >
              <div>
                <Label htmlFor={`paint-hull-${zoneKey}-treatment-${row.id}`} className="sr-only">
                  Treatment type
                </Label>
                <SearchableSelect
                  id={`paint-hull-${zoneKey}-treatment-${row.id}`}
                  items={HULL_TREATMENT_ITEMS}
                  value={row.treatmentType}
                  onValueChange={(treatmentType) => updateRow(row.id, { treatmentType })}
                  placeholder="Type or pick treatment…"
                  searchPlaceholder="SA1, SA2, HP wash…"
                  allowCustom
                  disabled={disabled}
                />
              </div>
              <div>
                <Label htmlFor={`paint-hull-${zoneKey}-pct-${row.id}`} className="sr-only">
                  % of zone area
                </Label>
                <div className="flex items-center gap-1.5">
                  <Input
                    id={`paint-hull-${zoneKey}-pct-${row.id}`}
                    type="number"
                    min={0}
                    max={100}
                    step="any"
                    inputMode="decimal"
                    className="tabular-nums"
                    value={numberValue(row.percentYard)}
                    onChange={(e) =>
                      updateRow(row.id, { percentYard: toNumberOrNull(e.target.value) })
                    }
                    disabled={disabled}
                  />
                  <span className="shrink-0 text-sm text-muted-foreground">%</span>
                </div>
              </div>
              {!disabled ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="self-end"
                  onClick={() =>
                    updateTreatments(scope.treatments.filter((r) => r.id !== row.id))
                  }
                >
                  Remove
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor={`paint-hull-${zoneKey}-primer`}>Primer coats *</Label>
          <Input
            id={`paint-hull-${zoneKey}-primer`}
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            className="mt-1.5 tabular-nums"
            value={numberValue(scope.primerCoats)}
            onChange={(e) =>
              onChange({ ...scope, primerCoats: toNumberOrNull(e.target.value) })
            }
            disabled={disabled}
          />
        </div>
        <div>
          <Label htmlFor={`paint-hull-${zoneKey}-finish`}>Finish coats *</Label>
          <Input
            id={`paint-hull-${zoneKey}-finish`}
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            className="mt-1.5 tabular-nums"
            value={numberValue(scope.finishCoats)}
            onChange={(e) =>
              onChange({ ...scope, finishCoats: toNumberOrNull(e.target.value) })
            }
            disabled={disabled}
          />
        </div>
      </div>
      <div>
        <Label htmlFor={`paint-hull-${zoneKey}-system`}>Paint system / product</Label>
        <Input
          id={`paint-hull-${zoneKey}-system`}
          className="mt-1.5"
          value={scope.paintSystem}
          onChange={(e) => onChange({ ...scope, paintSystem: e.target.value })}
          placeholder="Optional — e.g. epoxy primer + AF finish"
          disabled={disabled}
        />
      </div>
    </div>
  );
}

function IncludedAreaFields({
  id,
  entry,
  showAreaM2,
  isHull,
  disabled,
  scopeJobId,
  onPatch,
}: {
  id: PaintingAreaId;
  entry: PaintingAreaEntry;
  showAreaM2: boolean;
  isHull?: boolean;
  disabled?: boolean;
  scopeJobId?: string;
  onPatch: (patch: Partial<PaintingAreaEntry>) => void;
}) {
  function patchZoneScope(zoneKey: PaintingHullZoneKey, scope: HullZoneScope) {
    onPatch({
      hullZones: {
        ...entry.hullZones,
        [zoneKey]: scope,
      },
    });
  }

  return (
    <div className="space-y-3">
      {isHull ? (
        <div className="space-y-3 rounded-md border bg-muted/20 p-3">
          <div>
            <p className="text-sm font-medium">Hull scope by zone *</p>
            <p className="text-xs text-muted-foreground">
              Flat bottom, vertical bottom, boot top, and topside — each with its own treatments,
              yard %, primer/finish coats, and paint system.
            </p>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {PAINTING_HULL_ZONE_FIELDS.map((zone) => (
              <HullZoneScopeEditor
                key={zone.key}
                zoneKey={zone.key}
                zoneLabel={zone.label}
                scope={entry.hullZones[zone.key] ?? createEmptyHullZoneScope()}
                disabled={disabled}
                onChange={(scope) => patchZoneScope(zone.key, scope)}
              />
            ))}
          </div>
        </div>
      ) : (
        <>
          <div
            className={`grid gap-3 ${showAreaM2 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"}`}
          >
            {showAreaM2 ? (
              <div>
                <Label htmlFor={`paint-${id}-areaM2`}>Area (if known)</Label>
                <div className="mt-1.5 flex items-center gap-2">
                  <Input
                    id={`paint-${id}-areaM2`}
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    className="tabular-nums"
                    value={numberValue(entry.areaM2)}
                    onChange={(e) => onPatch({ areaM2: toNumberOrNull(e.target.value) })}
                    disabled={disabled}
                  />
                  <span className="shrink-0 text-sm text-muted-foreground">m²</span>
                </div>
              </div>
            ) : null}
            <div>
              <Label htmlFor={`paint-${id}-percentYard`}>% of this area for yard painting *</Label>
              <div className="mt-1.5 flex items-center gap-2">
                <Input
                  id={`paint-${id}-percentYard`}
                  type="number"
                  min={0}
                  max={100}
                  step="any"
                  inputMode="decimal"
                  className="tabular-nums"
                  value={numberValue(entry.percentYard)}
                  onChange={(e) => onPatch({ percentYard: toNumberOrNull(e.target.value) })}
                  disabled={disabled}
                />
                <span className="shrink-0 text-sm text-muted-foreground">%</span>
              </div>
            </div>
            <div>
              <Label htmlFor={`paint-${id}-primerCoats`}>Primer coats *</Label>
              <Input
                id={`paint-${id}-primerCoats`}
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                className="mt-1.5 tabular-nums"
                value={numberValue(entry.primerCoats)}
                onChange={(e) => onPatch({ primerCoats: toNumberOrNull(e.target.value) })}
                disabled={disabled}
              />
            </div>
            <div>
              <Label htmlFor={`paint-${id}-finishCoats`}>Finish coats *</Label>
              <Input
                id={`paint-${id}-finishCoats`}
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                className="mt-1.5 tabular-nums"
                value={numberValue(entry.finishCoats)}
                onChange={(e) => onPatch({ finishCoats: toNumberOrNull(e.target.value) })}
                disabled={disabled}
              />
            </div>
          </div>
          <div>
            <Label htmlFor={`paint-${id}-paintSystem`}>Paint system / product</Label>
            <Input
              id={`paint-${id}-paintSystem`}
              className="mt-1.5"
              value={entry.paintSystem ?? ""}
              onChange={(e) =>
                onPatch({ paintSystem: e.target.value.trim() ? e.target.value : null })
              }
              placeholder="Optional — e.g. epoxy primer + polyurethane finish"
              disabled={disabled}
            />
          </div>
        </>
      )}
      {scopeJobId ? (
        <p className="text-xs text-muted-foreground">
          Scope job:{" "}
          <Link href={`/superintendent/jobs/${scopeJobId}/edit`} className="text-primary hover:underline">
            view / edit on Scope of work
          </Link>
        </p>
      ) : null}
    </div>
  );
}
