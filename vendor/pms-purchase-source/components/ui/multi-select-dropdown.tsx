"use client";

import React, { useState, useMemo, useCallback, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  value: string;
  label: string;
  description?: string;
}

interface MultiSelectDropdownProps {
  options: MultiSelectOption[];
  selectedValues: string[];
  onSelectionChange: (selectedValues: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  disabled?: boolean;
  showSelectedCount?: boolean;
  /** When true, control is disabled and shows loading (use until options are fetched). */
  isLoading?: boolean;
}

const DropdownContent = ({
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
  // --- Filtering Logic ---
  const filteredOptions = useMemo(() => {
    if (!filterText) {
      return options;
    }
    const lowercasedFilter = filterText.toLowerCase();
    return options.filter(option =>
      option.label.toLowerCase().includes(lowercasedFilter) ||
      option.value.toLowerCase().includes(lowercasedFilter) ||
      option.description?.toLowerCase().includes(lowercasedFilter)
    );
  }, [options, filterText]);

  // --- Selection Logic ---

  // Check if all *visible* (filtered) items are currently selected
  const isAllFilteredSelected = useMemo(() => {
    if (filteredOptions.length === 0 || !selectedValues) return false;
    return filteredOptions.every(option => selectedValues.includes(option.value));
  }, [selectedValues, filteredOptions]);

  // Check if *any* visible item is currently selected (for partial/indeterminate state)
  const isAnyFilteredSelected = useMemo(() => {
    if (filteredOptions.length === 0 || !selectedValues) return false;
    return filteredOptions.some(option => selectedValues.includes(option.value));
  }, [selectedValues, filteredOptions]);

  // Handler for individual checkbox change
  const handleCheckboxChange = useCallback((value: string) => {
    const currentValues = selectedValues || [];
    const newSelection = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value];
    onSelectionChange(newSelection);
  }, [selectedValues, onSelectionChange]);

  // Handler for Check All / Uncheck All (affects only filtered items)
  const handleToggleAll = useCallback((checkStatus: boolean) => {
    const filteredValues = filteredOptions.map(option => option.value);
    const currentValues = selectedValues || [];
    
    if (checkStatus) {
      // Check all filtered items
      const newSelection = Array.from(new Set([...currentValues, ...filteredValues]));
      onSelectionChange(newSelection);
    } else {
      // Uncheck all filtered items
      const newSelection = currentValues.filter(value => !filteredValues.includes(value));
      onSelectionChange(newSelection);
    }
  }, [selectedValues, onSelectionChange, filteredOptions]);

  return (
    <div className="p-4 bg-white rounded-lg shadow-xl ring-1 ring-gray-200 w-full max-h-80 overflow-y-auto">
      {/* Search/Filter Input */}
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 text-sm"
        />
      </div>

      {/* Check All / Uncheck All Controls */}
      <div className="flex justify-between items-center text-sm font-medium mb-3 border-b pb-2 border-gray-100">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleToggleAll(true);
          }}
          className="flex items-center text-blue-600 hover:text-blue-800 transition duration-150 disabled:opacity-50"
          disabled={isAllFilteredSelected} // Disable if everything visible is already checked
        >
          <CheckCircle className="h-4 w-4 mr-1" />
          Check all
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleToggleAll(false);
          }}
          className="flex items-center text-red-600 hover:text-red-800 transition duration-150 disabled:opacity-50"
          disabled={!isAnyFilteredSelected} // Disable if nothing visible is checked
        >
          <XCircle className="h-4 w-4 mr-1" />
          Uncheck all
        </button>
      </div>

      {/* Options List */}
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {filteredOptions.length > 0 ? (
          filteredOptions.map((option) => {
            const isSelected = selectedValues?.includes(option.value) || false;
            const inputId = `${instanceId}-${option.value}`;
            return (
              <label
                key={option.value}
                htmlFor={inputId}
                className={`flex items-center p-2 rounded-lg cursor-pointer transition duration-100 ${
                  isSelected ? 'bg-blue-50 text-blue-900' : 'hover:bg-gray-50'
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  id={inputId}
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleCheckboxChange(option.value)}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-3 flex-shrink-0 cursor-pointer"
                />
                <span className="text-sm font-medium text-gray-700 select-none flex-1 flex items-center gap-2 min-w-0 break-words">
                  <span className="whitespace-normal break-words">{option.label}</span>
                  {option.description && (
                    <span className="text-xs text-gray-500 whitespace-nowrap">({option.description})</span>
                  )}
                </span>
              </label>
            );
          })
        ) : (
          <div className="text-center text-gray-500 py-4 text-sm">
            No results found for &quot;{filterText}&quot;
          </div>
        )}
      </div>
    </div>
  );
};

export function MultiSelectDropdown({
  options,
  selectedValues,
  onSelectionChange,
  placeholder = "Select items...",
  searchPlaceholder = "Enter keywords",
  className,
  disabled = false,
  showSelectedCount = true,
  isLoading = false,
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const instanceId = React.useId();

  // Calculate the number of selected items for the main button badge
  const selectedCount = useMemo(() => {
    return selectedValues?.length || 0;
  }, [selectedValues]);

  useLayoutEffect(() => {
    if (!isOpen || typeof document === "undefined") return;

    const updatePosition = () => {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const width = Math.min(480, Math.max(380, rect.width));
      setMenuStyle({
        position: "fixed",
        top: rect.bottom + 8,
        left: rect.left,
        width,
        zIndex: 9999,
      });
    };

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen]);

  // Handle click outside to close dropdown (menu is portaled to body)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setIsOpen(false);
      setFilterText('');
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Main dropdown button text
  const getButtonText = () => {
    if (selectedCount === 0) {
      return placeholder;
    }
    
    if (showSelectedCount) {
      return `${selectedCount} Selected`;
    }
    
    const selectedOptions = options.filter(option => selectedValues?.includes(option.value) || false);
    if (selectedCount <= 2) {
      return selectedOptions.map(option => option.label).join(", ");
    }
    
    return `${selectedOptions.slice(0, 2).map(option => option.label).join(", ")} +${selectedCount - 2} more`;
  };

  const blocked = disabled || isLoading;

  const menuPortal =
    isOpen && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            className="origin-top-left"
            style={menuStyle}
            onClick={(e) => e.stopPropagation()}
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
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={triggerRef} className={cn("relative w-full", className)}>
      {/* Dropdown Toggle Button */}
      <button
        type="button"
        onClick={() => !blocked && setIsOpen(!isOpen)}
        disabled={blocked}
        className={cn(
          "w-full flex justify-between items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed",
          isLoading && "animate-pulse"
        )}
      >
        <div className="flex items-center min-w-0">
          {isLoading ? (
            <span className="flex items-center gap-2 text-gray-500">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
              <span>Loading…</span>
            </span>
          ) : (
            <>
              {selectedCount > 0 && showSelectedCount && (
                <span className="inline-flex items-center justify-center px-2 py-0.5 mr-2 text-xs font-semibold leading-none text-white bg-blue-600 rounded-full shrink-0">
                  {selectedCount}
                </span>
              )}
              <span
                className={cn(
                  "truncate",
                  selectedCount === 0 && "text-gray-500"
                )}
              >
                {getButtonText()}
              </span>
            </>
          )}
        </div>
        <ChevronDown
          className={cn(
            "h-5 w-5 ml-2 shrink-0 transition-transform duration-200",
            isOpen ? "rotate-180" : "rotate-0"
          )}
        />
      </button>

      {menuPortal}
    </div>
  );
}
