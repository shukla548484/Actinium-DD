import type { DryDockProjectType } from "@prisma/client";
import type { DdProjectModuleId } from "@/lib/superintendent/engine/projectModules";

export type InputPageKey =
  | "vessel"
  | "superintendent"
  | "review"
  | "survey"
  | "workshop"
  | "budget"
  | "procurement"
  | "daily_progress"
  | "closeout";

export type InputResponsibleRole =
  | "vessel"
  | "superintendent"
  | "shipyard"
  | "purchase"
  | "class"
  | "accounts";

export type InputFieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "select"
  | "boolean"
  | "photos_note";

export type InputFieldDef = {
  key: string;
  label: string;
  type: InputFieldType;
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  unit?: string;
};

export type InputSectionDef = {
  key: string;
  label: string;
  description?: string;
  pageKey: InputPageKey;
  moduleId: DdProjectModuleId;
  enteredBy: InputResponsibleRole;
  reviewedBy?: InputResponsibleRole;
  approvedBy?: InputResponsibleRole;
  projectTypes: DryDockProjectType[];
  mandatory?: boolean;
  attachmentRequired?: boolean;
  fields: InputFieldDef[];
};

export type InputSectionCatalogEntry = InputSectionDef & {
  areaLabel?: string;
};
