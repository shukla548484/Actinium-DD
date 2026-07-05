import { STANDARD_JOB_INPUT_TEMPLATE } from "@/lib/vessel/jobLibrary/inputTemplate";
import type { JobInputFieldDef } from "@/lib/vessel/jobLibrary/inputTemplate";
import type { MtilDynamicTemplateDef, MtilMeasurementRef } from "./types";
import { resolveChecklist } from "./checklistLibrary";
import { resolveMeasurements } from "./measurementLibrary";
import {
  getAllPhase1Templates,
  getPhase1TemplateByKey,
  getPhase1TemplateCatalog,
} from "./phases/phase1/templateCatalog";
import {
  getAllPhase2Templates,
  getPhase2TemplateByKey,
  getPhase2TemplateCatalog,
} from "./phases/phase2/templateCatalog";
import { getAllWorkbookTemplateDefs } from "./phases/shared/workbookRegistry";
import {
  getAllPhase3Templates,
  getPhase3TemplateByKey,
  getPhase3TemplateCatalog,
} from "./phases/phase3/templateCatalog";

/** Build registry from Phase 1–3 catalog + Phase 2 v0.5 workbook + supplemental templates. */
export const MTIL_DYNAMIC_TEMPLATES: Record<string, MtilDynamicTemplateDef> = Object.fromEntries(
  [
    ...getAllPhase1Templates(),
    ...getAllPhase2Templates(),
    ...getAllPhase3Templates(),
    ...getAllWorkbookTemplateDefs(),
  ].map((t) => [t.key, t]),
);

function measurementFields(measurements: MtilMeasurementRef[]): JobInputFieldDef[] {
  return measurements.map((m) => ({
    key: `meas_${m.code}`,
    label: `${m.label} (${m.unit})${m.tolerance ? ` — ${m.tolerance}` : ""}`,
    type: "number" as const,
    required: m.required,
    unit: m.unit,
    section: "condition" as const,
  }));
}

function checklistNoteField(checklistKey: string): JobInputFieldDef[] {
  const items = resolveChecklist(checklistKey);
  if (items.length === 0) return [];
  return [
    {
      key: `checklist_${checklistKey}`,
      label: "Inspection checklist",
      type: "textarea",
      section: "condition",
    },
  ];
}

function photoFields(slots: string[]): JobInputFieldDef[] {
  if (slots.length === 0) return [];
  return [
    {
      key: "photosNote",
      label: `Photos (${slots.join(", ")})`,
      type: "photos_note",
      section: "condition",
    },
  ];
}

function attachmentFields(attachments: string[]): JobInputFieldDef[] {
  if (attachments.length === 0) return [];
  return [
    {
      key: "attachmentsNote",
      label: `Attachments (${attachments.join(", ")})`,
      type: "textarea",
      section: "condition",
    },
  ];
}

function reportFields(reports: string[]): JobInputFieldDef[] {
  if (reports.length === 0) return [];
  return [
    {
      key: "reportsNote",
      label: `Reports (${reports.join(", ")})`,
      type: "textarea",
      section: "approval",
    },
  ];
}

/** Resolve a dynamic template key into a full input form definition (code registry fallback). */
export function resolveDynamicTemplate(templateKey: string): JobInputFieldDef[] {
  const def = MTIL_DYNAMIC_TEMPLATES[templateKey];
  if (!def) return STANDARD_JOB_INPUT_TEMPLATE;

  const base = STANDARD_JOB_INPUT_TEMPLATE.filter(
    (f) =>
      !f.key.startsWith("meas_") &&
      f.key !== "photosNote" &&
      f.key !== "attachmentsNote" &&
      f.key !== "reportsNote",
  );

  const measurements = def.measurementRefs
    ? measurementFields(resolveMeasurements(def.measurementRefs))
    : [];

  const checklists = (def.checklistRefs ?? []).flatMap(checklistNoteField);
  const photos = photoFields(def.photoSlots ?? ["before", "after"]);
  const attachments = attachmentFields(def.requiredAttachments ?? []);
  const reports = reportFields(def.requiredReports ?? []);
  const extra = def.extraFields ?? [];

  const classField: JobInputFieldDef[] = def.classHoldPoint
    ? [
        {
          key: "classHoldPointConfirmed",
          label: "Class hold point completed",
          type: "boolean",
          section: "approval",
        },
      ]
    : [];

  const qaField: JobInputFieldDef[] = def.qaQcRequired
    ? [
        {
          key: "qaQcSignOff",
          label: "QA/QC sign-off reference",
          type: "text",
          section: "approval",
        },
      ]
    : [];

  const permitField: JobInputFieldDef[] = def.permitRequired
    ? [
        {
          key: "permitVerified",
          label: "Permit to work verified",
          type: "boolean",
          section: "approval",
        },
      ]
    : [];

  return [
    ...base,
    ...measurements,
    ...checklists,
    ...photos,
    ...attachments,
    ...reports,
    ...extra,
    ...classField,
    ...qaField,
    ...permitField,
  ];
}

/** Prefer persisted JobDynamicTemplate; fall back to workbook bundle + code registry. */
export async function resolveDynamicTemplateAsync(templateKey: string): Promise<JobInputFieldDef[]> {
  try {
    const { resolveTemplateByKey } = await import("@/lib/mtil/db/resolveTemplate");
    const resolved = await resolveTemplateByKey(templateKey);
    if (resolved?.length) return resolved;
  } catch {
    // DB tables may not exist yet during bootstrap
  }
  return resolveDynamicTemplate(templateKey);
}

export function listDynamicTemplateKeys(): string[] {
  return Object.keys(MTIL_DYNAMIC_TEMPLATES);
}

export function listPhase1CatalogTemplateKeys(): string[] {
  return getPhase1TemplateCatalog().map((t) => t.key);
}

export function listPhase2CatalogTemplateKeys(): string[] {
  return getPhase2TemplateCatalog().map((t) => t.key);
}

export function listPhase3CatalogTemplateKeys(): string[] {
  return getPhase3TemplateCatalog().map((t) => t.key);
}

export function getDynamicTemplateDef(key: string): MtilDynamicTemplateDef | null {
  return (
    getPhase1TemplateByKey(key) ??
    getPhase2TemplateByKey(key) ??
    getPhase3TemplateByKey(key) ??
    MTIL_DYNAMIC_TEMPLATES[key] ??
    null
  );
}
