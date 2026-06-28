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
import { mapSelectItems, type LabeledOption } from "@/lib/ui/labeledSelect";

type TenderOption = { id: string; name: string; status: string };

export function TenderProjectSelect({
  vesselId,
  value,
  onChange,
}: {
  vesselId?: string;
  value: string;
  onChange: (id: string) => void;
}) {
  const [projects, setProjects] = useState<TenderOption[]>([]);

  useEffect(() => {
    const qs = vesselId ? `?vesselId=${encodeURIComponent(vesselId)}` : "";
    void fetch(`/api/superintendent/tender-options${qs}`)
      .then((r) => r.json())
      .then((d) => setProjects(d.projects ?? []));
  }, [vesselId]);

  const tenderItems = useMemo((): LabeledOption[] => {
    return [
      { value: "none", label: "None" },
      ...mapSelectItems(projects, (p) => p.id, (p) => p.name),
    ];
  }, [projects]);

  return (
    <div className="space-y-2">
      <Label>Linked tender project</Label>
      <Select
        items={tenderItems}
        value={value || "none"}
        onValueChange={(v) => onChange(v === "none" ? "" : v ?? "")}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select tender for quote comparison" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">None</SelectItem>
          {projects.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Links this dry dock project to a tender so budget vs quote and live comparison work.
      </p>
    </div>
  );
}
