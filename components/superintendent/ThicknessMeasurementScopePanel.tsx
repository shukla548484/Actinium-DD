"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import {
  createEmptyThicknessMeasurementLine,
  THICKNESS_LOCATION_OPTIONS,
  type ThicknessMeasurementLine,
  type ThicknessMeasurementScope,
} from "@/lib/superintendent/thicknessMeasurementScope";

const LOCATION_ITEMS = THICKNESS_LOCATION_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}));

type Props = {
  scope: ThicknessMeasurementScope;
  onChange: (scope: ThicknessMeasurementScope) => void;
  disabled?: boolean;
};

export function ThicknessMeasurementScopePanel({ scope, onChange, disabled }: Props) {
  const filledLines = scope.lines.filter((l) => l.location.trim());

  function updateLine(id: string, patch: Partial<ThicknessMeasurementLine>) {
    onChange({
      ...scope,
      lines: scope.lines.map((line) => (line.id === id ? { ...line, ...patch } : line)),
    });
  }

  function addLine() {
    onChange({
      ...scope,
      lines: [...scope.lines, createEmptyThicknessMeasurementLine()],
    });
  }

  function removeLine(id: string) {
    onChange({
      ...scope,
      lines: scope.lines.filter((line) => line.id !== id),
    });
  }

  const rows =
    scope.lines.length > 0 ? scope.lines : [createEmptyThicknessMeasurementLine()];

  useEffect(() => {
    if (scope.lines.length === 0 && !disabled) {
      onChange({ ...scope, lines: [createEmptyThicknessMeasurementLine()] });
    }
  }, [scope.lines.length, disabled, onChange, scope]);

  return (
    <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
      <div>
        <p className="text-sm font-medium">Thickness measurement scope *</p>
        <p className="text-xs text-muted-foreground">
          List each location to measure and mark CAP 1 (close-up), CAP 2, and/or class requirements
          per IACS / owner survey plan.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="pb-2 pr-3 font-medium">Location</th>
              <th className="pb-2 pr-3 font-medium">CAP 1</th>
              <th className="pb-2 pr-3 font-medium">CAP 2</th>
              <th className="pb-2 pr-3 font-medium">Class requirement</th>
              {!disabled ? <th className="pb-2 w-[5rem]" /> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((line) => (
              <tr key={line.id} className="border-b border-border/60 last:border-0">
                <td className="py-2 pr-3 align-top">
                  <SearchableSelect
                    id={`utm-location-${line.id}`}
                    items={LOCATION_ITEMS}
                    value={line.location}
                    onValueChange={(location) => updateLine(line.id, { location })}
                    placeholder="Search or type location…"
                    searchPlaceholder="Hull zones, tanks, peaks…"
                    disabled={disabled}
                    allowCustom
                    className="min-w-[11rem]"
                  />
                </td>
                <td className="py-2 pr-3 align-top">
                  <label className="flex items-center gap-2 pt-1.5">
                    <Checkbox
                      checked={line.cap1Required}
                      disabled={disabled}
                      onCheckedChange={(v) => updateLine(line.id, { cap1Required: v === true })}
                    />
                    <span className="text-xs">Required</span>
                  </label>
                </td>
                <td className="py-2 pr-3 align-top">
                  <label className="flex items-center gap-2 pt-1.5">
                    <Checkbox
                      checked={line.cap2Required}
                      disabled={disabled}
                      onCheckedChange={(v) => updateLine(line.id, { cap2Required: v === true })}
                    />
                    <span className="text-xs">Required</span>
                  </label>
                </td>
                <td className="py-2 pr-3 align-top">
                  <Input
                    className="h-8 min-w-[10rem]"
                    value={line.classRequirement}
                    onChange={(e) => updateLine(line.id, { classRequirement: e.target.value })}
                    placeholder="e.g. Class min, survey item"
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
        <p className="text-xs text-muted-foreground">
          {filledLines.length === 0
            ? "No locations entered yet."
            : `${filledLines.length} location(s) in scope.`}
        </p>
        {!disabled ? (
          <Button type="button" size="sm" variant="outline" onClick={addLine}>
            Add location
          </Button>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="utm-notes">Additional notes</Label>
        <Textarea
          id="utm-notes"
          rows={3}
          value={scope.notes}
          onChange={(e) => onChange({ ...scope, notes: e.target.value })}
          placeholder="Survey extent, previous UTM records, staging, NDT, owner / class instructions…"
          disabled={disabled}
        />
      </div>
    </div>
  );
}
