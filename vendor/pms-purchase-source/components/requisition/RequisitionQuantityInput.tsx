"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type RequisitionQuantityInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "type" | "value" | "onChange" | "onFocus" | "onBlur"
> & {
  value: number | undefined | null;
  onChange: (value: number) => void;
  onBlur?: () => void;
  /** Value applied when the user leaves the field empty (default 1). */
  emptyFallback?: number;
  /** On focus, clear the field when the current value equals this (defaults to emptyFallback). */
  clearOnFocusWhen?: number;
  /** When true, show blank instead of emptyFallback until the user enters a quantity. */
  showBlankWhenUnset?: boolean;
};

function parseQuantity(raw: string, min: number, emptyFallback: number): number {
  const trimmed = raw.trim();
  if (trimmed === "") return emptyFallback;
  const parsed = parseInt(trimmed, 10);
  if (Number.isNaN(parsed)) return emptyFallback;
  return Math.max(min, parsed);
}

function hasCommittedQuantity(
  value: number | undefined | null,
  showBlankWhenUnset: boolean
): boolean {
  if (value == null || Number.isNaN(Number(value))) return false;
  if (showBlankWhenUnset && value === 0) return false;
  return true;
}

/**
 * Quantity cell for requisition line items.
 * Clears the default value on focus so users can type without deleting first;
 * restores emptyFallback on blur when left empty.
 */
export function RequisitionQuantityInput({
  value,
  onChange,
  onBlur,
  emptyFallback = 1,
  clearOnFocusWhen,
  showBlankWhenUnset = false,
  className,
  min = 1,
  step = 1,
  ...props
}: RequisitionQuantityInputProps) {
  const clearAt = clearOnFocusWhen ?? emptyFallback;
  const minValue = Number(min) || 1;
  const hasValue = hasCommittedQuantity(value, showBlankWhenUnset);
  const committed = hasValue
    ? Math.max(minValue, Math.floor(Number(value)))
    : emptyFallback;

  const [focused, setFocused] = React.useState(false);
  const [text, setText] = React.useState("");

  const display = focused
    ? text
    : hasValue
      ? String(committed)
      : showBlankWhenUnset
        ? ""
        : String(committed);

  return (
    <Input
      {...props}
      type="number"
      step={step}
      min={min}
      className={cn("h-9 text-xs", className)}
      value={display}
      onFocus={(e) => {
        setFocused(true);
        setText(committed === clearAt ? "" : String(committed));
        e.target.select();
      }}
      onBlur={() => {
        setFocused(false);
        const next = parseQuantity(text, minValue, emptyFallback);
        onChange(next);
        setText("");
        onBlur?.();
      }}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        if (raw === "" || raw === "-") return;
        const parsed = parseInt(raw, 10);
        if (!Number.isNaN(parsed) && parsed >= minValue) {
          onChange(parsed);
        }
      }}
    />
  );
}

type RequisitionDecimalQuantityInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "type" | "value" | "onChange" | "onFocus" | "onBlur"
> & {
  value: number | undefined | null;
  onChange: (value: number) => void;
  onBlur?: () => void;
  emptyFallback?: number;
  clearOnFocusWhen?: number;
};

/**
 * Decimal quantity (e.g. lube oil liters). Same focus/blur behaviour as RequisitionQuantityInput.
 */
export function RequisitionDecimalQuantityInput({
  value,
  onChange,
  onBlur,
  emptyFallback = 0,
  clearOnFocusWhen,
  className,
  ...props
}: RequisitionDecimalQuantityInputProps) {
  const clearAt = clearOnFocusWhen ?? emptyFallback;
  const hasValue = value != null && !Number.isNaN(Number(value)) && Number(value) !== 0;
  const committed = hasValue ? Number(value) : emptyFallback;

  const [focused, setFocused] = React.useState(false);
  const [text, setText] = React.useState("");

  const display = focused ? text : hasValue ? String(committed) : "";

  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      className={cn("h-9 text-xs", className)}
      value={display}
      onFocus={(e) => {
        setFocused(true);
        setText(committed === clearAt ? "" : String(committed));
        e.target.select();
      }}
      onBlur={() => {
        setFocused(false);
        const trimmed = text.trim().replace(/,/g, "");
        if (trimmed === "" || trimmed === ".") {
          onChange(emptyFallback);
        } else {
          const parsed = parseFloat(trimmed);
          onChange(Number.isNaN(parsed) ? emptyFallback : parsed);
        }
        setText("");
        onBlur?.();
      }}
      onChange={(e) => {
        const raw = e.target.value.replace(/,/g, "");
        setText(raw);
        if (raw === "" || raw === ".") return;
        const parsed = parseFloat(raw);
        if (!Number.isNaN(parsed)) {
          onChange(parsed);
        }
      }}
    />
  );
}
