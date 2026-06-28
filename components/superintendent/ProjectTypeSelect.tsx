"use client";

import { useEffect, useState } from "react";
import { LabeledSelect } from "@/components/ui/LabeledSelect";
import { Label } from "@/components/ui/label";
import { DRY_DOCK_PROJECT_TYPE_ITEMS } from "@/lib/superintendent/engine/projectTypes";
import type { DryDockProjectType } from "@prisma/client";

type TemplatePreview = {
  jobCount: number;
  checklistCount: number;
  milestoneCount: number;
  modules: string[];
};

type Props = {
  value: DryDockProjectType;
  onChange: (value: DryDockProjectType) => void;
};

export function ProjectTypeSelect({ value, onChange }: Props) {
  const [preview, setPreview] = useState<TemplatePreview | null>(null);

  useEffect(() => {
    if (!value) {
      setPreview(null);
      return;
    }
    void fetch(`/api/superintendent/project-templates?type=${encodeURIComponent(value)}`)
      .then((r) => r.json())
      .then((d: { template?: TemplatePreview }) => {
        if (d.template) {
          setPreview({
            jobCount: d.template.jobCount ?? 0,
            checklistCount: d.template.checklistCount ?? 0,
            milestoneCount: d.template.milestoneCount ?? 0,
            modules: d.template.modules ?? [],
          });
        }
      })
      .catch(() => setPreview(null));
  }, [value]);

  return (
    <div className="space-y-2">
      <Label>Project type *</Label>
      <LabeledSelect
        items={DRY_DOCK_PROJECT_TYPE_ITEMS}
        value={value}
        onValueChange={(v) => onChange(v as DryDockProjectType)}
        className="w-full"
        placeholder="Select project type"
      />
      {preview ? (
        <p className="text-xs text-muted-foreground">
          Workspace will include {preview.jobCount} jobs, {preview.checklistCount} checklist items,{" "}
          {preview.milestoneCount} milestones, and {preview.modules.length} enabled modules.
        </p>
      ) : null}
    </div>
  );
}
