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

type ProjectOption = { id: string; name: string };

export function DryDockProjectSelect({
  value,
  onChange,
  required,
  label = "Dry dock project",
}: {
  value: string;
  onChange: (id: string) => void;
  required?: boolean;
  label?: string;
}) {
  const [projects, setProjects] = useState<ProjectOption[]>([]);

  useEffect(() => {
    void fetch("/api/superintendent/project-options")
      .then((r) => r.json())
      .then((d) => setProjects(d.projects ?? []));
  }, []);

  const projectItems = useMemo(
    () => mapSelectItems(projects, (p) => p.id, (p) => p.name),
    [projects],
  );

  return (
    <div className="space-y-2">
      <Label>{label}{required ? " *" : ""}</Label>
      <Select
        items={projectItems}
        value={value || null}
        onValueChange={(v) => onChange(v ?? "")}
        required={required}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select project" />
        </SelectTrigger>
        <SelectContent>
          {projects.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
