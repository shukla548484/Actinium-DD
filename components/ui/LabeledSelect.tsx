"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LabeledOption } from "@/lib/ui/labeledSelect";
import { cn } from "@/lib/utils";

type LabeledSelectProps = {
  items: readonly LabeledOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
};

/** Base UI Select wrapper — always shows human-readable labels, never raw values. */
export function LabeledSelect({
  items,
  value,
  onValueChange,
  placeholder,
  className,
  id,
  disabled,
}: LabeledSelectProps) {
  return (
    <Select
      items={[...items]}
      value={value || null}
      onValueChange={(v) => onValueChange(v ?? "")}
      disabled={disabled}
    >
      <SelectTrigger className={cn("w-full min-w-[12rem]", className)} id={id} disabled={disabled}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
