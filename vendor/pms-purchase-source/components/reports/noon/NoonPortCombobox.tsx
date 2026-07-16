"use client";

import { useEffect, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

type PortSearchItem = {
  id: string;
  name: string;
  country: string;
  code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export function NoonPortCombobox({
  value,
  onChange,
  disabled,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PortSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [manualPort, setManualPort] = useState("");

  useEffect(() => {
    if (open) {
      setManualPort(value || "");
    }
  }, [open, value]);

  useEffect(() => {
    if (!open) {
      setResults([]);
      return;
    }

    const fetchPorts = async (searchQuery: string = "") => {
      setLoading(true);
      try {
        const url = `/api/ports/search?limit=50${searchQuery ? `&q=${encodeURIComponent(searchQuery.trim())}` : ""}`;
        const res = await fetch(url, {
          credentials: "include",
        });
        if (!res.ok) {
          setResults([]);
          return;
        }
        const data = await res.json();
        setResults((data?.ports || []) as PortSearchItem[]);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    if (!query || query.trim().length < 1) {
      fetchPorts("");
      return;
    }

    const timeoutId = setTimeout(() => {
      fetchPorts(query);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [open, query]);

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setQuery("");
          setResults([]);
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between text-left font-normal", !value && "text-muted-foreground")}
          type="button"
          disabled={disabled}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <div className="flex flex-col">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Search ports..." value={query} onValueChange={setQuery} />
            <CommandList>
              <CommandEmpty>{loading ? "Searching..." : "No ports found."}</CommandEmpty>
              <CommandGroup heading="Directory">
                {query.trim().length > 0 && (
                  <CommandItem
                    value={`__use_query__${query}`}
                    onPointerDown={(e) => e.preventDefault()}
                    onSelect={() => {
                      onChange(query.trim());
                      setOpen(false);
                      setQuery("");
                      setResults([]);
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4 opacity-0")} />
                    <span className="truncate">Use &quot;{query.trim()}&quot; as port name</span>
                  </CommandItem>
                )}
                {results.map((port) => (
                  <CommandItem
                    key={port.id}
                    value={port.id}
                    keywords={[port.name, port.country || "", port.code || ""].filter(Boolean)}
                    onPointerDown={(e) => e.preventDefault()}
                    onSelect={() => {
                      onChange(port.name);
                      setOpen(false);
                      setQuery("");
                      setResults([]);
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === port.name ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">
                      {port.name}
                      {port.code ? ` (${port.code})` : ""}
                      {port.country ? ` — ${port.country}` : ""}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
          <div className="border-t bg-muted/30 p-2">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Other (not in list)</p>
            <div className="flex gap-2">
              <Input
                value={manualPort}
                onChange={(e) => setManualPort(e.target.value)}
                onMouseDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                placeholder="Type port name manually"
                className="h-8 text-sm"
                disabled={disabled}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="shrink-0"
                disabled={disabled || !manualPort.trim()}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(manualPort.trim());
                  setOpen(false);
                  setQuery("");
                  setResults([]);
                }}
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
