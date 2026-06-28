"use client";

import { useEffect, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { mapSelectItems } from "@/lib/ui/labeledSelect";

type VesselOption = { id: string; name: string; code: string };

export function VesselSelect({
  value,
  onChange,
  required,
}: {
  value: string;
  onChange: (id: string) => void;
  required?: boolean;
}) {
  const [vessels, setVessels] = useState<VesselOption[]>([]);

  useEffect(() => {
    void fetch("/api/superintendent/vessels?limit=100")
      .then((r) => r.json())
      .then((d) => setVessels(d.items ?? []));
  }, []);

  const vesselItems = useMemo(
    () => mapSelectItems(vessels, (v) => v.id, (v) => v.name),
    [vessels],
  );

  return (
    <div className="space-y-2">
      <Label>Vessel{required ? " *" : ""}</Label>
      <Select
        items={vesselItems}
        value={value || null}
        onValueChange={(v) => onChange(v ?? "")}
        required={required}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select vessel" />
        </SelectTrigger>
        <SelectContent>
          {vessels.map((v) => (
            <SelectItem key={v.id} value={v.id}>
              {v.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
