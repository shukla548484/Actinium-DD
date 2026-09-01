"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import {
  createEmptySteelRenewalLine,
  STEEL_RENEWAL_LOCATION_OPTIONS,
  steelRenewalTotalKg,
  type SteelRenewalLine,
  type SteelRenewalScope,
} from "@/lib/superintendent/steelRenewalScope";

const LOCATION_ITEMS = STEEL_RENEWAL_LOCATION_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}));

type Props = {
  scope: SteelRenewalScope;
  onChange: (scope: SteelRenewalScope) => void;
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

export function SteelRenewalScopePanel({ scope, onChange, disabled }: Props) {
  const filledLines = scope.lines.filter((l) => l.location.trim() || l.quantityKg != null);
  const totalKg = steelRenewalTotalKg(filledLines);

  function updateLine(id: string, patch: Partial<SteelRenewalLine>) {
    onChange({
      ...scope,
      lines: scope.lines.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    });
  }

  function addLine() {
    onChange({
      ...scope,
      lines: [...scope.lines, createEmptySteelRenewalLine()],
    });
  }

  function removeLine(id: string) {
    onChange({
      ...scope,
      lines: scope.lines.filter((line) => line.id !== id),
    });
  }

  const rows = scope.lines.length > 0 ? scope.lines : [createEmptySteelRenewalLine()];

  return (
    <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
      <div>
        <p className="text-sm font-medium">Steel renewal scope *</p>
        <p className="text-xs text-muted-foreground">
          Enter quantity of steel (kg) at each location. Search or type a location; add custom
          locations when needed.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="pb-2 pr-3 font-medium">Location</th>
              <th className="pb-2 pr-3 font-medium">Qty (kg)</th>
              {!disabled ? <th className="pb-2 w-[5rem]" /> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((line) => (
              <tr key={line.id} className="border-b border-border/60 last:border-0">
                <td className="py-2 pr-3 align-top">
                  <SearchableSelect
                    id={`steel-location-${line.id}`}
                    items={LOCATION_ITEMS}
                    value={line.location}
                    onValueChange={(location) => updateLine(line.id, { location })}
                    placeholder="Search or type location…"
                    searchPlaceholder="Engine room, hull, tanks…"
                    disabled={disabled}
                    allowCustom
                    className="min-w-[12rem]"
                  />
                </td>
                <td className="py-2 pr-3 align-top">
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    className="h-8 tabular-nums"
                    value={numberValue(line.quantityKg)}
                    onChange={(e) =>
                      updateLine(line.id, { quantityKg: toNumberOrNull(e.target.value) })
                    }
                    placeholder="kg"
                    disabled={disabled}
                  />
                </td>
                {!disabled ? (
                  <td className="py-2 align-top">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeLine(line.id)}
                      disabled={rows.length <= 1}
                    >
                      Remove
                    </Button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs tabular-nums text-muted-foreground">
          {filledLines.length === 0
            ? "No quantities entered yet."
            : `Total steel: ${totalKg.toLocaleString()} kg across ${filledLines.length} location(s).`}
        </p>
        {!disabled ? (
          <Button type="button" size="sm" variant="outline" onClick={addLine}>
            Add location
          </Button>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="steel-renewal-notes">Additional notes</Label>
        <Textarea
          id="steel-renewal-notes"
          rows={3}
          value={scope.notes}
          onChange={(e) => onChange({ ...scope, notes: e.target.value })}
          placeholder="Plate thickness, staging, NDT, class requirements…"
          disabled={disabled}
        />
      </div>
    </div>
  );
}
