"use client";

import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LabeledSelect } from "@/components/ui/LabeledSelect";
import { SearchableMultiSelect } from "@/components/ui/SearchableMultiSelect";
import {
  InputPhotosOverview,
  parseInputPhotos,
} from "@/components/superintendent/InputPhotosOverview";
import { InputFileAttachments } from "@/components/superintendent/InputFileAttachments";
import {
  PLANNED_PROPELLER_JOB_OPTIONS,
  PROPELLER_COATING_OPTIONS,
  parsePlannedPropellerJobs,
  parsePropellerCoatingJob,
  polishingRequiredFromPlannedJobs,
} from "@/lib/superintendent/propellerCondition";

type Props = {
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  disabled?: boolean;
};

const PLANNED_JOB_ITEMS = PLANNED_PROPELLER_JOB_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}));

function textValue(value: unknown): string {
  return value == null ? "" : String(value);
}

export function PropellerConditionPanel({ values, onChange, disabled }: Props) {
  const plannedJobs = parsePlannedPropellerJobs(values.plannedJobs, values.polishingRequired);
  const coatingJob = parsePropellerCoatingJob(values.coatingJob);

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium">Condition notes</p>
          <p className="text-xs text-muted-foreground">
            Blade, cavitation, and rope or net damage observations for this docking.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <Label htmlFor="field-bladeDamage">Blade damage</Label>
            <Textarea
              id="field-bladeDamage"
              className="mt-1.5"
              rows={3}
              value={textValue(values.bladeDamage)}
              onChange={(e) => onChange("bladeDamage", e.target.value)}
              placeholder="Tips, edges, bending, missing material"
              disabled={disabled}
            />
          </div>
          <div>
            <Label htmlFor="field-cavitation">Cavitation / erosion</Label>
            <Textarea
              id="field-cavitation"
              className="mt-1.5"
              rows={3}
              value={textValue(values.cavitation)}
              onChange={(e) => onChange("cavitation", e.target.value)}
              placeholder="Face/back erosion, extent"
              disabled={disabled}
            />
          </div>
          <div>
            <Label htmlFor="field-ropeDamage">Rope / fishing net damage</Label>
            <Textarea
              id="field-ropeDamage"
              className="mt-1.5"
              rows={3}
              value={textValue(values.ropeDamage)}
              onChange={(e) => onChange("ropeDamage", e.target.value)}
              placeholder="Net wrap, rope cuts, fouling"
              disabled={disabled}
            />
          </div>
        </div>
      </div>

      <div className="space-y-3 rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium">Planned propeller jobs this docking</p>
          <p className="text-xs text-muted-foreground">
            Search and select jobs for this docking. Selection is optional. Hub or blade polishing
            is recorded as polishing required.
          </p>
        </div>
        <SearchableMultiSelect
          id="field-plannedJobs"
          items={PLANNED_JOB_ITEMS}
          values={plannedJobs}
          onValuesChange={(next) => {
            onChange("plannedJobs", next);
            onChange("polishingRequired", polishingRequiredFromPlannedJobs(next));
          }}
          placeholder="Search and select propeller jobs…"
          searchPlaceholder="Search propeller jobs…"
          disabled={disabled}
        />
      </div>

      <div className="space-y-3 rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium">Additional coating job *</p>
          <p className="text-xs text-muted-foreground">
            If silicone-based or anti-friction paint is selected, a dry-dock job is added on submit.
            Choose None if no extra coating job is required.
          </p>
        </div>
        <LabeledSelect
          id="field-coatingJob"
          className="w-full"
          items={[...PROPELLER_COATING_OPTIONS]}
          value={coatingJob}
          onValueChange={(v) => onChange("coatingJob", v)}
          placeholder="None / silicone / anti-friction / both"
          disabled={disabled}
        />
      </div>

      <InputPhotosOverview
        photos={parseInputPhotos(values.photos)}
        onChange={(photos) => onChange("photos", photos)}
        disabled={disabled}
        label="Propeller photos"
      />

      <InputFileAttachments
        files={parseInputPhotos(values.lastDdJobs)}
        onChange={(files) => onChange("lastDdJobs", files)}
        disabled={disabled}
        label="Last dry dock propeller jobs"
        hint="Optional. Attach the previous DD report, photos, or job list. Preview appears here immediately."
      />
    </div>
  );
}
