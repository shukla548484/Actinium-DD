"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  impaCatalogCodePlaceholder,
  impaCatalogItemNamePlaceholder,
  usesChemicalImpaSearchScope,
  usesImpaCatalogSearch,
  usesProvisionImpaSearchScope,
} from "@/lib/requisition-impa-catalog";
import { cn } from "@/lib/utils";

type ImpaHit = { id: string; impaCode: string; itemName: string; unit?: string | null };

type Props = {
  requisitionType: string;
  subCategoryCode?: string;
  itemName: string;
  impaCode: string;
  onSelect: (hit: { itemName: string; impaCode: string; unit?: string }) => void;
  onItemNameChange: (value: string) => void;
  onImpaCodeChange: (value: string) => void;
};

export function ImpaItemSearchFields({
  requisitionType,
  subCategoryCode = "",
  itemName,
  impaCode,
  onSelect,
  onItemNameChange,
  onImpaCodeChange,
}: Props) {
  const enabled = usesImpaCatalogSearch(requisitionType);
  const subCats = subCategoryCode ? [subCategoryCode] : [];
  const [hits, setHits] = useState<ImpaHit[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function scopeParam(): string | null {
    if (usesProvisionImpaSearchScope(requisitionType)) return "provision";
    if (usesChemicalImpaSearchScope(requisitionType, subCats)) return "chemical";
    return null;
  }

  function runSearch(query: string) {
    if (!enabled) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void (async () => {
        const scope = scopeParam();
        const q = query.trim();
        if (!scope && q.length < 2) {
          setHits([]);
          setOpen(false);
          return;
        }
        if (scope && q.length === 1) {
          setHits([]);
          return;
        }
        setSearching(true);
        try {
          const params = new URLSearchParams();
          params.set("q", q);
          params.set("limit", scope ? "40" : "20");
          if (scope) params.set("scope", scope);
          const res = await fetch(`/api/purchase/impa-codes/search?${params}`);
          const data = res.ok ? await res.json() : { impaCodes: [] };
          const list = (data.impaCodes as ImpaHit[]) ?? [];
          setHits(list);
          setOpen(list.length > 0);
        } catch {
          setHits([]);
          setOpen(false);
        } finally {
          setSearching(false);
        }
      })();
    }, 300);
  }

  if (!enabled) {
    return (
      <>
        <Input
          value={itemName}
          onChange={(e) => onItemNameChange(e.target.value)}
          placeholder="Item name"
        />
        <Input
          value={impaCode}
          onChange={(e) => onImpaCodeChange(e.target.value)}
          placeholder="Part / IMPA (optional)"
        />
      </>
    );
  }

  return (
    <>
      <div ref={wrapRef} className="relative">
        <Input
          value={itemName}
          onChange={(e) => {
            onItemNameChange(e.target.value);
            runSearch(e.target.value);
          }}
          onFocus={() => {
            if (hits.length) setOpen(true);
            else if (scopeParam()) runSearch(itemName);
          }}
          placeholder={impaCatalogItemNamePlaceholder(requisitionType, subCats)}
          autoComplete="off"
        />
        {open && hits.length > 0 ? (
          <ul className="absolute z-30 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-popover py-1 text-sm shadow-md">
            {hits.map((hit) => (
              <li key={hit.id}>
                <button
                  type="button"
                  className={cn(
                    "flex w-full flex-col items-start gap-0.5 px-2.5 py-1.5 text-left hover:bg-muted",
                  )}
                  onClick={() => {
                    onSelect({
                      itemName: hit.itemName,
                      impaCode: hit.impaCode,
                      unit: hit.unit ?? undefined,
                    });
                    setOpen(false);
                  }}
                >
                  <span className="font-medium text-foreground">{hit.itemName}</span>
                  <span className="text-xs text-muted-foreground">
                    {hit.impaCode}
                    {hit.unit ? ` · ${hit.unit}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {searching ? (
          <span className="pointer-events-none absolute right-2 top-2 text-[10px] text-muted-foreground">
            …
          </span>
        ) : null}
      </div>
      <Input
        value={impaCode}
        onChange={(e) => {
          onImpaCodeChange(e.target.value);
          runSearch(e.target.value);
        }}
        placeholder={impaCatalogCodePlaceholder(requisitionType, subCats)}
        autoComplete="off"
      />
    </>
  );
}
