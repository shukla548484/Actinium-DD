"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { format } from "date-fns"
import { Calendar as CalendarIcon, Check, ChevronsUpDown } from "lucide-react"
import { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useVessels } from "@/hooks/useStaticData"
import {
  ClearableInput,
  FilterFieldShell,
  filterTriggerClearPadding,
} from "@/components/ui/clearable-input"

interface Vendor {
  id: string
  name: string
}

interface PurchaseOrdersFilterProps {
  vendors: Vendor[]
  vessels?: { id: string; name: string }[]
}

export function PurchaseOrdersFilter({ vendors, vessels: propVessels = [] }: PurchaseOrdersFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Fetch all active vessels using the hook
  const { data: fetchedVessels = [], isLoading: vesselsLoading } = useVessels({ 
    limit: 100, 
    isActive: true 
  })

  // Use fetched vessels if available, otherwise fall back to prop vessels
  const vessels = fetchedVessels.length > 0 ? fetchedVessels : propVessels

  const [selectedVesselIds, setSelectedVesselIds] = React.useState<Set<string>>(() => {
    const vesselIdsParam = searchParams.get("vesselId")
    if (vesselIdsParam) {
      const ids = vesselIdsParam.split(",").filter(Boolean)
      return new Set(ids)
    }
    return new Set<string>()
  })
  const [poNumber, setPoNumber] = React.useState(searchParams.get("poNumber") || "")
  const [requisitionNumber, setRequisitionNumber] = React.useState(searchParams.get("requisitionNumber") || "")
  const [selectedVendorIds, setSelectedVendorIds] = React.useState<Set<string>>(() => {
    const vendorIdsParam = searchParams.get("vendorId")
    if (vendorIdsParam) {
      // Support both single vendorId and comma-separated multiple vendorIds
      const ids = vendorIdsParam.split(",").filter(Boolean)
      return new Set(ids)
    }
    return new Set<string>()
  })
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>({
    from: searchParams.get("startDate") ? new Date(searchParams.get("startDate")!) : undefined,
    to: searchParams.get("endDate") ? new Date(searchParams.get("endDate")!) : undefined,
  })
  const [openVendor, setOpenVendor] = React.useState(false)
  const [openVessel, setOpenVessel] = React.useState(false)

  const handleSearch = () => {
    const params = new URLSearchParams()
    if (selectedVesselIds.size > 0) {
      params.set("vesselId", Array.from(selectedVesselIds).join(","))
    }
    if (poNumber) params.set("poNumber", poNumber)
    if (requisitionNumber) params.set("requisitionNumber", requisitionNumber)
    if (selectedVendorIds.size > 0) {
      params.set("vendorId", Array.from(selectedVendorIds).join(","))
    }
    if (dateRange?.from) params.set("startDate", dateRange.from.toISOString())
    if (dateRange?.to) params.set("endDate", dateRange.to.toISOString())

    router.push(`/purchase/purchase-orders?${params.toString()}`)
  }

  const handleClear = () => {
    setSelectedVesselIds(new Set())
    setPoNumber("")
    setRequisitionNumber("")
    setSelectedVendorIds(new Set())
    setDateRange(undefined)
    router.push("/purchase/purchase-orders")
  }

  const toggleVendor = (vendorId: string) => {
    setSelectedVendorIds((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(vendorId)) {
        newSet.delete(vendorId)
      } else {
        newSet.add(vendorId)
      }
      return newSet
    })
  }

  const toggleVessel = (id: string) => {
    setSelectedVesselIds((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const unselectAllVendors = () => {
    setSelectedVendorIds(new Set())
  }

  const unselectAllVessels = () => {
    setSelectedVesselIds(new Set())
  }

  return (
    <div className="flex flex-col gap-4 p-4 border rounded-lg bg-card text-card-foreground shadow-sm mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="flex flex-col space-y-2">
          <Label htmlFor="vessel">Vessel</Label>
          <FilterFieldShell
            showClear={selectedVesselIds.size > 0}
            onClear={unselectAllVessels}
            hasDropdownChevron
            className="max-w-none"
          >
          <Popover open={openVessel} onOpenChange={setOpenVessel}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={openVessel}
                className={cn(
                  "w-full justify-between",
                  filterTriggerClearPadding(selectedVesselIds.size > 0, true)
                )}
                disabled={vesselsLoading}
              >
                {selectedVesselIds.size === 0
                  ? vesselsLoading
                    ? "Loading vessels..."
                    : "Select vessel(s)..."
                  : selectedVesselIds.size === 1
                  ? vessels.find((v) => v.id === Array.from(selectedVesselIds)[0])?.name ||
                    "Select vessel(s)..."
                  : `${selectedVesselIds.size} vessel(s) selected`}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0">
              <Command>
                <CommandInput placeholder="Search vessel..." />
                <CommandList>
                  <CommandEmpty>
                    {vesselsLoading ? "Loading vessels..." : "No vessel found."}
                  </CommandEmpty>
                  {selectedVesselIds.size > 0 && (
                    <CommandGroup>
                      <CommandItem
                        onSelect={unselectAllVessels}
                        className="text-red-600 font-medium"
                      >
                        <Check className="mr-2 h-4 w-4 opacity-0" />
                        Unselect All
                      </CommandItem>
                    </CommandGroup>
                  )}
                  <CommandGroup>
                    {vessels.map((vessel) => (
                      <CommandItem
                        key={vessel.id}
                        value={vessel.name}
                        onSelect={() => {
                          toggleVessel(vessel.id)
                        }}
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
          <Label htmlFor="poNumber">PO Number</Label>
          <ClearableInput
            id="poNumber"
            placeholder="Search PO number..."
            value={poNumber}
            onChange={(e) => setPoNumber(e.target.value)}
            onClear={() => setPoNumber("")}
            className="h-9 text-sm"
          />
        </div>
        <div className="flex flex-col space-y-2">
          <Label htmlFor="requisitionNumber">Requisition Number</Label>
          <ClearableInput
            id="requisitionNumber"
            placeholder="Search requisition number..."
            value={requisitionNumber}
            onChange={(e) => setRequisitionNumber(e.target.value)}
            onClear={() => setRequisitionNumber("")}
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
                variant={"outline"}
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !dateRange && "text-muted-foreground",
                  filterTriggerClearPadding(Boolean(dateRange?.from || dateRange?.to))
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "LLL dd, y")} -{" "}
                      {format(dateRange.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(dateRange.from, "LLL dd, y")
                  )
                ) : (
                  <span>Pick a date</span>
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
            onClear={unselectAllVendors}
            hasDropdownChevron
            className="max-w-none"
          >
          <Popover open={openVendor} onOpenChange={setOpenVendor}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={openVendor}
                className={cn(
                  "w-full justify-between",
                  filterTriggerClearPadding(selectedVendorIds.size > 0, true)
                )}
              >
                {selectedVendorIds.size === 0
                  ? "Select vendor(s)..."
                  : selectedVendorIds.size === 1
                  ? vendors.find((vendor) => vendor.id === Array.from(selectedVendorIds)[0])?.name || "Select vendor(s)..."
                  : `${selectedVendorIds.size} vendor(s) selected`}
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
                        onSelect={unselectAllVendors}
                        className="text-red-600 font-medium"
                      >
                        <Check className="mr-2 h-4 w-4 opacity-0" />
                        Unselect All
                      </CommandItem>
                    </CommandGroup>
                  )}
                  <CommandGroup>
                    {vendors.map((vendor) => (
                      <CommandItem
                        key={vendor.id}
                        value={vendor.name}
                        onSelect={() => {
                          toggleVendor(vendor.id)
                        }}
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
      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={handleClear}>
          Clear Filters
        </Button>
        <Button onClick={handleSearch}>Apply Filters</Button>
      </div>
    </div>
  )
}
