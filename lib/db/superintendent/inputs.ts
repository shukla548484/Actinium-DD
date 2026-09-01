import type {
  DdInputResponsibleRole,
  DdInputSubmissionStatus,
  DryDockProjectType,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/db/superintendent/pagination";
import {
  getInputSectionDef,
  getMandatorySectionsForProjectType,
  getSectionsForProjectType,
  INPUT_READINESS_PAGE_KEYS,
} from "@/lib/superintendent/inputCatalog";
import type { InputPageKey } from "@/lib/superintendent/inputCatalog/types";
import { validateSafetyEquipmentCounts } from "@/lib/superintendent/safetyEquipmentCounts";
import { validateHullCondition } from "@/lib/superintendent/hullCondition";
import { validateTankCondition } from "@/lib/superintendent/tankCondition";
import { validateTailshaftCondition } from "@/lib/superintendent/tailshaftCondition";
import { validateRudderCondition } from "@/lib/superintendent/rudderCondition";
import { validatePaintingCoating, sanitizePaintingValues } from "@/lib/superintendent/paintingCoating";
import { persistPaintingScopeJobs } from "@/lib/superintendent/paintingScopeJobs";
import {
  parseSeaValveJobId,
  persistSeaValveScopeJob,
} from "@/lib/superintendent/seaValveScopeJobs";
import { sanitizeSeaValveValues, validateSeaValves } from "@/lib/superintendent/seaValves";
import {
  PROPELLER_COATING_JOB_CATEGORY,
  PROPELLER_COATING_JOB_TAG,
  PROPELLER_COATING_JOB_TITLE,
  buildPropellerCoatingJobDescription,
  parsePropellerCoatingJob,
  propellerCoatingCreatesJob,
  validatePropellerCondition,
} from "@/lib/superintendent/propellerCondition";
import { createDdJob, updateDdJob } from "@/lib/db/superintendent/jobs";
import { syncDryDockProjectProgress } from "@/lib/db/superintendent/projectProgress";

export type InputSubmissionDto = {
  id: string;
  dryDockProjectId: string;
  sectionKey: string;
  pageKey: string;
  moduleId: string;
  version: number;
  status: DdInputSubmissionStatus;
  valuesJson: Record<string, unknown>;
  enteredByRole: DdInputResponsibleRole;
  enteredByName: string | null;
  enteredAt: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  linkedJobId: string | null;
  mandatory: boolean;
  attachmentRequired: boolean;
  inactiveAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function mapSubmission(row: {
  id: string;
  dryDockProjectId: string;
  sectionKey: string;
  pageKey: string;
  moduleId: string;
  version: number;
  status: DdInputSubmissionStatus;
  valuesJson: unknown;
  enteredByRole: DdInputResponsibleRole;
  enteredByName: string | null;
  enteredAt: Date | null;
  reviewedByName: string | null;
  reviewedAt: Date | null;
  reviewNotes: string | null;
  approvedByName: string | null;
  approvedAt: Date | null;
  linkedJobId: string | null;
  mandatory: boolean;
  attachmentRequired: boolean;
  inactiveAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): InputSubmissionDto {
  return {
    id: row.id,
    dryDockProjectId: row.dryDockProjectId,
    sectionKey: row.sectionKey,
    pageKey: row.pageKey,
    moduleId: row.moduleId,
    version: row.version,
    status: row.status,
    valuesJson: (row.valuesJson as Record<string, unknown>) ?? {},
    enteredByRole: row.enteredByRole,
    enteredByName: row.enteredByName,
    enteredAt: row.enteredAt?.toISOString() ?? null,
    reviewedByName: row.reviewedByName,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    reviewNotes: row.reviewNotes,
    approvedByName: row.approvedByName,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    linkedJobId: row.linkedJobId,
    mandatory: row.mandatory,
    attachmentRequired: row.attachmentRequired,
    inactiveAt: row.inactiveAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const activeSubmissionWhere = {
  ...notDeleted,
  inactiveAt: null,
} satisfies Prisma.DdInputSubmissionWhereInput;

export async function listActiveInputSubmissions(
  dryDockProjectId: string,
  pageKey?: InputPageKey,
) {
  const rows = await prisma.ddInputSubmission.findMany({
    where: {
      dryDockProjectId,
      ...activeSubmissionWhere,
      ...(pageKey ? { pageKey } : {}),
    },
    orderBy: [{ sectionKey: "asc" }, { version: "desc" }],
  });

  const latestBySection = new Map<string, (typeof rows)[0]>();
  for (const row of rows) {
    if (!latestBySection.has(row.sectionKey)) {
      latestBySection.set(row.sectionKey, row);
    }
  }

  return [...latestBySection.values()].map(mapSubmission);
}

export async function getActiveInputSubmission(dryDockProjectId: string, sectionKey: string) {
  const row = await prisma.ddInputSubmission.findFirst({
    where: { dryDockProjectId, sectionKey, ...activeSubmissionWhere },
    orderBy: { version: "desc" },
  });
  return row ? mapSubmission(row) : null;
}

function validateRequiredFields(
  sectionKey: string,
  valuesJson: Record<string, unknown>,
): string | null {
  const def = getInputSectionDef(sectionKey);
  if (!def) return `Unknown section: ${sectionKey}`;

  for (const field of def.fields) {
    if (!field.required) continue;
    if (field.key === "lsaCounts" || field.key === "ffaCounts") continue;
    if (sectionKey === "sea_valves" && field.key === "valves") continue;
    if (
      sectionKey === "vessel_defects" &&
      (field.type === "photos" ||
        field.type === "photos_note" ||
        field.key === "openDefects" ||
        field.key === "machineryStatus")
    ) {
      continue;
    }
    if (
      sectionKey === "hull_condition" ||
      sectionKey === "tank_condition" ||
      sectionKey === "propeller" ||
      sectionKey === "rudder" ||
      sectionKey === "painting"
    ) {
      continue;
    }
    const val = valuesJson[field.key];
    if (field.type === "multiselect") {
      if (!Array.isArray(val) || val.length === 0) return `${field.label} is required`;
      continue;
    }
    if (field.type === "photos" || field.type === "files") {
      if (!Array.isArray(val) || val.length === 0) return `${field.label} is required`;
      continue;
    }
    if (val === undefined || val === null || val === "") {
      return `${field.label} is required`;
    }
  }
  if (sectionKey === "vessel_safety") {
    return validateSafetyEquipmentCounts(valuesJson);
  }
  if (sectionKey === "hull_condition") {
    return validateHullCondition(valuesJson);
  }
  if (sectionKey === "tank_condition") {
    return validateTankCondition(valuesJson);
  }
  if (sectionKey === "tailshaft") {
    return validateTailshaftCondition(valuesJson);
  }
  if (sectionKey === "propeller") {
    return validatePropellerCondition(valuesJson);
  }
  if (sectionKey === "rudder") {
    return validateRudderCondition(valuesJson);
  }
  if (sectionKey === "painting") {
    return validatePaintingCoating(sanitizePaintingValues(valuesJson));
  }
  if (sectionKey === "sea_valves") {
    return validateSeaValves(valuesJson);
  }
  if (sectionKey === "vessel_defects") {
    const imported = Number(valuesJson.importedDefectCount);
    const open =
      typeof valuesJson.openDefects === "string" ? valuesJson.openDefects.trim() : "";
    if (!(imported > 0) && !open) {
      return "Add at least one defect (table or Excel) before submitting.";
    }
  }
  return null;
}

function storedPropellerCoatingJobId(valuesJson: Record<string, unknown>, linkedJobId: string | null) {
  const fromValues = valuesJson.siliconePaintJobId;
  if (typeof fromValues === "string" && fromValues.trim()) return fromValues.trim();
  return linkedJobId;
}

async function findExistingPropellerCoatingJob(dryDockProjectId: string, storedId: string | null) {
  if (storedId) {
    const byId = await prisma.ddJob.findFirst({
      where: { id: storedId, dryDockProjectId, ...notDeleted },
      select: { id: true, description: true },
    });
    if (byId) return byId;
  }

  const byTitle = await prisma.ddJob.findFirst({
    where: {
      dryDockProjectId,
      title: PROPELLER_COATING_JOB_TITLE,
      category: PROPELLER_COATING_JOB_CATEGORY,
      ...notDeleted,
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, description: true },
  });
  if (byTitle) return byTitle;

  return prisma.ddJob.findFirst({
    where: {
      dryDockProjectId,
      description: { contains: PROPELLER_COATING_JOB_TAG },
      ...notDeleted,
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, description: true },
  });
}

/**
 * On submit, seed "Propeller silicone / anti-friction coating" when coating is not "none".
 * Idempotent via siliconePaintJobId / linkedJobId / title+category / description tag.
 * If later unchecked, leave the existing job: it may already be quoted or in progress, and
 * DdJobStatus has no cancelled state.
 */
async function persistPropellerCoatingJob(
  row: Prisma.DdInputSubmissionGetPayload<object>,
  valuesJson: Record<string, unknown>,
): Promise<Prisma.DdInputSubmissionGetPayload<object>> {
  const coating = parsePropellerCoatingJob(valuesJson.coatingJob);
  if (!coating || !propellerCoatingCreatesJob(coating)) {
    // Leave any existing job: it may already be quoted, and DdJobStatus has no cancelled value.
    return row;
  }

  const storedId = storedPropellerCoatingJobId(valuesJson, row.linkedJobId);
  let job = await findExistingPropellerCoatingJob(row.dryDockProjectId, storedId);
  const description = buildPropellerCoatingJobDescription(coating);

  if (!job) {
    const created = await createDdJob({
      dryDockProjectId: row.dryDockProjectId,
      title: PROPELLER_COATING_JOB_TITLE,
      category: PROPELLER_COATING_JOB_CATEGORY,
      workshop: "Hull",
      description,
      status: "planned",
      priority: "medium",
    });
    job = { id: created.id, description: created.description };
    await syncDryDockProjectProgress(row.dryDockProjectId);
  } else if (job.description !== description) {
    const updated = await updateDdJob(job.id, { description });
    job = { id: updated.id, description: updated.description };
  }

  const nextValues = { ...valuesJson, siliconePaintJobId: job.id };
  const existingValues = (row.valuesJson as Record<string, unknown> | null) ?? {};
  if (row.linkedJobId === job.id && existingValues.siliconePaintJobId === job.id) {
    return row;
  }

  return prisma.ddInputSubmission.update({
    where: { id: row.id },
    data: {
      linkedJobId: job.id,
      valuesJson: nextValues as Prisma.InputJsonValue,
    },
  });
}

/**
 * Sync included painting areas to scope jobs (DdJob). Runs on draft and submit so
 * Painting & coating and Scope of work stay aligned without duplicating entry.
 */
async function persistSeaValveInputScopeJob(
  row: Prisma.DdInputSubmissionGetPayload<object>,
  valuesJson: Record<string, unknown>,
): Promise<Prisma.DdInputSubmissionGetPayload<object>> {
  const jobId = await persistSeaValveScopeJob(
    row.dryDockProjectId,
    valuesJson,
    row.linkedJobId,
  );
  if (!jobId) return row;

  const existingValues = (row.valuesJson as Record<string, unknown> | null) ?? {};
  const existingJobId = parseSeaValveJobId(existingValues);
  const linkedJobId = row.linkedJobId ?? jobId;
  const nextValues = { ...valuesJson, seaValveJobId: jobId };

  if (existingJobId === jobId && row.linkedJobId === linkedJobId) {
    return row;
  }

  return prisma.ddInputSubmission.update({
    where: { id: row.id },
    data: {
      linkedJobId,
      valuesJson: nextValues as Prisma.InputJsonValue,
    },
  });
}

async function persistPaintingInputScopeJobs(
  row: Prisma.DdInputSubmissionGetPayload<object>,
  valuesJson: Record<string, unknown>,
): Promise<Prisma.DdInputSubmissionGetPayload<object>> {
  const jobIds = await persistPaintingScopeJobs(row.dryDockProjectId, valuesJson);
  const hasJobs = Object.keys(jobIds).length > 0;
  if (!hasJobs) return row;

  const existingValues = (row.valuesJson as Record<string, unknown> | null) ?? {};
  const existingIds = existingValues.paintingJobIds;
  const linkedJobId = jobIds.hull ?? row.linkedJobId ?? Object.values(jobIds)[0] ?? null;
  const nextValues = { ...valuesJson, paintingJobIds: jobIds };

  const idsUnchanged =
    JSON.stringify(existingIds ?? {}) === JSON.stringify(jobIds) &&
    row.linkedJobId === linkedJobId &&
    existingValues.paintingJobIds != null;

  if (idsUnchanged) return row;

  return prisma.ddInputSubmission.update({
    where: { id: row.id },
    data: {
      linkedJobId,
      valuesJson: nextValues as Prisma.InputJsonValue,
    },
  });
}

export async function upsertInputSubmission(input: {
  dryDockProjectId: string;
  sectionKey: string;
  valuesJson: Record<string, unknown>;
  enteredByRole: DdInputResponsibleRole;
  enteredByName?: string | null;
  status?: DdInputSubmissionStatus;
}) {
  const def = getInputSectionDef(input.sectionKey);
  if (!def) throw new Error(`Unknown input section: ${input.sectionKey}`);

  let valuesJson =
    input.sectionKey === "sea_valves"
      ? sanitizeSeaValveValues(input.valuesJson)
      : input.valuesJson;

  if (input.sectionKey === "vessel_defects") {
    const { listProjectDefects, summarizeImportedDefectsForVesselInput } = await import(
      "./projectDefects"
    );
    const defects = await listProjectDefects(input.dryDockProjectId);
    if (defects.length > 0) {
      const summary = summarizeImportedDefectsForVesselInput(defects);
      const existingMachinery =
        typeof valuesJson.machineryStatus === "string" ? valuesJson.machineryStatus.trim() : "";
      valuesJson = {
        ...valuesJson,
        openDefects: summary.openDefects,
        importedDefectCount: summary.importedDefectCount,
        machineryStatus: existingMachinery || summary.machineryStatus,
      };
    }
  }

  const status = input.status ?? "draft";
  if (input.sectionKey === "painting" && (status === "submitted" || status === "reviewed" || status === "approved")) {
    valuesJson = sanitizePaintingValues(valuesJson);
  }
  if (status === "submitted" || status === "reviewed" || status === "approved") {
    const err = validateRequiredFields(input.sectionKey, valuesJson);
    if (err) throw new Error(err);
  }

  const existing = await prisma.ddInputSubmission.findFirst({
    where: {
      dryDockProjectId: input.dryDockProjectId,
      sectionKey: input.sectionKey,
      ...activeSubmissionWhere,
    },
    orderBy: { version: "desc" },
  });

  const now = new Date();
  const enteredAt =
    status !== "draft" && !existing?.enteredAt ? now : existing?.enteredAt ?? null;

  if (existing) {
    let row = await prisma.ddInputSubmission.update({
      where: { id: existing.id },
      data: {
        valuesJson: valuesJson as Prisma.InputJsonValue,
        status,
        enteredByRole: input.enteredByRole,
        enteredByName: input.enteredByName?.trim() || existing.enteredByName,
        enteredAt,
      },
    });
    if (
      input.sectionKey === "propeller" &&
      (status === "submitted" || status === "reviewed" || status === "approved")
    ) {
      row = await persistPropellerCoatingJob(row, valuesJson);
    }
    if (input.sectionKey === "painting") {
      row = await persistPaintingInputScopeJobs(row, valuesJson);
    }
    if (input.sectionKey === "sea_valves") {
      row = await persistSeaValveInputScopeJob(row, valuesJson);
    }
    return mapSubmission(row);
  }

  let row = await prisma.ddInputSubmission.create({
    data: {
      dryDockProjectId: input.dryDockProjectId,
      sectionKey: input.sectionKey,
      pageKey: def.pageKey,
      moduleId: def.moduleId,
      valuesJson: valuesJson as Prisma.InputJsonValue,
      status,
      enteredByRole: input.enteredByRole,
      enteredByName: input.enteredByName?.trim() || null,
      enteredAt: status !== "draft" ? now : null,
      mandatory: def.mandatory ?? false,
      attachmentRequired: def.attachmentRequired ?? false,
    },
  });
  if (
    input.sectionKey === "propeller" &&
    (status === "submitted" || status === "reviewed" || status === "approved")
  ) {
    row = await persistPropellerCoatingJob(row, valuesJson);
  }
  if (input.sectionKey === "painting") {
    row = await persistPaintingInputScopeJobs(row, valuesJson);
  }
  if (input.sectionKey === "sea_valves") {
    row = await persistSeaValveInputScopeJob(row, valuesJson);
  }
  return mapSubmission(row);
}

export async function reviewInputSubmission(
  id: string,
  input: {
    action: "approve" | "reject" | "review";
    reviewerName?: string | null;
    reviewNotes?: string | null;
  },
) {
  const existing = await prisma.ddInputSubmission.findFirst({
    where: { id, ...notDeleted, inactiveAt: null },
  });
  if (!existing) return null;

  const now = new Date();
  const reviewerName = input.reviewerName?.trim() || null;

  let status: DdInputSubmissionStatus = existing.status;
  if (input.action === "review") status = "reviewed";
  if (input.action === "approve") status = "approved";
  if (input.action === "reject") status = "rejected";

  const row = await prisma.ddInputSubmission.update({
    where: { id },
    data: {
      status,
      reviewedByName: reviewerName,
      reviewedAt: now,
      reviewNotes: input.reviewNotes?.trim() || null,
      ...(input.action === "approve"
        ? { approvedByName: reviewerName, approvedAt: now }
        : {}),
    },
  });
  return mapSubmission(row);
}

export async function deactivateInputSubmission(id: string) {
  const row = await prisma.ddInputSubmission.update({
    where: { id },
    data: { status: "inactive", inactiveAt: new Date() },
  });
  return mapSubmission(row);
}

export async function softDeleteInputSubmission(id: string) {
  await prisma.ddInputSubmission.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

export type InputReadinessReport = {
  projectType: DryDockProjectType;
  pageKey: InputPageKey;
  totalSections: number;
  mandatorySections: number;
  completedSections: number;
  mandatoryCompleted: number;
  pendingReview: number;
  approved: number;
  completionPct: number;
  sections: {
    sectionKey: string;
    label: string;
    mandatory: boolean;
    status: DdInputSubmissionStatus | "missing";
    submissionId: string | null;
  }[];
};

async function countImportedProjectDefects(dryDockProjectId: string): Promise<number> {
  const countFn = prisma.ddProjectDefect?.count?.bind(prisma.ddProjectDefect);
  if (typeof countFn !== "function") return 0;
  try {
    return await countFn({ where: { dryDockProjectId, ...notDeleted } });
  } catch (error) {
    console.error("[inputs] Failed to count imported project defects", error);
    return 0;
  }
}

function overlayVesselDefectsStatus(
  status: DdInputSubmissionStatus | "missing",
  importedDefectCount: number,
): DdInputSubmissionStatus | "missing" {
  if (
    importedDefectCount > 0 &&
    (status === "missing" || status === "draft" || status === "rejected")
  ) {
    return "submitted";
  }
  return status;
}

export async function buildInputReadiness(
  dryDockProjectId: string,
  projectType: DryDockProjectType,
  pageKey: InputPageKey = "vessel",
): Promise<InputReadinessReport> {
  const catalog = getSectionsForProjectType(projectType, pageKey);
  const mandatory = getMandatorySectionsForProjectType(projectType, pageKey);
  const submissions = await listActiveInputSubmissions(dryDockProjectId, pageKey);
  const byKey = new Map(submissions.map((s) => [s.sectionKey, s]));
  const importedDefectCount = catalog.some((def) => def.key === "vessel_defects")
    ? await countImportedProjectDefects(dryDockProjectId)
    : 0;

  const sections = catalog.map((def) => {
    const sub = byKey.get(def.key);
    const rawStatus = sub?.status ?? ("missing" as const);
    const status =
      def.key === "vessel_defects"
        ? overlayVesselDefectsStatus(rawStatus, importedDefectCount)
        : rawStatus;
    return {
      sectionKey: def.key,
      label: def.label,
      mandatory: def.mandatory ?? false,
      status,
      submissionId: sub?.id ?? null,
    };
  });

  const isComplete = (status: DdInputSubmissionStatus | "missing") =>
    status === "submitted" || status === "reviewed" || status === "approved";

  const completedSections = sections.filter((s) => isComplete(s.status)).length;
  const mandatoryCompleted = sections.filter((s) => s.mandatory && isComplete(s.status)).length;
  const pendingReview = sections.filter((s) => s.status === "submitted").length;
  const approved = sections.filter((s) => s.status === "approved").length;

  return {
    projectType,
    pageKey,
    totalSections: catalog.length,
    mandatorySections: mandatory.length,
    completedSections,
    mandatoryCompleted,
    pendingReview,
    approved,
    completionPct: catalog.length
      ? Math.round((completedSections / catalog.length) * 100)
      : 100,
    sections,
  };
}

export type CombinedInputReadinessReport = {
  projectType: DryDockProjectType;
  overall: {
    totalSections: number;
    mandatorySections: number;
    completedSections: number;
    mandatoryCompleted: number;
    pendingReview: number;
    approved: number;
    completionPct: number;
  };
  byPage: Partial<Record<InputPageKey, InputReadinessReport>>;
};

export async function buildCombinedInputReadiness(
  dryDockProjectId: string,
  projectType: DryDockProjectType,
): Promise<CombinedInputReadinessReport> {
  const reports = await Promise.all(
    INPUT_READINESS_PAGE_KEYS.map(async (pageKey) => ({
      pageKey,
      report: await buildInputReadiness(dryDockProjectId, projectType, pageKey),
    })),
  );

  const byPage: Partial<Record<InputPageKey, InputReadinessReport>> = {};
  let totalSections = 0;
  let mandatorySections = 0;
  let completedSections = 0;
  let mandatoryCompleted = 0;
  let pendingReview = 0;
  let approved = 0;

  for (const { pageKey, report } of reports) {
    if (report.totalSections === 0) continue;
    byPage[pageKey] = report;
    totalSections += report.totalSections;
    mandatorySections += report.mandatorySections;
    completedSections += report.completedSections;
    mandatoryCompleted += report.mandatoryCompleted;
    pendingReview += report.pendingReview;
    approved += report.approved;
  }

  return {
    projectType,
    overall: {
      totalSections,
      mandatorySections,
      completedSections,
      mandatoryCompleted,
      pendingReview,
      approved,
      completionPct: totalSections
        ? Math.round((completedSections / totalSections) * 100)
        : 100,
    },
    byPage,
  };
}
