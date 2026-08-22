"use client";

import { useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LabeledSelect } from "@/components/ui/LabeledSelect";
import { SearchableMultiSelect } from "@/components/ui/SearchableMultiSelect";
import { InputFileAttachments } from "@/components/superintendent/InputFileAttachments";
import { parseInputPhotos } from "@/components/superintendent/InputPhotosOverview";
import {
  CARGO_SPACE_KIND_OPTIONS,
  TANK_FAMILY_DEFS,
  TANK_JOB_OPTIONS,
  cargoFamilyLabel,
  cargoSpaceCountLabel,
  classifyTankVesselType,
  lockedCargoSpaceKind,
  parseTankJobs,
  resolveCargoSpaceKind,
  tankFamilyFieldKeys,
  type TankFamilyDef,
} from "@/lib/superintendent/tankCondition";

type Props = {
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  disabled?: boolean;
  vesselType?: string | null;
};

const JOB_ITEMS = TANK_JOB_OPTIONS.map((o) => ({ value: o.value, label: o.label }));

function numberValue(value: unknown): string {
  return value == null || value === "" ? "" : String(value);
}

function yesNoValue(value: unknown): string {
  if (value === true || value === "true") return "true";
  if (value === false || value === "false") return "false";
  return "";
}

function CountField({
  id,
  label,
  value,
  onChange,
  disabled,
  hint,
}: {
  id: string;
  label: string;
  value: unknown;
  onChange: (value: number | null) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label} *</Label>
      <Input
        id={id}
        type="number"
        min={0}
        step={1}
        inputMode="numeric"
        className="mt-1.5 tabular-nums"
        value={numberValue(value)}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        disabled={disabled}
      />
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function FamilyCard({
  family,
  values,
  onChange,
  disabled,
  cargoKind,
}: {
  family: TankFamilyDef;
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  disabled?: boolean;
  cargoKind: string;
}) {
  const keys = tankFamilyFieldKeys(family.id);
  const label = family.id === "cargo" ? cargoFamilyLabel(cargoKind) : family.defaultLabel;
  const countRaw = values[family.countKey];
  const count = countRaw == null || countRaw === "" ? null : Number(countRaw);
  const jobsPlanned = yesNoValue(values[keys.jobsPlanned]);
  const coatingYes = yesNoValue(values[keys.coatingRenewal]) === "true";
  const noTanks = count === 0;
  const locationsPlaceholder =
    family.id === "cargo" && cargoKind === "cargo_holds"
      ? "e.g. Hold 1–7, hopper / topside tanks"
      : family.id === "cargo" && cargoKind === "cargo_tanks"
        ? "e.g. COT 1C, 2P/S, slop P"
        : family.locationsPlaceholder;

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{family.hint}</p>
      </div>

      {noTanks ? (
        <p className="text-sm text-muted-foreground">
          Count is 0 — no specification needed for this family.
        </p>
      ) : (
        <>
          <div>
            <Label htmlFor={`field-${keys.jobsPlanned}`}>Jobs planned this docking? *</Label>
            <LabeledSelect
              id={`field-${keys.jobsPlanned}`}
              className="mt-1.5 w-full"
              items={[
                { value: "true", label: "Yes" },
                { value: "false", label: "No — none this docking" },
              ]}
              value={jobsPlanned}
              onValueChange={(v) => onChange(keys.jobsPlanned, v === "true")}
              placeholder="Yes / No"
              disabled={disabled}
            />
          </div>

          {jobsPlanned === "true" ? (
            <div className="grid gap-3">
              <div>
                <Label htmlFor={`field-${keys.locations}`}>Locations / tanks involved *</Label>
                <Textarea
                  id={`field-${keys.locations}`}
                  className="mt-1.5"
                  rows={2}
                  value={values[keys.locations] == null ? "" : String(values[keys.locations])}
                  onChange={(e) => onChange(keys.locations, e.target.value)}
                  placeholder={locationsPlaceholder}
                  disabled={disabled}
                />
              </div>
              <div>
                <Label htmlFor={`field-${keys.jobs}`}>Planned jobs *</Label>
                <SearchableMultiSelect
                  id={`field-${keys.jobs}`}
                  items={JOB_ITEMS}
                  values={parseTankJobs(values[keys.jobs])}
                  onValuesChange={(next) => onChange(keys.jobs, next)}
                  placeholder="Search and select jobs…"
                  searchPlaceholder="Search tank jobs…"
                  disabled={disabled}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor={`field-${keys.coatingRenewal}`}>Coating renewal *</Label>
                  <LabeledSelect
                    id={`field-${keys.coatingRenewal}`}
                    className="mt-1.5 w-full"
                    items={[
                      { value: "true", label: "Yes" },
                      { value: "false", label: "No" },
                    ]}
                    value={yesNoValue(values[keys.coatingRenewal])}
                    onValueChange={(v) => onChange(keys.coatingRenewal, v === "true")}
                    placeholder="Yes / No"
                    disabled={disabled}
                  />
                </div>
                {coatingYes ? (
                  <div>
                    <Label htmlFor={`field-${keys.coatingPercent}`}>Expected coating area % *</Label>
                    <div className="mt-1.5 flex items-center gap-2">
                      <Input
                        id={`field-${keys.coatingPercent}`}
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        inputMode="numeric"
                        className="tabular-nums"
                        value={numberValue(values[keys.coatingPercent])}
                        onChange={(e) =>
                          onChange(
                            keys.coatingPercent,
                            e.target.value === "" ? null : Number(e.target.value),
                          )
                        }
                        disabled={disabled}
                      />
                      <span className="shrink-0 text-sm text-muted-foreground">%</span>
                    </div>
                  </div>
                ) : null}
                <div>
                  <Label htmlFor={`field-${keys.capCertification}`}>CAP certification required *</Label>
                  <LabeledSelect
                    id={`field-${keys.capCertification}`}
                    className="mt-1.5 w-full"
                    items={[
                      { value: "true", label: "Yes" },
                      { value: "false", label: "No" },
                    ]}
                    value={yesNoValue(values[keys.capCertification])}
                    onValueChange={(v) => onChange(keys.capCertification, v === "true")}
                    placeholder="Yes / No"
                    disabled={disabled}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor={`field-${keys.notes}`}>Condition notes</Label>
                <Textarea
                  id={`field-${keys.notes}`}
                  className="mt-1.5"
                  rows={2}
                  value={values[keys.notes] == null ? "" : String(values[keys.notes])}
                  onChange={(e) => onChange(keys.notes, e.target.value)}
                  placeholder="Coating breakdown, corrosion, mud / sludge, or other observations"
                  disabled={disabled}
                />
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export function TankConditionPanel({ values, onChange, disabled, vesselType }: Props) {
  const vesselClass = classifyTankVesselType(vesselType);
  const lockedKind = lockedCargoSpaceKind(vesselType);
  const cargoKind = resolveCargoSpaceKind(values, vesselType);

  useEffect(() => {
    if (!lockedKind) return;
    if (values.cargoSpaceKind === lockedKind) return;
    onChange("cargoSpaceKind", lockedKind);
  }, [lockedKind, onChange, values.cargoSpaceKind]);

  const cargoHint =
    vesselClass === "tanker"
      ? "Vessel type is tanker — cargo tanks apply; cargo holds are hidden."
      : vesselClass === "bulk"
        ? "Vessel type is bulk carrier — cargo holds apply; cargo tanks are hidden."
        : "Vessel type is not tanker or bulk carrier. Choose cargo tanks or cargo holds — do not assume tanker layout.";

  const visibleFamilies = TANK_FAMILY_DEFS.filter((family) => {
    if (family.id !== "cargo") return true;
    return Boolean(cargoKind);
  });

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium">Tank counts *</p>
          <p className="text-xs text-muted-foreground">
            Enter how many tanks (or holds) of each family. Use 0 if none.
          </p>
        </div>
        {lockedKind ? (
          <p className="text-xs text-muted-foreground">{cargoHint}</p>
        ) : (
          <div>
            <Label htmlFor="field-cargoSpaceKind">Cargo space *</Label>
            <p className="mb-1.5 mt-0.5 text-xs text-muted-foreground">{cargoHint}</p>
            <LabeledSelect
              id="field-cargoSpaceKind"
              className="w-full"
              items={[...CARGO_SPACE_KIND_OPTIONS]}
              value={cargoKind}
              onValueChange={(v) => onChange("cargoSpaceKind", v)}
              placeholder="Cargo tanks or cargo holds"
              disabled={disabled}
            />
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <CountField
            id="field-ballastTankCount"
            label="Ballast tanks"
            value={values.ballastTankCount}
            onChange={(v) => onChange("ballastTankCount", v)}
            disabled={disabled}
          />
          <CountField
            id="field-cargoSpaceCount"
            label={cargoSpaceCountLabel(cargoKind)}
            value={values.cargoSpaceCount}
            onChange={(v) => onChange("cargoSpaceCount", v)}
            disabled={disabled}
          />
          <CountField
            id="field-engineRoomTankCount"
            label="Engine-room tanks"
            value={values.engineRoomTankCount}
            onChange={(v) => onChange("engineRoomTankCount", v)}
            disabled={disabled}
            hint="FO, DO, LO, FW, etc."
          />
          <CountField
            id="field-otherTankCount"
            label="Other tanks"
            value={values.otherTankCount}
            onChange={(v) => onChange("otherTankCount", v)}
            disabled={disabled}
            hint="Voids / cofferdams"
          />
        </div>
      </div>

      <InputFileAttachments
        files={parseInputPhotos(values.tankPlan)}
        onChange={(files) => onChange("tankPlan", files)}
        disabled={disabled}
        label="Tank plan *"
        hint="Attach the tank plan (PDF or image). Same as previous certificate on Safety equipment."
      />

      {visibleFamilies.map((family) => (
        <FamilyCard
          key={family.id}
          family={family}
          values={values}
          onChange={onChange}
          disabled={disabled}
          cargoKind={cargoKind}
        />
      ))}
    </div>
  );
}
