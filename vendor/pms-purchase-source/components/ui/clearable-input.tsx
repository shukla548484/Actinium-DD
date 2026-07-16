"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const filterFieldWidthClass = "w-full min-w-[200px] max-w-[300px]";

/** Clear button inset when the field has no right-side chevron (text input, date button). */
export const FILTER_CLEAR_INSET_PLAIN = "right-2";
/** Clear button inset left of a dropdown chevron (Select, MultiSelect, combobox). */
export const FILTER_CLEAR_INSET_DROPDOWN = "right-8";
/** Trigger padding when per-field clear is visible (no chevron). */
export const FILTER_TRIGGER_PR_PLAIN = "pr-7";
/** Trigger padding when per-field clear is visible (dropdown chevron on the right). */
export const FILTER_TRIGGER_PR_DROPDOWN = "pr-8";

export function filterTriggerClearPadding(
  hasValue: boolean,
  hasDropdownChevron = false
): string | undefined {
  if (!hasValue) return undefined;
  return hasDropdownChevron ? FILTER_TRIGGER_PR_DROPDOWN : FILTER_TRIGGER_PR_PLAIN;
}

/** Extra right padding on MultiSelectDropdown's inner button when clear is shown. */
export function filterMultiSelectClearClass(hasValue: boolean): string | undefined {
  return hasValue ? "[&>button]:pr-8" : undefined;
}

interface FilterClearButtonProps {
  visible: boolean;
  onClear: () => void;
  className?: string;
  /** Extra inset from the right edge (e.g. when a chevron sits at the edge). */
  insetRight?: string;
}

export function FilterClearButton({
  visible,
  onClear,
  className,
  insetRight = FILTER_CLEAR_INSET_PLAIN,
}: FilterClearButtonProps) {
  if (!visible) return null;

  return (
    <button
      type="button"
      aria-label="Clear filter"
      className={cn(
        "absolute top-1/2 z-10 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground",
        insetRight,
        className
      )}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClear();
      }}
    >
      <X className="h-3.5 w-3.5" />
    </button>
  );
}

interface FilterFieldShellProps {
  children: React.ReactNode;
  showClear: boolean;
  onClear: () => void;
  className?: string;
  clearInsetRight?: string;
  /** Positions the clear control left of a native Select / combobox chevron. */
  hasDropdownChevron?: boolean;
}

export function FilterFieldShell({
  children,
  showClear,
  onClear,
  className,
  clearInsetRight,
  hasDropdownChevron = false,
}: FilterFieldShellProps) {
  const resolvedInset =
    clearInsetRight ??
    (hasDropdownChevron ? FILTER_CLEAR_INSET_DROPDOWN : FILTER_CLEAR_INSET_PLAIN);

  return (
    <div className={cn("relative min-w-0", filterFieldWidthClass, className)}>
      {children}
      <FilterClearButton
        visible={showClear}
        onClear={onClear}
        insetRight={resolvedInset}
      />
    </div>
  );
}

interface ClearableInputProps extends React.ComponentProps<typeof Input> {
  onClear: () => void;
  /** Override auto-detect from value; never forwarded to the native input. */
  showClear?: boolean;
  /** Drop the default 200–300px filter shell width (e.g. inline analytics row filters). */
  compact?: boolean;
}

export function ClearableInput({
  value,
  onClear,
  className,
  showClear,
  compact = false,
  ...props
}: ClearableInputProps) {
  const hasValue = String(value ?? "").length > 0;
  const clearVisible = showClear ?? hasValue;

  return (
    <FilterFieldShell
      showClear={clearVisible}
      onClear={onClear}
      className={compact ? "min-w-0 w-full max-w-none" : undefined}
    >
      <Input
        value={value}
        className={cn(
          "h-8 text-xs",
          clearVisible && FILTER_TRIGGER_PR_PLAIN,
          className
        )}
        {...props}
      />
    </FilterFieldShell>
  );
}
