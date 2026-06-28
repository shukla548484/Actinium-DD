import { Prisma } from "@prisma/client";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import {
  mapProject,
  mapQuoteLine,
  mapQuoteMeta,
  mapSpecLine,
  mapYardInvite,
  toPrismaMatchMethod,
  toPrismaPricingStatus,
  toPrismaProjectStatus,
  toPrismaQuoteSource,
  toPrismaScopeLocale,
  toPrismaYardInviteStatus,
} from "@/lib/db/mappers";
import type { ScopeLocale } from "@/lib/i18n/scope";
import {
  ensureProjectCategories,
  listProjectCategories,
  seedStandardCategories,
} from "@/lib/db/categories";
import { buildDefaultSpecLines } from "@/lib/tender/defaultSpec";
import { buildProjectSpecFromMaster } from "@/lib/db/masterCatalog";
import type {
  MatchMethod,
  PricingStatus,
  Project,
  ProjectDetail,
  QuoteLine,
  QuoteMeta,
  QuoteSource,
  SpecLine,
  YardInvite,
  YardInviteStatus,
  YardQuoteDetail,
} from "@/lib/tender/types";
import type { SyncOriginNode } from "@/lib/sync/constants";

const notDeleted = { deletedAt: null };

export async function listProjects(): Promise<Project[]> {
  const rows = await prisma.project.findMany({
    where: notDeleted,
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(mapProject);
}

export async function getProject(id: string): Promise<Project | null> {
  const row = await prisma.project.findFirst({ where: { id, ...notDeleted } });
  return row ? mapProject(row) : null;
}

export async function getProjectDetail(id: string): Promise<ProjectDetail | null> {
  const row = await prisma.project.findFirst({
    where: { id, ...notDeleted },
    include: {
      specLines: { orderBy: { sortOrder: "asc" } },
      yardInvites: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!row) return null;
  const categories = await ensureProjectCategories(id);
  return {
    ...mapProject(row),
    specLines: row.specLines.map(mapSpecLine),
    yardInvites: row.yardInvites.map(mapYardInvite),
    categories,
  };
}

export async function createProject(input: {
  name: string;
  vesselName?: string;
  vesselId?: string;
  referenceCode?: string;
  currency?: string;
  shipyardDays?: number;
  dryDockDays?: number;
  cprDays?: number;
  notes?: string;
  scopeLocales?: ScopeLocale[];
}): Promise<ProjectDetail> {
  const fromMaster = await buildProjectSpecFromMaster("pending");
  const specTemplate = fromMaster ?? buildDefaultSpecLines("pending");

  const project = await prisma.project.create({
    data: {
      name: input.name,
      vesselName: input.vesselName ?? null,
      vesselId: input.vesselId ?? null,
      referenceCode: input.referenceCode ?? null,
      currency: input.currency ?? "USD",
      shipyardDays: input.shipyardDays ?? null,
      dryDockDays: input.dryDockDays ?? null,
      cprDays: input.cprDays ?? null,
      notes: input.notes ?? null,
      originNode: "office",
      officeChangedAt: new Date(),
      scopeLocales: (input.scopeLocales ?? ["en", "zh", "ja"]).map(toPrismaScopeLocale),
      specLines: {
        create: specTemplate.map((line) => ({
          bucket: line.bucket,
          sortOrder: line.sortOrder,
          lineCode: line.lineCode,
          descriptionEn: line.descriptions.en,
          descriptionZh: line.descriptions.zh,
          descriptionJa: line.descriptions.ja,
          unit: line.unit,
          defaultQty: line.defaultQty,
          scopeDays: line.scopeDays ?? null,
          scopeAreaM2: line.scopeAreaM2 ?? null,
          scopeNotes: line.scopeNotes ?? null,
          ownerLocked: line.ownerLocked ?? true,
          allowDiscount: line.allowDiscount ?? true,
          maxDiscountPct: line.maxDiscountPct ?? null,
          referenceUnitRate: line.referenceUnitRate ?? null,
          calcRule: line.calcRule,
          calcParams: line.calcParams as Prisma.InputJsonValue,
          serviceDefId: line.serviceDefId,
          isOptional: line.isOptional,
          originNode: "office",
          officeChangedAt: new Date(),
        })),
      },
    },
    include: {
      specLines: { orderBy: { sortOrder: "asc" } },
      yardInvites: true,
    },
  });

  await seedStandardCategories(project.id);
  const categories = await listProjectCategories(project.id);

  return {
    ...mapProject(project),
    specLines: project.specLines.map(mapSpecLine),
    yardInvites: project.yardInvites.map(mapYardInvite),
    categories,
  };
}

export async function updateProject(
  id: string,
  patch: Partial<
    Pick<
      Project,
      | "name"
      | "vesselName"
      | "referenceCode"
      | "currency"
      | "shipyardDays"
      | "dryDockDays"
      | "cprDays"
      | "status"
      | "notes"
      | "scopeLocales"
      | "vesselId"
    >
  >,
): Promise<Project | null> {
  const existing = await getProject(id);
  if (!existing) return null;

  const row = await prisma.project.update({
    where: { id },
    data: {
      name: patch.name,
      vesselName: patch.vesselName,
      vesselId: patch.vesselId,
      referenceCode: patch.referenceCode,
      currency: patch.currency,
      shipyardDays: patch.shipyardDays,
      dryDockDays: patch.dryDockDays,
      cprDays: patch.cprDays,
      status: patch.status ? toPrismaProjectStatus(patch.status) : undefined,
      notes: patch.notes,
      scopeLocales: patch.scopeLocales?.map(toPrismaScopeLocale),
      originNode: "office",
      officeChangedAt: new Date(),
    },
  });

  return mapProject(row);
}

export async function listSpecLines(projectId: string): Promise<SpecLine[]> {
  const rows = await prisma.specLine.findMany({
    where: { projectId, ...notDeleted },
    orderBy: { sortOrder: "asc" },
  });
  return rows.map(mapSpecLine);
}

export async function updateSpecLine(
  id: string,
  patch: Partial<
    Pick<
      SpecLine,
      | "description"
      | "descriptions"
      | "unit"
      | "defaultQty"
      | "scopeDays"
      | "scopeAreaM2"
      | "scopeNotes"
      | "ownerLocked"
      | "allowDiscount"
      | "maxDiscountPct"
      | "referenceUnitRate"
      | "isOptional"
      | "sortOrder"
      | "bucket"
    >
  >,
): Promise<SpecLine | null> {
  const existing = await prisma.specLine.findUnique({ where: { id } });
  if (!existing) return null;

  const descriptions = patch.descriptions;
  const row = await prisma.specLine.update({
    where: { id },
    data: {
      descriptionEn: descriptions?.en ?? patch.description ?? existing.descriptionEn,
      descriptionZh: descriptions?.zh !== undefined ? descriptions.zh : undefined,
      descriptionJa: descriptions?.ja !== undefined ? descriptions.ja : undefined,
      unit: patch.unit,
      defaultQty: patch.defaultQty,
      scopeDays: patch.scopeDays,
      scopeAreaM2: patch.scopeAreaM2,
      scopeNotes: patch.scopeNotes,
      ownerLocked: patch.ownerLocked,
      allowDiscount: patch.allowDiscount,
      maxDiscountPct: patch.maxDiscountPct,
      referenceUnitRate: patch.referenceUnitRate,
      isOptional: patch.isOptional,
      sortOrder: patch.sortOrder,
      bucket: patch.bucket,
      originNode: "office",
      officeChangedAt: new Date(),
    },
  });

  return mapSpecLine(row);
}

export async function createSpecLine(input: {
  projectId: string;
  bucket: string;
  lineCode?: string;
  description: string;
  descriptionZh?: string | null;
  descriptionJa?: string | null;
  unit?: string | null;
  defaultQty?: number | null;
  calcRule?: string;
  scopeDays?: number | null;
  scopeAreaM2?: number | null;
  scopeNotes?: string | null;
  referenceUnitRate?: number | null;
  maxDiscountPct?: number | null;
  allowDiscount?: boolean;
  isOptional?: boolean;
}): Promise<SpecLine> {
  const maxSort = await prisma.specLine.aggregate({
    where: { projectId: input.projectId },
    _max: { sortOrder: true },
  });
  const sortOrder = (maxSort._max.sortOrder ?? 0) + 10;

  const row = await prisma.specLine.create({
    data: {
      projectId: input.projectId,
      bucket: input.bucket,
      sortOrder,
      lineCode: input.lineCode ?? null,
      descriptionEn: input.description,
      descriptionZh: input.descriptionZh ?? null,
      descriptionJa: input.descriptionJa ?? null,
      unit: input.unit ?? null,
      defaultQty: input.defaultQty ?? null,
      calcRule: input.calcRule ?? "lump_sum",
      scopeDays: input.scopeDays ?? null,
      scopeAreaM2: input.scopeAreaM2 ?? null,
      scopeNotes: input.scopeNotes ?? null,
      referenceUnitRate: input.referenceUnitRate ?? null,
      maxDiscountPct: input.maxDiscountPct ?? null,
      allowDiscount: input.allowDiscount ?? true,
      ownerLocked: true,
      isOptional: input.isOptional ?? false,
      originNode: "office",
      officeChangedAt: new Date(),
    },
  });
  return mapSpecLine(row);
}

export async function deleteSpecLine(id: string): Promise<boolean> {
  const existing = await prisma.specLine.findFirst({ where: { id, ...notDeleted } });
  if (!existing) return false;
  const now = new Date();
  await prisma.$transaction([
    prisma.specLine.update({
      where: { id },
      data: { deletedAt: now, officeChangedAt: now },
    }),
    prisma.syncTombstone.create({
      data: {
        id: nanoid(),
        tableName: "spec_lines",
        recordId: id,
        originNode: "office",
        reason: "soft_delete",
      },
    }),
  ]);
  return true;
}

export async function listYardInvites(projectId: string): Promise<YardInvite[]> {
  const rows = await prisma.yardInvite.findMany({
    where: { projectId, ...notDeleted },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(mapYardInvite);
}

export type YardInviteFleetRow = YardInvite & {
  projectName: string;
  vesselName: string | null;
};

export async function listAllYardInvites(): Promise<YardInviteFleetRow[]> {
  const rows = await prisma.yardInvite.findMany({
    where: notDeleted,
    orderBy: { updatedAt: "desc" },
    include: {
      project: {
        select: { id: true, name: true, vesselName: true, deletedAt: true },
      },
    },
  });

  return rows
    .filter((row) => row.project && !row.project.deletedAt)
    .map((row) => ({
      ...mapYardInvite(row),
      projectName: row.project.name,
      vesselName: row.project.vesselName,
    }));
}

export async function createYardInvite(input: {
  projectId: string;
  yardName: string;
  contactEmail?: string;
  preferredLocale?: ScopeLocale;
}): Promise<YardInvite> {
  const row = await prisma.yardInvite.create({
    data: {
      projectId: input.projectId,
      yardName: input.yardName,
      contactEmail: input.contactEmail ?? null,
      token: nanoid(32),
      preferredLocale: toPrismaScopeLocale(input.preferredLocale ?? "en"),
      originNode: "office",
      officeChangedAt: new Date(),
    },
  });
  return mapYardInvite(row);
}

export async function getInviteByToken(token: string): Promise<YardInvite | null> {
  const row = await prisma.yardInvite.findUnique({ where: { token } });
  return row ? mapYardInvite(row) : null;
}

export async function getYardQuoteByToken(token: string): Promise<YardQuoteDetail | null> {
  const invite = await getInviteByToken(token);
  if (!invite) return null;
  const project = await getProject(invite.projectId);
  if (!project) return null;
  return {
    invite,
    project,
    specLines: await listSpecLines(invite.projectId),
    categories: await ensureProjectCategories(invite.projectId),
    meta: await getQuoteMeta(invite.id),
    lines: await listQuoteLines(invite.id),
  };
}

export async function getQuoteMeta(inviteId: string): Promise<QuoteMeta | null> {
  const row = await prisma.quoteMeta.findUnique({ where: { inviteId } });
  return row ? mapQuoteMeta(row) : null;
}

export async function listQuoteLines(inviteId: string): Promise<QuoteLine[]> {
  const rows = await prisma.quoteLine.findMany({
    where: { inviteId, ...notDeleted },
    orderBy: [{ sortOrder: "asc" }, { description: "asc" }],
  });
  return rows.map(mapQuoteLine);
}

export async function upsertQuoteMeta(
  meta: QuoteMeta,
  originNode: SyncOriginNode = "yard",
): Promise<QuoteMeta> {
  const now = new Date();
  const row = await prisma.quoteMeta.upsert({
    where: { inviteId: meta.inviteId },
    create: {
      inviteId: meta.inviteId,
      currency: meta.currency,
      shipyardDays: meta.shipyardDays,
      dryDockDays: meta.dryDockDays,
      cprDays: meta.cprDays,
      exchangeRate: meta.exchangeRate,
      validityDays: meta.validityDays,
      generalNotes: meta.generalNotes,
      excelFileName: meta.excelFileName,
      globalDiscountPct: meta.globalDiscountPct,
      taxPct: meta.taxPct,
      quoteGrossTotal: meta.quoteGrossTotal,
      quoteNetTotal: meta.quoteNetTotal,
      originNode,
      officeChangedAt: now,
    },
    update: {
      currency: meta.currency,
      shipyardDays: meta.shipyardDays,
      dryDockDays: meta.dryDockDays,
      cprDays: meta.cprDays,
      exchangeRate: meta.exchangeRate,
      validityDays: meta.validityDays,
      generalNotes: meta.generalNotes,
      excelFileName: meta.excelFileName,
      globalDiscountPct: meta.globalDiscountPct,
      taxPct: meta.taxPct,
      quoteGrossTotal: meta.quoteGrossTotal,
      quoteNetTotal: meta.quoteNetTotal,
      originNode,
      officeChangedAt: now,
    },
  });
  return mapQuoteMeta(row);
}

export async function replaceQuoteLines(
  inviteId: string,
  lines: QuoteLine[],
  originNode: SyncOriginNode = "yard",
): Promise<QuoteLine[]> {
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const existing = await tx.quoteLine.findMany({ where: { inviteId, ...notDeleted } });
    for (const old of existing) {
      await tx.quoteLine.update({
        where: { id: old.id },
        data: { deletedAt: now, officeChangedAt: now },
      });
    }
    if (lines.length === 0) return;
    await tx.quoteLine.createMany({
      data: lines.map((line) => ({
        id: line.id,
        inviteId,
        specLineId: line.specLineId,
        isExtra: line.isExtra,
        description: line.description,
        unit: line.unit,
        unitRate: line.unitRate,
        quantity: line.quantity,
        quotedTotal: line.quotedTotal,
        calculatedTotal: line.calculatedTotal,
        discountPct: line.discountPct ?? 0,
        grossTotal: line.grossTotal,
        netTotal: line.netTotal,
        pricingStatus: toPrismaPricingStatus(line.pricingStatus),
        remarks: line.remarks,
        matchConfidence: line.matchConfidence,
        matchMethod: toPrismaMatchMethod(line.matchMethod),
        sortOrder: line.sortOrder,
        originNode,
        officeChangedAt: now,
      })),
    });
  });
  return listQuoteLines(inviteId);
}

export async function updateInviteStatus(
  inviteId: string,
  status: YardInviteStatus,
  sourceType?: QuoteSource,
  originNode: SyncOriginNode = "yard",
): Promise<void> {
  const submittedAt =
    status === "submitted" || status === "excel_imported" ? new Date() : null;

  await prisma.yardInvite.update({
    where: { id: inviteId },
    data: {
      status: toPrismaYardInviteStatus(status),
      submittedAt,
      sourceType: sourceType ? toPrismaQuoteSource(sourceType) : undefined,
      originNode,
      officeChangedAt: new Date(),
    },
  });
}

export async function getInvite(id: string): Promise<YardInvite | null> {
  const row = await prisma.yardInvite.findUnique({ where: { id } });
  return row ? mapYardInvite(row) : null;
}

export async function deleteProject(id: string): Promise<boolean> {
  const project = await getProject(id);
  if (!project) return false;
  const now = new Date();
  await prisma.$transaction([
    prisma.project.update({
      where: { id },
      data: { deletedAt: now, officeChangedAt: now },
    }),
    prisma.syncTombstone.create({
      data: {
        id: nanoid(),
        tableName: "projects",
        recordId: id,
        vesselId: project.vesselId,
        originNode: "office",
        reason: "soft_delete",
      },
    }),
  ]);
  return true;
}

export async function deleteYardInvite(id: string): Promise<boolean> {
  const row = await prisma.yardInvite.findFirst({ where: { id, ...notDeleted } });
  if (!row) return false;
  const now = new Date();
  await prisma.$transaction([
    prisma.yardInvite.update({
      where: { id },
      data: { deletedAt: now, officeChangedAt: now },
    }),
    prisma.syncTombstone.create({
      data: {
        id: nanoid(),
        tableName: "yard_invites",
        recordId: id,
        originNode: "office",
        reason: "soft_delete",
      },
    }),
  ]);
  return true;
}

export type { PricingStatus, MatchMethod };
