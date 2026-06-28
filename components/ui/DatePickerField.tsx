"use client";

import * as React from "react";
import { format, isValid, parse, parseISO } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function parseDateValue(value: string | undefined): Date | undefined {
  if (!value?.trim()) return undefined;
  const iso = parseISO(value);
  if (isValid(iso)) return iso;
  const dashed = parse(value, "yyyy-MM-dd", new Date());
  if (isValid(dashed)) return dashed;
  return undefined;
}

function toApiDate(date: Date | undefined): string {
  if (!date || !isValid(date)) return "";
  return format(date, "yyyy-MM-dd");
}

function formatDisplayDate(date: Date | undefined): string {
  if (!date || !isValid(date)) return "";
  return format(date, "dd MMM yyyy");
}

/** Normalize ISO / API dates for hidden inputs and default values. */
function toDateInput(value: string | null | undefined): string {
  if (!value?.trim()) return "";
  return toApiDate(parseDateValue(value));
}

type DatePickerFieldProps = {
  id?: string;
  name: string;
  label?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  fromDate?: Date;
  toDate?: Date;
  startMonth?: Date;
  endMonth?: Date;
};

export function DatePickerField({
  id,
  name,
  label,
  value,
  defaultValue,
  onValueChange,
  placeholder = "Pick a date",
  disabled,
  required,
  className,
  fromDate,
  toDate,
  startMonth = new Date(1990, 0),
  endMonth = new Date(new Date().getFullYear() + 15, 11),
}: DatePickerFieldProps) {
  const controlled = value !== undefined;
  const [internal, setInternal] = React.useState(defaultValue ?? "");
  const [open, setOpen] = React.useState(false);

  const stringValue = controlled ? value : internal;
  const selected = parseDateValue(stringValue);

  const setStringValue = (next: string) => {
    if (!controlled) setInternal(next);
    onValueChange?.(next);
  };

  const handleSelect = (date: Date | undefined) => {
    setStringValue(toApiDate(date));
    if (date) setOpen(false);
  };

  const triggerId = id ?? name;

  return (
    <div className={cn("space-y-2", className)}>
      {label ? <Label htmlFor={triggerId}>{label}</Label> : null}
      <input type="hidden" name={name} value={stringValue} required={required} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          id={triggerId}
          disabled={disabled}
          aria-required={required}
          className={cn(
            "flex h-8 w-full items-center gap-2 rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors outline-none select-none",
            "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
            "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
            "dark:bg-input/30",
            !selected && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="size-4 shrink-0 opacity-60" />
          <span className="flex-1 truncate text-left">
            {selected ? formatDisplayDate(selected) : placeholder}
          </span>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--date-picker-popover-width,22rem)] min-w-[var(--date-picker-popover-width,22rem)] p-0"
          align="start"
        >
          <Calendar
            mode="single"
            selected={selected}
            onSelect={handleSelect}
            defaultMonth={selected}
            captionLayout="dropdown"
            startMonth={startMonth}
            endMonth={endMonth}
            disabled={[
              ...(fromDate ? [{ before: fromDate }] : []),
              ...(toDate ? [{ after: toDate }] : []),
            ]}
          />
          {selected ? (
            <div className="border-t p-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 w-full"
                onClick={() => {
                  setStringValue("");
                  setOpen(false);
                }}
              >
                Clear date
              </Button>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  );
}

export { formatDisplayDate, parseDateValue, toApiDate, toDateInput };
