"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LabeledSelect } from "@/components/ui/LabeledSelect";
import { SearchableMultiSelect } from "@/components/ui/SearchableMultiSelect";
import {
  InputPhotosOverview,
  parseInputPhotos,
} from "@/components/superintendent/InputPhotosOverview";
import {
  HULL_AREA_FIELDS,
  HULL_CONDITION_OPTIONS,
  LOAD_LINE_WORK_OPTIONS,
  draftMarksTotal,
  parseHullConditionValues,
} from "@/lib/superintendent/hullCondition";

type Props = {
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  disabled?: boolean;
};

const CONDITION_ITEMS = HULL_CONDITION_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}));

function numberValue(value: unknown): string {
  return value == null || value === "" ? "" : String(value);
}

function yesNoValue(value: unknown): string {
  if (value === true || value === "true") return "true";
  if (value === false || value === "false") return "false";
  return "";
}

export function HullConditionPanel({ values, onChange, disabled }: Props) {
  const total = draftMarksTotal(values);
  const loadLineWork = values.loadLineWork == null ? "" : String(values.loadLineWork);

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium">Hull areas *</p>
          <p className="text-xs text-muted-foreground">
            Flat bottom, vertical bottom, and boot top are mandatory. Search and select
            condition(s) for each area — do not type free text.
          </p>
        </div>
        <div className="grid gap-3">
          {HULL_AREA_FIELDS.map((area) => (
            <div key={area.key} className="grid gap-1.5 md:grid-cols-[10rem_1fr] md:items-start">
              <Label htmlFor={`field-${area.key}`} className="pt-2">
                {area.label} *
              </Label>
              <SearchableMultiSelect
                id={`field-${area.key}`}
                items={CONDITION_ITEMS}
                values={parseHullConditionValues(values[area.key])}
                onValuesChange={(next) => onChange(area.key, next)}
                placeholder="Search and select condition…"
                searchPlaceholder="Search hull condition…"
                disabled={disabled}
              />
            </div>
          ))}
        </div>
        <div>
          <Label htmlFor="field-hullAreaNotes">Additional hull notes</Label>
          <Textarea
            id="field-hullAreaNotes"
            className="mt-1.5"
            rows={3}
            value={values.hullAreaNotes == null ? "" : String(values.hullAreaNotes)}
            onChange={(e) => onChange("hullAreaNotes", e.target.value)}
            placeholder="Sea chests, strakes, or other observations"
            disabled={disabled}
          />
        </div>
      </div>

      <div className="space-y-3 rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium">Draft, load line, and statutory markings</p>
          <p className="text-xs text-muted-foreground">
            Enter how many draft marks to paint at forward, midship, and aft. Total is calculated.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <Label htmlFor="field-draftMarksForward">Forward *</Label>
            <Input
              id="field-draftMarksForward"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              className="mt-1.5 tabular-nums"
              value={numberValue(values.draftMarksForward)}
              onChange={(e) =>
                onChange(
                  "draftMarksForward",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
              disabled={disabled}
            />
          </div>
          <div>
            <Label htmlFor="field-draftMarksMidship">Midship *</Label>
            <Input
              id="field-draftMarksMidship"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              className="mt-1.5 tabular-nums"
              value={numberValue(values.draftMarksMidship)}
              onChange={(e) =>
                onChange(
                  "draftMarksMidship",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
              disabled={disabled}
            />
          </div>
          <div>
            <Label htmlFor="field-draftMarksAft">Aft *</Label>
            <Input
              id="field-draftMarksAft"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              className="mt-1.5 tabular-nums"
              value={numberValue(values.draftMarksAft)}
              onChange={(e) =>
                onChange("draftMarksAft", e.target.value === "" ? null : Number(e.target.value))
              }
              disabled={disabled}
            />
          </div>
          <div>
            <Label htmlFor="field-draftMarksTotal">Total to paint</Label>
            <Input
              id="field-draftMarksTotal"
              className="mt-1.5 tabular-nums"
              value={total == null ? "—" : String(total)}
              readOnly
              disabled
            />
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label htmlFor="field-plimsollMarks">Plimsoll marks to paint *</Label>
            <Input
              id="field-plimsollMarks"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              className="mt-1.5 tabular-nums"
              value={numberValue(values.plimsollMarks)}
              onChange={(e) =>
                onChange("plimsollMarks", e.target.value === "" ? null : Number(e.target.value))
              }
              placeholder="Usually 2 (port & starboard)"
              disabled={disabled}
            />
          </div>
          <div>
            <Label htmlFor="field-loadLineWork">Load line *</Label>
            <LabeledSelect
              id="field-loadLineWork"
              className="mt-1.5 w-full"
              items={[...LOAD_LINE_WORK_OPTIONS]}
              value={loadLineWork}
              onValueChange={(v) => onChange("loadLineWork", v)}
              placeholder="Paint only, change, or none"
              disabled={disabled}
            />
          </div>
          {loadLineWork === "change" ? (
            <div className="md:col-span-2">
              <Label htmlFor="field-loadLineChangeNotes">Load line change / amendment *</Label>
              <Textarea
                id="field-loadLineChangeNotes"
                className="mt-1.5"
                rows={3}
                value={
                  values.loadLineChangeNotes == null ? "" : String(values.loadLineChangeNotes)
                }
                onChange={(e) => onChange("loadLineChangeNotes", e.target.value)}
                placeholder="What is changing and why"
                disabled={disabled}
              />
            </div>
          ) : null}
          <div>
            <Label htmlFor="field-paintFlagName">Flag name to be painted *</Label>
            <LabeledSelect
              id="field-paintFlagName"
              className="mt-1.5 w-full"
              items={[
                { value: "true", label: "Yes" },
                { value: "false", label: "No" },
              ]}
              value={yesNoValue(values.paintFlagName)}
              onValueChange={(v) => onChange("paintFlagName", v === "true")}
              placeholder="Yes / No"
              disabled={disabled}
            />
          </div>
          <div>
            <Label htmlFor="field-paintImoNumber">IMO number to be painted *</Label>
            <LabeledSelect
              id="field-paintImoNumber"
              className="mt-1.5 w-full"
              items={[
                { value: "true", label: "Yes" },
                { value: "false", label: "No" },
              ]}
              value={yesNoValue(values.paintImoNumber)}
              onValueChange={(v) => onChange("paintImoNumber", v === "true")}
              placeholder="Yes / No"
              disabled={disabled}
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="field-markingNotes">Marking notes</Label>
            <Textarea
              id="field-markingNotes"
              className="mt-1.5"
              rows={3}
              value={values.markingNotes == null ? "" : String(values.markingNotes)}
              onChange={(e) => onChange("markingNotes", e.target.value)}
              placeholder="Port/starboard, vessel name, draught scale colour, etc."
              disabled={disabled}
            />
          </div>
        </div>
      </div>

      <InputPhotosOverview
        photos={parseInputPhotos(values.photos)}
        onChange={(photos) => onChange("photos", photos)}
        disabled={disabled}
        label="Hull photos"
      />
    </div>
  );
}
