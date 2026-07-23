"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckIcon, ChevronDownIcon, XIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { SearchableSelectOption } from "@/components/ui/SearchableSelect";

type SearchableMultiSelectProps = {
  items: readonly SearchableSelectOption[];
  values: string[];
  onValuesChange: (values: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  menuClassName?: string;
  id?: string;
  disabled?: boolean;
  emptyMessage?: string;
};

export function SearchableMultiSelect({
  items,
  values,
  onValuesChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  className,
  menuClassName,
  id,
  disabled,
  emptyMessage = "No options",
}: SearchableMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const selectedItems = useMemo(
    () => items.filter((item) => values.includes(item.value)),
    [items, values],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      const haystack = (item.searchText ?? `${item.label} ${item.value}`).toLowerCase();
      return haystack.includes(q);
    });
  }, [items, query]);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMenuPos({
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 288),
    });
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
      setQuery("");
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  function toggleValue(next: string) {
    if (values.includes(next)) {
      onValuesChange(values.filter((v) => v !== next));
    } else {
      onValuesChange([...values, next]);
    }
  }

  function removeValue(next: string, event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    onValuesChange(values.filter((v) => v !== next));
  }

  const menu =
    open && mounted ? (
      <div
        ref={panelRef}
        role="listbox"
        aria-multiselectable
        className={cn(
          "fixed z-[9999] overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10",
          menuClassName,
        )}
        style={{
          top: menuPos.top,
          left: menuPos.left,
          width: menuPos.width,
        }}
      >
        <div className="border-b p-2">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-8 w-full"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setOpen(false);
                setQuery("");
              }
            }}
          />
        </div>
        <ul className="max-h-56 overflow-y-auto p-1">
          {items.length === 0 ? (
            <li className="px-2 py-2 text-sm text-muted-foreground">{emptyMessage}</li>
          ) : filtered.length === 0 ? (
            <li className="px-2 py-2 text-sm text-muted-foreground">No matches</li>
          ) : (
            filtered.map((item) => {
              const isSelected = values.includes(item.value);
              return (
                <li key={item.key ?? item.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                      isSelected && "bg-accent/60",
                    )}
                    onClick={() => toggleValue(item.value)}
                  >
                    <span className="truncate">{item.label}</span>
                    {isSelected ? <CheckIcon className="size-4 shrink-0" /> : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    ) : null;

  return (
    <div className={cn("relative", className)}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (!disabled) {
            updatePosition();
            setOpen((prev) => !prev);
          }
        }}
        className={cn(
          "flex min-h-8 w-full items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50",
          selectedItems.length === 0 && "text-muted-foreground",
        )}
      >
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          {selectedItems.length === 0 ? (
            <span className="truncate">{placeholder}</span>
          ) : (
            selectedItems.map((item) => (
              <span
                key={item.value}
                className="inline-flex max-w-full items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-foreground"
              >
                <span className="truncate">{item.label}</span>
                <span
                  role="button"
                  tabIndex={-1}
                  className="rounded-sm p-0.5 hover:bg-background/80"
                  onClick={(e) => removeValue(item.value, e)}
                  aria-label={`Remove ${item.label}`}
                >
                  <XIcon className="size-3" />
                </span>
              </span>
            ))
          )}
        </span>
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
      </button>
      {mounted ? createPortal(menu, document.body) : null}
    </div>
  );
}
