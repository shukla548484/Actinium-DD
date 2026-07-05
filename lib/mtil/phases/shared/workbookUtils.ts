import type { ParsedMasterJobRow, ParsedMtilWorkbook, ParsedTemplateRow } from "@/lib/mtil/import/parseWorkbook";
import type { MtilDynamicTemplateDef } from "@/lib/mtil/types";
import type { JobInputFieldDef } from "@/lib/vessel/jobLibrary/inputTemplate";
import { STANDARD_JOB_INPUT_TEMPLATE } from "@/lib/vessel/jobLibrary/inputTemplate";
import type { JobManualInputFieldDef } from "@/lib/jobCatalog/types";

/** Map commercial template ID to a stable dynamic template key. */
export function templateIdToKey(templateId: string): string {
  return templateId.toLowerCase().replace(/-/g, "_");
}

/** Convert dynamic template key back to commercial template ID when possible. */
export function keyToTemplateId(key: string): string | null {
  const upper = key.toUpperCase().replace(/_/g, "-");
  if (upper.startsWith("TMPL-") || upper.startsWith("TMP-")) return upper.replace(/^TMP-/, "TMPL-");
  if (key.startsWith("TMP-") || key.startsWith("TMPL-")) return key.replace(/^TMP-/, "TMPL-");
  const asId = key.toUpperCase().replace(/_/g, "-");
  if (asId.startsWith("TMPL-") || asId.startsWith("TMP-")) return asId.replace(/^TMP-/, "TMPL-");
  return null;
}

export function getWorkbookTemplateById(
  templateId: string,
  data: ParsedMtilWorkbook,
): ParsedTemplateRow | null {
  return data.templates.find((t) => t.templateId === templateId) ?? null;
}

export function getWorkbookTemplateByKey(
  templateKey: string,
  data: ParsedMtilWorkbook,
): ParsedTemplateRow | null {
  const id = keyToTemplateId(templateKey);
  if (!id) return null;
  return getWorkbookTemplateById(id, data);
}

function manualFieldsFromWorkbook(fields: JobManualInputFieldDef[]): JobInputFieldDef[] {
  return fields.map((f) => ({
    key: f.key,
    label: f.label,
    type: (f.type === "boolean" || f.type === "select"
      ? f.type
      : f.type === "number"
        ? "number"
        : f.type === "date"
          ? "date"
          : "textarea") as JobInputFieldDef["type"],
    required: f.required,
    unit: f.unit,
    options: f.options,
    section: (f.section as JobInputFieldDef["section"]) ?? "condition",
  }));
}

/**
 * Build full runtime form from a bundled engineering workbook — works without DB seed.
 */
export function buildWorkbookRuntimeFields(
  templateKeyOrId: string,
  data: ParsedMtilWorkbook,
): JobInputFieldDef[] | null {
  const templateId = templateKeyOrId.startsWith("TMP-") || templateKeyOrId.startsWith("TMPL-")
    ? templateKeyOrId.replace(/^TMP-/, "TMPL-")
    : keyToTemplateId(templateKeyOrId);
  if (!templateId) return null;

  const row = getWorkbookTemplateById(templateId, data);
  if (!row) return null;

  const def = workbookTemplatesToDynamicDefs(data).find((t) => t.templateId === templateId);

  const manual = manualFieldsFromWorkbook(row.manualInputFields);
  const measurements = data.measurements
    .filter((m) => m.templateId === templateId)
    .map((m) => ({
      key: `meas_${m.measurementId}`,
      label: `${m.measurementName} (${m.unit})${m.targetValue ? ` — ${m.targetValue}` : ""}`,
      type: "number" as const,
      required: m.mandatoryFlag,
      unit: m.unit,
      section: "condition" as const,
    }));

  const checklistItems = data.checklistItems.filter((c) => c.templateId === templateId);
  const checklists: JobInputFieldDef[] =
    checklistItems.length > 0
      ? [
          {
            key: `checklist_${row.checklistId ?? templateId}`,
            label: `Inspection checklist (${checklistItems.length} items)`,
            type: "textarea",
            section: "condition",
          },
        ]
      : [];

  const base = STANDARD_JOB_INPUT_TEMPLATE.filter(
    (f) =>
      !manual.some((m) => m.key === f.key) &&
      !f.key.startsWith("meas_") &&
      !f.key.startsWith("checklist_") &&
      f.key !== "photosNote",
  );

  const photos: JobInputFieldDef[] =
    row.requiredPhotos.length > 0
      ? [{ key: "photosNote", label: "Photos", type: "photos_note", section: "condition" }]
      : [];

  const classField: JobInputFieldDef[] = def?.classHoldPoint
    ? [{ key: "classHoldPointConfirmed", label: "Class hold point completed", type: "boolean", section: "approval" }]
    : [];

  const qaField: JobInputFieldDef[] = def?.qaQcRequired
    ? [{ key: "qaQcSignOff", label: "QA/QC sign-off reference", type: "text", section: "approval" }]
    : [];

  const permitField: JobInputFieldDef[] = def?.permitRequired
    ? [{ key: "permitVerified", label: "Permit to work verified", type: "boolean", section: "approval" }]
    : [];

  return [...base, ...measurements, ...manual, ...checklists, ...photos, ...classField, ...qaField, ...permitField];
}

