"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  PAINTING_AREA_DEFS,
  PAINTING_HULL_ZONE_FIELDS,
  hullHasZoneArea,
  parsePaintingAreas,
  serializePaintingAreas,
  visiblePaintingAreaIds,
  type PaintingAreaEntry,
  type PaintingAreaId,
} from "@/lib/superintendent/paintingCoating";

type Props = {
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  disabled?: boolean;
  vesselType?: string | null;
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

export function PaintingCoatingPanel({ values, onChange, disabled, vesselType }: Props) {
  const areas = parsePaintingAreas(values);
  const visibleIds = visiblePaintingAreaIds(vesselType);

  const writeAreas = (next: ReturnType<typeof parsePaintingAreas>, nextValues = values) => {
    onChange("areas", serializePaintingAreas(next, { hullZonesPresent: hullHasZoneArea(nextValues) }));
  };

  const patchArea = (id: PaintingAreaId, patch: Partial<PaintingAreaEntry>) => {
    const next = parsePaintingAreas(values);
    next[id] = { ...next[id], ...patch };
    writeAreas(next);
  };

  const onHullZoneChange = (key: string, raw: string) => {
    const nextVal = toNumberOrNull(raw);
    onChange(key, nextVal);
    const nextValues = { ...values, [key]: nextVal };
    const nextAreas = parsePaintingAreas(nextValues);
    if (hullHasZoneArea(nextValues) && nextAreas.hull.included) {
      writeAreas(nextAreas, nextValues);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium">Paint scheme and DFT</p>
          <p className="text-xs text-muted-foreground">
            Current system on board and owner / class DFT. Areas below are optional — include only
            what the shipyard should paint.
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
                  onCheckedChange={(v) => patchArea(id, { included: v === true })}
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
                disabled={disabled}
                onPatch={(patch) => patchArea(id, patch)}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function IncludedAreaFields({
  id,
  entry,
  showAreaM2,
  disabled,
  onPatch,
}: {
  id: PaintingAreaId;
  entry: PaintingAreaEntry;
  showAreaM2: boolean;
  disabled?: boolean;
  onPatch: (patch: Partial<PaintingAreaEntry>) => void;
}) {
  return (
    <div className="space-y-3">
      <div className={`grid gap-3 ${showAreaM2 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"}`}>
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
          onChange={(e) => onPatch({ paintSystem: e.target.value.trim() ? e.target.value : null })}
          placeholder="Optional — e.g. epoxy primer + polyurethane finish"
          disabled={disabled}
        />
      </div>
    </div>
  );
}
