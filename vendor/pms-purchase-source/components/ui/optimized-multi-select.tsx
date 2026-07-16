"use client";

import React, { useState, useMemo, useCallback, memo, useRef, useLayoutEffect } from "react";
import { ChevronDown, Search, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface MultiSelectOption {
  value: string;
  label: string;
  description?: string;
}

interface OptimizedMultiSelectProps {
  options: MultiSelectOption[];
  selectedValues: string[];
  onSelectionChange: (selectedValues: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  disabled?: boolean;
  showSelectedCount?: boolean;
}

// Memoized dropdown content to prevent unnecessary re-renders
const DropdownContent = memo(({
  options,
  selectedValues,
  onSelectionChange,
  filterText,
  setFilterText,
  searchPlaceholder,
  instanceId,
}: {
  options: MultiSelectOption[];
  selectedValues: string[];
  onSelectionChange: (selectedValues: string[]) => void;
  filterText: string;
  setFilterText: (text: string) => void;
  searchPlaceholder: string;
  instanceId: string;
}) => {
  // Filtering Logic - memoized to prevent recalculation
  const filteredOptions = useMemo(() => {
    if (!filterText) return options;
    const lowercased = filterText.toLowerCase();
    return options.filter(option =>
      option.label.toLowerCase().includes(lowercased) ||
      option.value.toLowerCase().includes(lowercased) ||
      option.description?.toLowerCase().includes(lowercased)
    );
  }, [options, filterText]);

  // Selection state - memoized
  const selectionState = useMemo(() => {
    if (filteredOptions.length === 0) {
      return { allSelected: false, anySelected: false };
    }
    const selectedSet = new Set(selectedValues);
    const visibleSelected = filteredOptions.filter(opt => selectedSet.has(opt.value));
    return {
      allSelected: visibleSelected.length === filteredOptions.length,
      anySelected: visibleSelected.length > 0
    };
  }, [selectedValues, filteredOptions]);

  // Stable callbacks
  const handleCheckboxChange = useCallback((value: string) => {
    const newSelection = selectedValues.includes(value)
      ? selectedValues.filter(v => v !== value)
      : [...selectedValues, value];
    onSelectionChange(newSelection);
  }, [selectedValues, onSelectionChange]);

  const handleSelectAll = useCallback(() => {
    const filteredValues = filteredOptions.map(opt => opt.value);
    const newSelection = Array.from(new Set([...selectedValues, ...filteredValues]));
    onSelectionChange(newSelection);
  }, [selectedValues, onSelectionChange, filteredOptions]);

  const handleDeselectAll = useCallback(() => {
    const filteredValues = new Set(filteredOptions.map(opt => opt.value));
    const newSelection = selectedValues.filter(value => !filteredValues.has(value));
    onSelectionChange(newSelection);
  }, [selectedValues, onSelectionChange, filteredOptions]);

  return (
    <div className="w-full max-h-[min(60vh,20rem)] overflow-y-auto p-4 outline-none">
      {/* Search Input */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className="w-full rounded-md border border-input bg-background py-2 pl-10 pr-4 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* Select/Deselect All Controls */}
      <div className="mb-3 flex items-center justify-between border-b border-border pb-2 text-sm font-medium">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleSelectAll();
          }}
          className="flex items-center text-primary transition duration-150 hover:underline disabled:opacity-50"
          disabled={selectionState.allSelected}
        >
          <CheckCircle className="mr-1 h-4 w-4" />
          Check all
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleDeselectAll();
          }}
          className="flex items-center text-destructive transition duration-150 hover:underline disabled:opacity-50"
          disabled={!selectionState.anySelected}
        >
          <XCircle className="mr-1 h-4 w-4" />
          Uncheck all
        </button>
      </div>

      {/* Options List */}
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {filteredOptions.length > 0 ? (
          filteredOptions.map((option) => {
            const isSelected = selectedValues.includes(option.value);
            const inputId = `${instanceId}-${option.value}`;
            return (
              <label
                key={option.value}
                htmlFor={inputId}
                className={cn(
                  "flex cursor-pointer items-center rounded-md p-2 transition duration-100",
                  isSelected ? "bg-primary/10 text-foreground" : "hover:bg-muted/80"
                )}
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  id={inputId}
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleCheckboxChange(option.value)}
                  className="mr-3 h-4 w-4 cursor-pointer rounded border-input text-primary focus:ring-ring"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{option.label}</div>
                  {option.description && (
                    <div className="mt-0.5 text-xs text-muted-foreground">{option.description}</div>
                  )}
                </div>
              </label>
            );
          })
        ) : (
          <div className="py-4 text-center text-sm text-muted-foreground">
            No results found for &quot;{filterText}&quot;
          </div>
        )}
      </div>
    </div>
  );
});

DropdownContent.displayName = 'DropdownContent';

export const OptimizedMultiSelect = memo<OptimizedMultiSelectProps>(({
  options,
  selectedValues,
  onSelectionChange,
  placeholder = "Select items...",
  searchPlaceholder = "Enter keywords",
  className,
  disabled = false,
  showSelectedCount = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filterText, setFilterText] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [panelWidth, setPanelWidth] = useState<number | undefined>(undefined);
  const instanceId = React.useId();

  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) return;
    setPanelWidth(triggerRef.current.offsetWidth);
  }, [isOpen]);

  // Memoized button text calculation
  const buttonText = useMemo(() => {
    const selectedCount = selectedValues.length;
    if (selectedCount === 0) return placeholder;
    
    if (showSelectedCount) {
      return `${selectedCount} Selected`;
    }
    
    const selectedOptions = options.filter(option => selectedValues.includes(option.value));
    if (selectedCount <= 2) {
      return selectedOptions.map(option => option.label).join(", ");
    }
    
    return `${selectedOptions.slice(0, 2).map(option => option.label).join(", ")} +${selectedCount - 2} more`;
  }, [selectedValues, options, placeholder, showSelectedCount]);

  const selectedCount = selectedValues.length;

  return (
    <Popover
      open={disabled ? false : isOpen}
      onOpenChange={(open) => {
        if (!disabled) setIsOpen(open);
        if (!open) setFilterText("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          className={cn(
            "flex w-full items-center justify-between rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition duration-150 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
        >
          <div className="flex min-w-0 items-center">
            {selectedCount > 0 && showSelectedCount && (
              <span className="mr-2 inline-flex items-center justify-center rounded-full bg-primary px-2 py-0.5 text-xs font-semibold leading-none text-primary-foreground">
                {selectedCount}
              </span>
            )}
            <span className={cn("truncate", selectedCount === 0 && "text-muted-foreground")}>
              {buttonText}
            </span>
          </div>
          <ChevronDown
            className={cn("ml-2 h-5 w-5 shrink-0 transition-transform duration-200", isOpen && "rotate-180")}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        collisionPadding={12}
        style={panelWidth ? { width: panelWidth } : undefined}
        className="z-[3000] max-w-[min(100vw-1.5rem,28rem)] p-0 sm:min-w-[12rem]"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <DropdownContent
          options={options}
          selectedValues={selectedValues}
          onSelectionChange={onSelectionChange}
          filterText={filterText}
          setFilterText={setFilterText}
          searchPlaceholder={searchPlaceholder}
          instanceId={instanceId}
        />
      </PopoverContent>
    </Popover>
  );
});

OptimizedMultiSelect.displayName = 'OptimizedMultiSelect';
