"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LabeledSelect } from "@/components/ui/LabeledSelect";
import { SearchableMultiSelect } from "@/components/ui/SearchableMultiSelect";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import {
  TANK_INSPECTION_FAMILY_OPTIONS,
  TANK_INSPECTION_LOCATION_OPTIONS,
  createEmptyTankInspectionLine,
  type TankInspectionLine,
  type TankInspectionScope,
} from "@/lib/superintendent/tankInspectionScope";
import { TANK_JOB_OPTIONS } from "@/lib/superintendent/tankCondition";

const LOCATION_ITEMS = TANK_INSPECTION_LOCATION_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}));

const FAMILY_ITEMS = TANK_INSPECTION_FAMILY_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}));

const JOB_ITEMS = TANK_JOB_OPTIONS.map((o) => ({ value: o.value, label: o.label }));

type Props = {
  scope: TankInspectionScope;
  onChange: (scope: TankInspectionScope) => void;
  disabled?: boolean;
};

function numberValue(value: number | null): string {
  return value == null ? "" : String(value);
}

function toNumberOrNull(raw: string): number | null {
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function TankLineCard({
  line,
  index,
  disabled,
  onPatch,
  onRemove,
  canRemove,
}: {
  line: TankInspectionLine;
  index: number;
  disabled?: boolean;
  onPatch: (patch: Partial<TankInspectionLine>) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  return (
    <div className="space-y-3 rounded-lg border bg-background p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Tank {index + 1}</p>
        {!disabled ? (
          <Button type="button" variant="ghost" size="sm" onClick={onRemove} disabled={!canRemove}>
            Remove
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`ti-family-${line.id}`}>Tank family</Label>
          <LabeledSelect
            items={FAMILY_ITEMS}
            value={line.tankFamily}
            onValueChange={(v) => onPatch({ tankFamily: (v || "") as TankInspectionLine["tankFamily"] })}
            disabled={disabled}
            placeholder="Select family…"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`ti-location-${line.id}`}>Location / tank name *</Label>
          <SearchableSelect
            id={`ti-location-${line.id}`}
            items={LOCATION_ITEMS}
            value={line.location}
            onValueChange={(location) => onPatch({ location })}
            placeholder="e.g. COT 2P, Fore peak WBT…"
            searchPlaceholder="Search tanks…"
            disabled={disabled}
            allowCustom
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`ti-jobs-${line.id}`}>Planned work *</Label>
        <SearchableMultiSelect
          id={`ti-jobs-${line.id}`}
          items={JOB_ITEMS}
          values={line.inspectionTypes}
          onValuesChange={(inspectionTypes) => onPatch({ inspectionTypes })}
          placeholder="Inspection, cleaning, gas freeing, coating…"
          searchPlaceholder="Search job types…"
          disabled={disabled}
        />
        <p className="text-xs text-muted-foreground">
          Aligns with vessel tank condition and DD-TPL-22: gas free, clean, inspect structure, UTM,
          coating repair, final inspection.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={line.gasFreeRequired}
            disabled={disabled}
            onCheckedChange={(v) => onPatch({ gasFreeRequired: v === true })}
          />
          <span>Gas free required</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={line.cap1Required}
            disabled={disabled}
            onCheckedChange={(v) => onPatch({ cap1Required: v === true })}
          />
          <span>CAP 1 (close-up)</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={line.cap2Required}
            disabled={disabled}
            onCheckedChange={(v) => onPatch({ cap2Required: v === true })}
          />
          <span>CAP 2</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={line.capCertificationRequired}
            disabled={disabled}
            onCheckedChange={(v) => onPatch({ capCertificationRequired: v === true })}
          />
          <span>CAP certification</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={line.classAttendance}
            disabled={disabled}
            onCheckedChange={(v) => onPatch({ classAttendance: v === true })}
          />
          <span>Class attendance</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={line.coatingRenewal}
            disabled={disabled}
            onCheckedChange={(v) =>
              onPatch({
                coatingRenewal: v === true,
                coatingPercent: v === true ? line.coatingPercent : null,
              })
            }
          />
          <span>Coating renewal</span>
        </label>
      </div>

      {line.coatingRenewal ? (
        <div className="max-w-xs space-y-1.5">
          <Label htmlFor={`ti-coating-${line.id}`}>Coating renewal area (%)</Label>
          <div className="flex items-center gap-2">
            <Input
              id={`ti-coating-${line.id}`}
              type="number"
              min={0}
              max={100}
              className="tabular-nums"
              value={numberValue(line.coatingPercent)}
              onChange={(e) => onPatch({ coatingPercent: toNumberOrNull(e.target.value) })}
              disabled={disabled}
            />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor={`ti-class-${line.id}`}>Class requirement</Label>
        <Input
          id={`ti-class-${line.id}`}
          value={line.classRequirement}
          onChange={(e) => onPatch({ classRequirement: e.target.value })}
          placeholder="Survey item, coating min, pressure test, etc."
          disabled={disabled}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`ti-condition-${line.id}`}>Condition / inspection notes</Label>
        <Textarea
          id={`ti-condition-${line.id}`}
          rows={2}
          value={line.conditionNotes}
          onChange={(e) => onPatch({ conditionNotes: e.target.value })}
          placeholder="Coating breakdown, corrosion, pitting, stiffeners, ladders, anodes…"
          disabled={disabled}
        />
      </div>
    </div>
  );
}

export function TankInspectionScopePanel({ scope, onChange, disabled }: Props) {
  const rows = scope.lines.length > 0 ? scope.lines : [createEmptyTankInspectionLine()];

  useEffect(() => {
    if (scope.lines.length === 0 && !disabled) {
      onChange({ ...scope, lines: [createEmptyTankInspectionLine()] });
    }
  }, [scope.lines.length, disabled, onChange, scope]);

  function updateLine(id: string, patch: Partial<TankInspectionLine>) {
    onChange({
      ...scope,
      lines: scope.lines.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    });
  }

  function addLine() {
    onChange({
      ...scope,
      lines: [...scope.lines, createEmptyTankInspectionLine()],
    });
  }

  function removeLine(id: string) {
    onChange({
      ...scope,
      lines: scope.lines.filter((line) => line.id !== id),
    });
  }

  return (
    <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
      <div>
        <p className="text-sm font-medium">Tank inspection scope *</p>
        <p className="text-xs text-muted-foreground">
          Per-tank scope for yard RFQ: locations, planned work (inspection, cleaning, gas freeing,
          coating, UTM, CAP survey), CAP 1/2, class requirements, and condition notes — aligned with
          vessel tank condition input and DD-TPL-22.
        </p>
      </div>

      <div className="space-y-3">
        {rows.map((line, index) => (
          <TankLineCard
            key={line.id}
            line={line}
            index={index}
            disabled={disabled}
            onPatch={(patch) => updateLine(line.id, patch)}
            onRemove={() => removeLine(line.id)}
            canRemove={rows.length > 1}
          />
        ))}
      </div>

      {!disabled ? (
        <Button type="button" size="sm" variant="outline" onClick={addLine}>
          Add tank
        </Button>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="tank-inspection-notes">General scope notes</Label>
        <Textarea
          id="tank-inspection-notes"
          rows={3}
          value={scope.notes}
          onChange={(e) => onChange({ ...scope, notes: e.target.value })}
          placeholder="Tank plan reference, dehumidification, ventilation, enclosed-space permits, staging…"
          disabled={disabled}
        />
      </div>
    </div>
  );
}
