"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ProjectDefectsExcelPanel } from "@/components/superintendent/ProjectDefectsExcelPanel";
import {
  InputPhotosOverview,
  parseInputPhotos,
} from "@/components/superintendent/InputPhotosOverview";
import type { InputSubmissionDto } from "@/lib/db/superintendent/inputs";

type Props = {
  dryDockProjectId: string;
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  enteredByName: string;
  onEnteredByNameChange: (value: string) => void;
  disabled?: boolean;
  onSubmissionSynced?: (submission: InputSubmissionDto) => void;
  onDefectCountChange?: (count: number) => void;
};

export function CurrentDefectsPanel({
  dryDockProjectId,
  values,
  onChange,
  enteredByName,
  onEnteredByNameChange,
  disabled,
  onSubmissionSynced,
  onDefectCountChange,
}: Props) {
  const pmsOverdue = values.pmsOverdue == null ? "" : String(values.pmsOverdue);
  const machineryStatus = values.machineryStatus == null ? "" : String(values.machineryStatus);

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="enteredByName">Entered by (name)</Label>
        <Input
          id="enteredByName"
          className="mt-1.5"
          value={enteredByName}
          onChange={(e) => onEnteredByNameChange(e.target.value)}
          placeholder="Chief Engineer / Master"
          disabled={disabled}
        />
      </div>

      <ProjectDefectsExcelPanel
        dryDockProjectId={dryDockProjectId}
        disabled={disabled}
        onSubmissionSynced={onSubmissionSynced}
        onDefectCountChange={onDefectCountChange}
      />

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor="field-pmsOverdue">PMS overdue items</Label>
          <Textarea
            id="field-pmsOverdue"
            className="mt-1.5"
            rows={4}
            value={pmsOverdue}
            onChange={(e) => onChange("pmsOverdue", e.target.value)}
            disabled={disabled}
          />
        </div>
        <div>
          <Label htmlFor="field-machineryStatus">Machinery status notes</Label>
          <Textarea
            id="field-machineryStatus"
            className="mt-1.5"
            rows={4}
            value={machineryStatus}
            onChange={(e) => onChange("machineryStatus", e.target.value)}
            disabled={disabled}
          />
        </div>
      </div>

      <InputPhotosOverview
        photos={parseInputPhotos(values.photos)}
        onChange={(photos) => onChange("photos", photos)}
        disabled={disabled}
        label="Photos — overview (optional)"
      />
    </div>
  );
}
