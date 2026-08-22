"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LabeledSelect } from "@/components/ui/LabeledSelect";
import { DatePickerField } from "@/components/ui/DatePickerField";
import { InputFileAttachments } from "@/components/superintendent/InputFileAttachments";
import { parseInputPhotos } from "@/components/superintendent/InputPhotosOverview";
import {
  TAILSHAFT_REMOVAL_PLAN_OPTIONS,
  TAILSHAFT_SEAL_LEAKAGE_OPTIONS,
} from "@/lib/superintendent/tailshaftCondition";

type Props = {
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  disabled?: boolean;
};

function textValue(value: unknown): string {
  return value == null ? "" : String(value);
}

function numberValue(value: unknown): string {
  return value == null || value === "" ? "" : String(value);
}

export function TailshaftConditionPanel({ values, onChange, disabled }: Props) {
  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium">Condition since last withdrawal</p>
          <p className="text-xs text-muted-foreground">
            Running hours are required. Seal leakage and oil consumption help the yard
            judge whether the stern tube is healthy.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-1.5 flex items-baseline gap-1">
              <Label htmlFor="field-runningHours">Running hours since last withdrawal</Label>
              <span className="text-destructive">*</span>
            </div>
            <Input
              id="field-runningHours"
              type="number"
              min={0}
              inputMode="numeric"
              className="tabular-nums"
              value={numberValue(values.runningHours)}
              onChange={(e) =>
                onChange(
                  "runningHours",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
              disabled={disabled}
            />
          </div>
          <div>
            <Label htmlFor="field-lastWithdrawalDate">Last withdrawal date</Label>
            <DatePickerField
              id="field-lastWithdrawalDate"
              name="lastWithdrawalDate"
              className="mt-1.5"
              value={textValue(values.lastWithdrawalDate)}
              onValueChange={(v) => onChange("lastWithdrawalDate", v)}
              placeholder="Select date"
              disabled={disabled}
            />
          </div>
          <div>
            <Label htmlFor="field-sealLeakage">Seal leakage</Label>
            <LabeledSelect
              id="field-sealLeakage"
              className="mt-1.5 w-full"
              items={[...TAILSHAFT_SEAL_LEAKAGE_OPTIONS]}
              value={textValue(values.sealLeakage)}
              onValueChange={(v) => onChange("sealLeakage", v)}
              placeholder="Select leakage"
              disabled={disabled}
            />
          </div>
          <div>
            <Label htmlFor="field-sternTubeOilConsumption">Stern tube oil consumption</Label>
            <div className="mt-1.5 flex items-center gap-2">
              <Input
                id="field-sternTubeOilConsumption"
                value={textValue(values.sternTubeOilConsumption)}
                onChange={(e) => onChange("sternTubeOilConsumption", e.target.value)}
                disabled={disabled}
              />
              <span className="shrink-0 text-sm text-muted-foreground">L/day</span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium">Vibration and bearing notes</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="field-vibration">Vibration / abnormal noise</Label>
            <Textarea
              id="field-vibration"
              className="mt-1.5"
              rows={3}
              value={textValue(values.vibration)}
              onChange={(e) => onChange("vibration", e.target.value)}
              placeholder="Noise, vibration at certain RPM, or other remarks"
              disabled={disabled}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="field-bearingTemperature">Bearing temperature notes</Label>
            <Input
              id="field-bearingTemperature"
              className="mt-1.5"
              value={textValue(values.bearingTemperature)}
              onChange={(e) => onChange("bearingTemperature", e.target.value)}
              placeholder="Normal range, spikes, or other remarks"
              disabled={disabled}
            />
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium">This docking plan *</p>
          <p className="text-xs text-muted-foreground">
            Confirm whether tailshaft removal and visual examination is planned. Add notes
            if this is intermediate vs special survey, oil analysis only, or similar.
          </p>
        </div>
        <div>
          <div className="mb-1.5 flex items-baseline gap-1">
            <Label htmlFor="field-removalPlan">Tailshaft removal</Label>
            <span className="text-destructive">*</span>
          </div>
          <LabeledSelect
            id="field-removalPlan"
            className="w-full"
            items={[...TAILSHAFT_REMOVAL_PLAN_OPTIONS]}
            value={textValue(values.removalPlan)}
            onValueChange={(v) => onChange("removalPlan", v)}
            placeholder="Select plan"
            disabled={disabled}
          />
        </div>
        <div>
          <Label htmlFor="field-removalPlanNotes">Plan notes (optional)</Label>
          <Textarea
            id="field-removalPlanNotes"
            className="mt-1.5"
            rows={3}
            value={textValue(values.removalPlanNotes)}
            onChange={(e) => onChange("removalPlanNotes", e.target.value)}
            placeholder="e.g. Intermediate survey — oil analysis only; no withdrawal unless class requires"
            disabled={disabled}
          />
        </div>
      </div>

      <div className="space-y-3 rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium">Last monitoring records</p>
          <p className="text-xs text-muted-foreground">
            Optional. Attach last readings and last report so they can be shared with
            shipyards later. Preview appears here immediately (PDF, images, or documents).
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <InputFileAttachments
            files={parseInputPhotos(values.monitoringReadings)}
            onChange={(files) => onChange("monitoringReadings", files)}
            disabled={disabled}
            label="Last monitoring data / readings"
            hint="Charts, trend sheets, or logged readings."
          />
          <InputFileAttachments
            files={parseInputPhotos(values.monitoringReport)}
            onChange={(files) => onChange("monitoringReport", files)}
            disabled={disabled}
            label="Last report"
            hint="Survey, oil-analysis, or maker report."
          />
        </div>
      </div>
    </div>
  );
}
