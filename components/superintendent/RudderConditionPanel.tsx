"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LabeledSelect } from "@/components/ui/LabeledSelect";
import { DatePickerField } from "@/components/ui/DatePickerField";
import { InputFileAttachments } from "@/components/superintendent/InputFileAttachments";
import { parseInputPhotos } from "@/components/superintendent/InputPhotosOverview";
import {
  RUDDER_CLEARANCE_FIELDS,
  RUDDER_TYPES,
  showPintleClearances,
} from "@/lib/superintendent/rudderCondition";

type Props = {
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  disabled?: boolean;
};

function numberValue(value: unknown): string {
  return value == null || value === "" ? "" : String(value);
}

export function RudderConditionPanel({ values, onChange, disabled }: Props) {
  const rudderType = values.rudderType == null ? "" : String(values.rudderType);
  const pintlesVisible = showPintleClearances(rudderType);
  const clearanceFields = RUDDER_CLEARANCE_FIELDS.filter(
    (field) => !field.pintleOnly || pintlesVisible,
  );

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium">Rudder type</p>
          <p className="text-xs text-muted-foreground">
            Pintle clearances appear only when this type normally has upper and lower pintles.
          </p>
        </div>
        <div>
          <div className="mb-1.5 flex items-baseline gap-1">
            <Label htmlFor="field-rudderType">Rudder type</Label>
            <span className="text-destructive">*</span>
          </div>
          <LabeledSelect
            id="field-rudderType"
            className="w-full"
            items={[...RUDDER_TYPES]}
            value={rudderType}
            onValueChange={(v) => onChange("rudderType", v)}
            placeholder="Select rudder type"
            disabled={disabled}
          />
        </div>
        {rudderType === "other" ? (
          <div>
            <div className="mb-1.5 flex items-baseline gap-1">
              <Label htmlFor="field-rudderTypeOther">Specify rudder type</Label>
              <span className="text-destructive">*</span>
            </div>
            <Input
              id="field-rudderTypeOther"
              value={values.rudderTypeOther == null ? "" : String(values.rudderTypeOther)}
              onChange={(e) => onChange("rudderTypeOther", e.target.value)}
              placeholder="e.g. Becker, Schilling, twisted leading edge"
              disabled={disabled}
            />
          </div>
        ) : null}
      </div>

      <div className="space-y-3 rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium">Last clearance readings</p>
          <p className="text-xs text-muted-foreground">
            Enter last recorded values in millimetres so the shipyard has numbers, not only notes.
            Empty is allowed on draft; 0 is a valid reading.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {clearanceFields.map((field) => (
            <div key={field.key}>
              <div className="mb-1.5 flex items-baseline gap-1">
                <Label htmlFor={`field-${field.key}`}>{field.label}</Label>
                {field.pintleOnly && rudderType === "other" ? null : (
                  <span className="text-destructive">*</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id={`field-${field.key}`}
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  className="tabular-nums"
                  value={numberValue(values[field.key])}
                  onChange={(e) =>
                    onChange(field.key, e.target.value === "" ? null : Number(e.target.value))
                  }
                  disabled={disabled}
                />
                <span className="shrink-0 text-sm text-muted-foreground">mm</span>
              </div>
            </div>
          ))}
          <div>
            <DatePickerField
              id="field-lastClearanceDate"
              name="lastClearanceDate"
              label="Date of last measurement"
              value={values.lastClearanceDate == null ? "" : String(values.lastClearanceDate)}
              onValueChange={(v) => onChange("lastClearanceDate", v)}
              placeholder="Optional"
              disabled={disabled}
            />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium">Last reports</p>
          <p className="text-xs text-muted-foreground">
            Optional — attach so the shipyard has the last recorded report. Preview appears here
            immediately.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <InputFileAttachments
            files={parseInputPhotos(values.propellerBearingReport)}
            onChange={(files) => onChange("propellerBearingReport", files)}
            disabled={disabled}
            label="Last propeller bearing clearance report"
            hint="Last clearances report of the propeller bearing."
          />
          <InputFileAttachments
            files={parseInputPhotos(values.rudderClearanceReport)}
            onChange={(files) => onChange("rudderClearanceReport", files)}
            disabled={disabled}
            label={
              pintlesVisible
                ? "Last pintle / rudder clearance report"
                : "Last rudder clearance report"
            }
            hint="Last pintle or rudder stock / bearing clearance report."
          />
        </div>
      </div>

      <div className="space-y-3 rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium">Condition notes</p>
          <p className="text-xs text-muted-foreground">
            Steering performance, leakage, and vibration observations.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <Label htmlFor="field-steeringPerformance">Steering gear performance</Label>
            <Textarea
              id="field-steeringPerformance"
              className="mt-1.5"
              rows={3}
              value={values.steeringPerformance == null ? "" : String(values.steeringPerformance)}
              onChange={(e) => onChange("steeringPerformance", e.target.value)}
              placeholder="Response, hunting, hard-over times"
              disabled={disabled}
            />
          </div>
          <div>
            <Label htmlFor="field-rudderStockLeakage">Rudder stock leakage</Label>
            <Textarea
              id="field-rudderStockLeakage"
              className="mt-1.5"
              rows={3}
              value={values.rudderStockLeakage == null ? "" : String(values.rudderStockLeakage)}
              onChange={(e) => onChange("rudderStockLeakage", e.target.value)}
              placeholder="None / slight / leaking — packing or seal"
              disabled={disabled}
            />
          </div>
          <div>
            <Label htmlFor="field-abnormalVibration">Abnormal vibration</Label>
            <Textarea
              id="field-abnormalVibration"
              className="mt-1.5"
              rows={3}
              value={values.abnormalVibration == null ? "" : String(values.abnormalVibration)}
              onChange={(e) => onChange("abnormalVibration", e.target.value)}
              placeholder="Steering or rudder vibration / noise"
              disabled={disabled}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
