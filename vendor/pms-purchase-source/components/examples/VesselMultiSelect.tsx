"use client";

import React from "react";
import { MultiSelectDropdown, MultiSelectOption } from "@/components/ui/multi-select-dropdown";

interface Vessel {
  id: string;
  name: string;
  code: string;
  imoNumber?: string;
  company?: {
    name: string;
  };
}

interface VesselMultiSelectProps {
  vessels: Vessel[];
  selectedVessels: string[];
  onSelectionChange: (selectedVessels: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function VesselMultiSelect({
  vessels,
  selectedVessels,
  onSelectionChange,
  placeholder = "Select vessels...",
  className,
}: VesselMultiSelectProps) {
  const vesselOptions: MultiSelectOption[] = vessels.map((vessel) => ({
    value: vessel.id,
    label: `${vessel.name} (${vessel.code})`,
    description: `${vessel.company?.name || 'N/A'} • IMO: ${vessel.imoNumber || 'N/A'}`
  }));

  return (
    <MultiSelectDropdown
      options={vesselOptions}
      selectedValues={selectedVessels}
      onSelectionChange={onSelectionChange}
      placeholder={placeholder}
      searchPlaceholder="Search vessels..."
      className={className}
      showSelectedCount={true}
    />
  );
}