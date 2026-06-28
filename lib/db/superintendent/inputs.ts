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
    const val = valuesJson[field.key];
    if (val === undefined || val === null || val === "") {
      return `${field.label} is required`;
    }
  }
  return null;
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

  const status = input.status ?? "draft";
  if (status === "submitted" || status === "reviewed" || status === "approved") {
    const err = validateRequiredFields(input.sectionKey, input.valuesJson);
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
    const row = await prisma.ddInputSubmission.update({
      where: { id: existing.id },
      data: {
        valuesJson: input.valuesJson as Prisma.InputJsonValue,
        status,
        enteredByRole: input.enteredByRole,
        enteredByName: input.enteredByName?.trim() || existing.enteredByName,
        enteredAt,
      },
    });
    return mapSubmission(row);
  }

  const row = await prisma.ddInputSubmission.create({
    data: {
      dryDockProjectId: input.dryDockProjectId,
      sectionKey: input.sectionKey,
      pageKey: def.pageKey,
      moduleId: def.moduleId,
      valuesJson: input.valuesJson as Prisma.InputJsonValue,
      status,
      enteredByRole: input.enteredByRole,
      enteredByName: input.enteredByName?.trim() || null,
      enteredAt: status !== "draft" ? now : null,
      mandatory: def.mandatory ?? false,
      attachmentRequired: def.attachmentRequired ?? false,
    },
  });
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

export async function buildInputReadiness(
  dryDockProjectId: string,
  projectType: DryDockProjectType,
  pageKey: InputPageKey = "vessel",
): Promise<InputReadinessReport> {
  const catalog = getSectionsForProjectType(projectType, pageKey);
  const mandatory = getMandatorySectionsForProjectType(projectType, pageKey);
  const submissions = await listActiveInputSubmissions(dryDockProjectId, pageKey);
  const byKey = new Map(submissions.map((s) => [s.sectionKey, s]));

  const sections = catalog.map((def) => {
    const sub = byKey.get(def.key);
    return {
      sectionKey: def.key,
      label: def.label,
      mandatory: def.mandatory ?? false,
      status: sub?.status ?? ("missing" as const),
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
