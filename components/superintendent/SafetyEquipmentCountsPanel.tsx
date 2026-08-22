"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FFA_COUNT_ITEMS,
  LSA_COUNT_ITEMS,
  parseSafetyCountMap,
  type SafetyCountMap,
} from "@/lib/superintendent/safetyEquipmentCounts";

type Props = {
  lsaCounts: unknown;
  ffaCounts: unknown;
  onChange: (key: "lsaCounts" | "ffaCounts", value: SafetyCountMap) => void;
  disabled?: boolean;
};

function CountGrid({
  title,
  hint,
  items,
  values,
  onChange,
  disabled,
}: {
  title: string;
  hint: string;
  items: readonly { key: string; label: string }[];
  values: SafetyCountMap;
  onChange: (next: SafetyCountMap) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div>
        <p className="text-sm font-medium">{title} *</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <div className="grid gap-2">
        {items.map((item) => {
          const raw = values[item.key];
          return (
            <div key={item.key} className="grid grid-cols-[1fr_5.5rem] items-center gap-2">
              <Label htmlFor={`count-${item.key}`} className="text-xs font-normal">
                {item.label}
              </Label>
              <Input
                id={`count-${item.key}`}
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                className="h-8 text-right tabular-nums"
                value={raw == null ? "" : String(raw)}
                disabled={disabled}
                required
                onChange={(e) => {
                  const v = e.target.value;
                  onChange({
                    ...values,
                    [item.key]: v === "" ? null : Number(v),
                  });
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SafetyEquipmentCountsPanel({ lsaCounts, ffaCounts, onChange, disabled }: Props) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <CountGrid
        title="LSA item counts"
        hint="Enter how many of each life-saving appliance are onboard. Use 0 if none."
        items={LSA_COUNT_ITEMS}
        values={parseSafetyCountMap(lsaCounts)}
        onChange={(value) => onChange("lsaCounts", value)}
        disabled={disabled}
      />
      <CountGrid
        title="FFA item counts"
        hint="Enter how many of each fire-fighting appliance are onboard. Fire extinguishers must be split by type (Foam, CO2, dry powder, water, wet chemical)."
        items={FFA_COUNT_ITEMS}
        values={parseSafetyCountMap(ffaCounts)}
        onChange={(value) => onChange("ffaCounts", value)}
        disabled={disabled}
      />
    </div>
  );
}
