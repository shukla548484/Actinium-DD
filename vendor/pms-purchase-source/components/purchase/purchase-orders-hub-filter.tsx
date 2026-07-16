"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Check, ChevronsUpDown, Search } from "lucide-react";
import { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useVessels } from "@/hooks/useStaticData";
import {
  ClearableInput,
  FilterFieldShell,
  filterTriggerClearPadding,
} from "@/components/ui/clearable-input";
import {
  buildPurchaseOrdersHubQuery,
  parsePurchaseOrdersHubFilters,
  type PurchaseOrdersHubFilters,
  type PurchaseOrdersHubTab,
} from "@/lib/purchase/purchase-orders-hub";
import { PO_WORKFLOW_STATUS_LABELS } from "@/lib/types/purchase-order-workflow";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePurchaseOrdersHubTab } from "@/components/purchase/purchase-orders-hub-context";

interface Vendor {
  id: string;
  name: string;
}

type PurchaseOrdersHubFilterProps = {
  vendors?: Vendor[];
};

export function PurchaseOrdersHubFilter({ vendors: initialVendors = [] }: PurchaseOrdersHubFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = usePurchaseOrdersHubTab();
  const [vendors, setVendors] = React.useState<Vendor[]>(initialVendors);
  const { data: fetchedVessels = [], isLoading: vesselsLoading } = useVessels({
    limit: 200,
    isActive: true,
  });
  const vessels = fetchedVessels;

  React.useEffect(() => {
    if (vendors.length > 0) return;
    void fetch("/api/purchase-orders/filter-options", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.vendors)) setVendors(data.vendors);
      })
      .catch(() => {});
  }, [vendors.length]);

  const [draft, setDraft] = React.useState<PurchaseOrdersHubFilters>(() =>
    parsePurchaseOrdersHubFilters(searchParams)
  );
  const [searchInput, setSearchInput] = React.useState(
    () => searchParams.get("q") ?? ""
  );
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>(() => {
    const from = searchParams.get("startDate");
    const to = searchParams.get("endDate");
    return {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    };
  });
  const [openVendor, setOpenVendor] = React.useState(false);
  const [openVessel, setOpenVessel] = React.useState(false);

  React.useEffect(() => {
    const parsed = parsePurchaseOrdersHubFilters(searchParams);
    setDraft(parsed);
    setSearchInput(parsed.searchKeyword);
    setDateRange({
      from: parsed.startDate ? new Date(parsed.startDate) : undefined,
      to: parsed.endDate ? new Date(parsed.endDate) : undefined,
    });
  }, [searchParams]);

  const selectedVesselIds = React.useMemo(() => new Set(draft.vesselIds), [draft.vesselIds]);
  const selectedVendorIds = React.useMemo(() => new Set(draft.vendorIds), [draft.vendorIds]);

  const applyFilters = () => {
    const next: PurchaseOrdersHubFilters = {
      ...draft,
      searchKeyword: searchInput.trim(),
      startDate: dateRange?.from?.toISOString(),
      endDate: dateRange?.to?.toISOString(),
    };
    const qs = buildPurchaseOrdersHubQuery(tab, next);
    router.push(`/purchase/purchase-orders?${qs}`);
  };

  const clearFilters = () => {
    setDraft({
      vesselIds: [],
      poNumber: "",
      requisitionNumber: "",
      vendorIds: [],
      workflowStatus: "all",
      legacyStatus: "all",
      poType: "all",
      searchKeyword: "",
    });
    setSearchInput("");
    setDateRange(undefined);
    router.push(`/purchase/purchase-orders?tab=${tab}`);
  };

  const toggleVessel = (id: string) => {
    setDraft((prev) => {
      const next = new Set(prev.vesselIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, vesselIds: Array.from(next) };
    });
  };

  const toggleVendor = (id: string) => {
    setDraft((prev) => {
      const next = new Set(prev.vendorIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { ...prev, vendorIds: Array.from(next) };
    });
  };

  return (
    <Card variant="filter" className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Filters</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <div className="flex flex-col space-y-2">
            <Label>Vessel</Label>
            <FilterFieldShell
              showClear={selectedVesselIds.size > 0}
              onClear={() => setDraft((p) => ({ ...p, vesselIds: [] }))}
              hasDropdownChevron
              className="max-w-none"
            >
              <Popover open={openVessel} onOpenChange={setOpenVessel}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className={cn(
                      "w-full justify-between",
                      filterTriggerClearPadding(selectedVesselIds.size > 0, true)
                    )}
                    disabled={vesselsLoading}
                  >
                    {selectedVesselIds.size === 0
                      ? vesselsLoading
                        ? "Loading vessels..."
                        : "All vessels"
                      : selectedVesselIds.size === 1
                        ? vessels.find((v) => v.id === draft.vesselIds[0])?.name ?? "1 vessel"
                        : `${selectedVesselIds.size} vessels`}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0">
                  <Command>
                    <CommandInput placeholder="Search vessel..." />
                    <CommandList>
                      <CommandEmpty>
                        {vesselsLoading ? "Loading..." : "No vessel found."}
                      </CommandEmpty>
                      {selectedVesselIds.size > 0 && (
                        <CommandGroup>
                          <CommandItem
                            onSelect={() => setDraft((p) => ({ ...p, vesselIds: [] }))}
                            className="font-medium text-red-600"
                          >
                            Clear selection
                          </CommandItem>
                        </CommandGroup>
                      )}
                      <CommandGroup>
                        {vessels.map((vessel) => (
                          <CommandItem
                            key={vessel.id}
                            value={vessel.name}
                            onSelect={() => toggleVessel(vessel.id)}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedVesselIds.has(vessel.id) ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {vessel.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </FilterFieldShell>
          </div>

          <div className="flex flex-col space-y-2">
            <Label htmlFor="hub-po-number">PO Number</Label>
            <ClearableInput
              id="hub-po-number"
              placeholder="Search PO number..."
              value={draft.poNumber}
              onChange={(e) => setDraft((p) => ({ ...p, poNumber: e.target.value }))}
              onClear={() => setDraft((p) => ({ ...p, poNumber: "" }))}
              className="h-9 text-sm"
            />
          </div>

          <div className="flex flex-col space-y-2">
            <Label htmlFor="hub-req-number">Requisition Number</Label>
            <ClearableInput
              id="hub-req-number"
              placeholder="Search requisition..."
              value={draft.requisitionNumber}
              onChange={(e) => setDraft((p) => ({ ...p, requisitionNumber: e.target.value }))}
              onClear={() => setDraft((p) => ({ ...p, requisitionNumber: "" }))}
              className="h-9 text-sm"
            />
          </div>

          <div className="flex flex-col space-y-2">
            <Label>Issue Date Range</Label>
            <FilterFieldShell
              showClear={Boolean(dateRange?.from || dateRange?.to)}
              onClear={() => setDateRange(undefined)}
              className="max-w-none"
            >
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateRange?.from && "text-muted-foreground",
                      filterTriggerClearPadding(Boolean(dateRange?.from || dateRange?.to))
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "LLL dd, y")} – {format(dateRange.to, "LLL dd, y")}
                        </>
                      ) : (
                        format(dateRange.from, "LLL dd, y")
                      )
                    ) : (
                      <span>Pick dates</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </FilterFieldShell>
          </div>

          <div className="flex flex-col space-y-2">
            <Label>Vendor</Label>
            <FilterFieldShell
              showClear={selectedVendorIds.size > 0}
              onClear={() => setDraft((p) => ({ ...p, vendorIds: [] }))}
              hasDropdownChevron
              className="max-w-none"
            >
              <Popover open={openVendor} onOpenChange={setOpenVendor}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className={cn(
                      "w-full justify-between",
                      filterTriggerClearPadding(selectedVendorIds.size > 0, true)
                    )}
                  >
                    {selectedVendorIds.size === 0
                      ? "All vendors"
                      : selectedVendorIds.size === 1
                        ? vendors.find((v) => v.id === draft.vendorIds[0])?.name ?? "1 vendor"
                        : `${selectedVendorIds.size} vendors`}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0">
                  <Command>
                    <CommandInput placeholder="Search vendor..." />
                    <CommandList>
                      <CommandEmpty>No vendor found.</CommandEmpty>
                      {selectedVendorIds.size > 0 && (
                        <CommandGroup>
                          <CommandItem
                            onSelect={() => setDraft((p) => ({ ...p, vendorIds: [] }))}
                            className="font-medium text-red-600"
                          >
                            Clear selection
                          </CommandItem>
                        </CommandGroup>
                      )}
                      <CommandGroup>
                        {vendors.map((vendor) => (
                          <CommandItem
                            key={vendor.id}
                            value={vendor.name}
                            onSelect={() => toggleVendor(vendor.id)}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                selectedVendorIds.has(vendor.id) ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {vendor.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </FilterFieldShell>
          </div>
        </div>

        <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
          <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col space-y-2">
            <Label>Workflow</Label>
            <Select
              value={draft.workflowStatus}
              onValueChange={(v) => setDraft((p) => ({ ...p, workflowStatus: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="All stages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stages</SelectItem>
                {Object.entries(PO_WORKFLOW_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col space-y-2">
            <Label>Legacy status</Label>
            <Select
              value={draft.legacyStatus}
              onValueChange={(v) => setDraft((p) => ({ ...p, legacyStatus: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="ACTIVE">Issued</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col space-y-2">
            <Label>PO type</Label>
            <Select
              value={draft.poType}
              onValueChange={(v) => setDraft((p) => ({ ...p, poType: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="GOODS">Goods</SelectItem>
                <SelectItem value="FREIGHT">Freight (.FRT)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col space-y-2">
            <Label>Keyword search</Label>
            <div className="flex gap-2">
              <ClearableInput
                placeholder="PO, requisition, heading..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                onClear={() => {
                  setSearchInput("");
                  setDraft((p) => ({ ...p, searchKeyword: "" }));
                }}
                className="h-9 flex-1 text-sm"
              />
              <Button type="button" variant="secondary" size="icon" onClick={applyFilters}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>
          </div>

          <div className="flex shrink-0 justify-end gap-2">
            <Button variant="outline" onClick={clearFilters}>
              Clear Filters
            </Button>
            <Button onClick={applyFilters}>Apply Filters</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
