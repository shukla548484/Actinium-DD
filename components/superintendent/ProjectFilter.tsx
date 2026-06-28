"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { mapSelectItems, type LabeledOption } from "@/lib/ui/labeledSelect";

type ProjectOption = { id: string; name: string };

export function ProjectFilter({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  const [projects, setProjects] = useState<ProjectOption[]>([]);

  useEffect(() => {
    void fetch("/api/superintendent/project-options")
      .then((r) => r.json())
      .then((d) => setProjects(d.projects ?? []));
  }, []);

  const projectItems = useMemo((): LabeledOption[] => {
    return [
      { value: "all", label: "All dry dock projects" },
      ...mapSelectItems(projects, (p) => p.id, (p) => p.name),
    ];
  }, [projects]);

  return (
    <Select
      items={projectItems}
      value={value || "all"}
      onValueChange={(v) => onChange(v ?? "all")}
    >
      <SelectTrigger className={className ?? "w-56"}>
        <SelectValue placeholder="All projects" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All dry dock projects</SelectItem>
        {projects.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
