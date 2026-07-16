"use client";

import * as React from "react";
import Check from "lucide-react/dist/esm/icons/check.js";
import ChevronsUpDown from "lucide-react/dist/esm/icons/chevrons-up-down.js";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** Sentinel stored in the form when the user picks the free-text "Others" row. */
export const SELECT_OTHERS_VALUE = "__OTHERS__";

export type SearchableSelectOption = { value: string; label: string; keywords?: string };

export type SearchableOptionSelectProps = {
  value: string;
  onValueChange: (v: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  triggerClassName?: string;
  popoverContentClassName?: string;
  includeOthers?: boolean;
  othersLabel?: string;
  /** Shown on the trigger when `value` is Others (e.g. current custom text). */
  otherDisplay?: string;
};

export function SearchableOptionSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  disabled,
  triggerClassName,
  popoverContentClassName,
  includeOthers = false,
  othersLabel = "Others",
  otherDisplay,
}: SearchableOptionSelectProps) {
  const [open, setOpen] = React.useState(false);

  const extendedOptions = React.useMemo(() => {
    if (!includeOthers) return options;
    return [
      ...options,
      {
        value: SELECT_OTHERS_VALUE,
        label: othersLabel,
        keywords: `${othersLabel} other custom specify`,
      },
    ];
  }, [options, includeOthers, othersLabel]);

  const selected = extendedOptions.find((o) => o.value === value);

  const triggerText = (() => {
    if (!value) return placeholder;
    if (value === SELECT_OTHERS_VALUE) {
      const t = otherDisplay?.trim();
      if (t) return `Others: ${t}`;
      return `${othersLabel} (specify below)`;
    }
    return selected?.label ?? value;
  })();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-9 w-full min-w-[250px] justify-between font-normal whitespace-nowrap",
            !value && "text-muted-foreground",
            triggerClassName
          )}
        >
          <span className="truncate text-left" title={triggerText}>
            {triggerText}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn(
          "z-[2100] min-w-[250px] max-w-[min(100vw-2rem,42rem)] p-0",
          popoverContentClassName
        )}
        align="start"
        sideOffset={4}
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {extendedOptions.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={`${opt.label} ${opt.value} ${opt.keywords ?? ""}`.trim()}
                  onSelect={() => {
                    onValueChange(opt.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      value === opt.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate">{opt.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