function photoSlotsFromTemplate(row: ParsedTemplateRow): MtilDynamicTemplateDef["photoSlots"] {
  const slots = row.requiredPhotos.map((p) => {
    const s = p.label.toLowerCase();
    if (s.includes("before")) return "before" as const;
    if (s.includes("during") || s.includes("opened") || s.includes("dismant")) return "during" as const;
    if (s.includes("after") || s.includes("final")) return "after" as const;
    if (s.includes("nameplate")) return "report" as const;
    return "after" as const;
  });
  return [...new Set(slots.length ? slots : (["before", "after"] as const))];
}

/** Convert workbook tab-02 rows into runtime template defs (code registry fallback). */
export function workbookTemplatesToDynamicDefs(data: ParsedMtilWorkbook): MtilDynamicTemplateDef[] {
  return data.templates.map((row) => ({
    key: templateIdToKey(row.templateId),
    templateId: row.templateId,
    label: row.templateName,
    photoSlots: photoSlotsFromTemplate(row),
    autoFill: [
      "vessel.name",
      "vessel.imo",
      "machinery.runningHours",
      "machinery.lastOverhaul",
      "machinery.maker",
      "machinery.model",
    ],
    classHoldPoint: data.workflows.some(
      (w) => w.templateId === row.templateId && w.classApprovalRequired,
    ),
    qaQcRequired: row.templateCategory === "machinery_overhaul" || row.templateCategory === "testing",
    permitRequired: row.requiredAttachments.some((a) => a.label.toLowerCase().includes("permit")),
    requiredAttachments: row.requiredAttachments.map((a) => a.key ?? a.label.toLowerCase().replace(/\s+/g, "_")),
    requiredReports: ["completion_report"],
    approvalWorkflow: ["crew_submit", "ce_review", "master_review", "superintendent_approve"],
    checklistRefs: row.checklistId ? [row.checklistId] : undefined,
    measurementRefs: row.measurementSetId ? [row.measurementSetId] : undefined,
  }));
}

export function getWorkbookStats(
  data: ParsedMtilWorkbook,
  opts: { phase: number; source: string; idPrefix: string; version: string },
) {
  const machinery = new Set(data.masterJobs.map((j) => j.machinery));
  const components = new Set(data.masterJobs.map((j) => `${j.machinery}|${j.component}`));
  return {
    phase: opts.phase,
    source: opts.source,
    libraryVersion: data.libraryVersion ?? opts.version,
    jobCount: data.masterJobs.length,
    catalogTemplateCount: data.templates.length,
    dynamicTemplateCount: data.templates.length,
    systemCount: machinery.size,
    componentCount: components.size,
    measurementCount: data.measurements.length,
    checklistItemCount: data.checklistItems.length,
    scopeStepCount: data.scopeSteps.length,
    spareMappingCount: data.spares.length,
    rfqMappingCount: data.rfqMappings.length,
    idPrefix: opts.idPrefix,
  };
}

export function getWorkbookJobById(jobId: string, data: ParsedMtilWorkbook): ParsedMasterJobRow | null {
  return data.masterJobs.find((j) => j.jobId === jobId) ?? null;
}
