import type {
  MatchMethod,
  PricingStatus,
  ProjectStatus,
  QuoteSource,
  YardInviteStatus,
  CalcParams,
  CalcRule,
} from "@/lib/tender/types";
import { normalizeCategorySlug } from "@/lib/tender/categories";
import type { ScopeLocale } from "@/lib/i18n/scope";
import type {
  MatchMethod as PrismaMatchMethod,
  PricingStatus as PrismaPricingStatus,
  ProjectStatus as PrismaProjectStatus,
  QuoteSource as PrismaQuoteSource,
  ScopeLocale as PrismaScopeLocale,
  SyncOriginNode as PrismaSyncOriginNode,
  YardInviteStatus as PrismaYardInviteStatus,
  CompareSnapshot as PrismaCompareSnapshot,
  MasterSpecLine as PrismaMasterSpecLine,
  Project,
  ProjectCategory as PrismaProjectCategory,
  SpecLine as PrismaSpecLine,
  YardInvite as PrismaYardInvite,
  QuoteLine as PrismaQuoteLine,
  QuoteMeta as PrismaQuoteMeta,
} from "@prisma/client";
import type { SyncOriginNode } from "@/lib/sync/constants";
import type { CompareAppSnapshot } from "@/lib/desktop/snapshot";

export function mapProject(row: Project) {
  return {
    id: row.id,
    name: row.name,
    vesselName: row.vesselName,
    vesselId: row.vesselId,
    referenceCode: row.referenceCode,
    currency: row.currency,
    shipyardDays: row.shipyardDays,
    dryDockDays: row.dryDockDays,
    cprDays: row.cprDays,
    status: row.status as ProjectStatus,
    notes: row.notes,
    scopeLocales: row.scopeLocales as ScopeLocale[],
    originNode: row.originNode as SyncOriginNode,
    officeChangedAt: row.officeChangedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapSpecLine(row: PrismaSpecLine) {
  return {
    id: row.id,
    projectId: row.projectId,
    bucket: normalizeCategorySlug(row.bucket),
    sortOrder: row.sortOrder,
    lineCode: row.lineCode,
    description: row.descriptionEn,
    descriptions: {
      en: row.descriptionEn,
      zh: row.descriptionZh,
      ja: row.descriptionJa,
    },
    unit: row.unit,
    defaultQty: row.defaultQty,
    scopeDays: row.scopeDays,
    scopeAreaM2: row.scopeAreaM2,
    scopeNotes: row.scopeNotes,
    ownerLocked: row.ownerLocked,
    allowDiscount: row.allowDiscount,
    maxDiscountPct: row.maxDiscountPct,
    referenceUnitRate: row.referenceUnitRate,
    calcRule: row.calcRule as CalcRule,
    calcParams: (row.calcParams ?? {}) as CalcParams,
    serviceDefId: row.serviceDefId,
    isOptional: row.isOptional,
  };
}

export function mapMasterSpecLine(row: PrismaMasterSpecLine) {
  return {
    id: row.id,
    bucket: normalizeCategorySlug(row.bucket),
    sortOrder: row.sortOrder,
    lineCode: row.lineCode,
    description: row.descriptionEn,
    descriptions: {
      en: row.descriptionEn,
      zh: row.descriptionZh,
      ja: row.descriptionJa,
    },
    unit: row.unit,
    defaultQty: row.defaultQty,
    scopeDays: row.scopeDays,
    scopeAreaM2: row.scopeAreaM2,
    scopeNotes: row.scopeNotes,
    allowDiscount: row.allowDiscount,
    maxDiscountPct: row.maxDiscountPct,
    referenceUnitRate: row.referenceUnitRate,
    calcRule: row.calcRule as CalcRule,
    calcParams: (row.calcParams ?? {}) as CalcParams,
    serviceDefId: row.serviceDefId,
    isOptional: row.isOptional,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function mapYardInvite(row: PrismaYardInvite) {
  return {
    id: row.id,
    projectId: row.projectId,
    yardName: row.yardName,
    contactEmail: row.contactEmail,
    token: row.token,
    sourceType: row.sourceType as QuoteSource,
    status: row.status as YardInviteStatus,
    preferredLocale: row.preferredLocale as ScopeLocale,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export function mapQuoteMeta(row: PrismaQuoteMeta) {
  return {
    inviteId: row.inviteId,
    currency: row.currency,
    shipyardDays: row.shipyardDays,
    dryDockDays: row.dryDockDays,
    cprDays: row.cprDays,
    exchangeRate: row.exchangeRate,
    validityDays: row.validityDays,
    generalNotes: row.generalNotes,
    excelFileName: row.excelFileName,
    globalDiscountPct: row.globalDiscountPct,
    taxPct: row.taxPct,
    quoteGrossTotal: row.quoteGrossTotal,
    quoteNetTotal: row.quoteNetTotal,
  };
}

export function mapQuoteLine(row: PrismaQuoteLine) {
  return {
    id: row.id,
    inviteId: row.inviteId,
    specLineId: row.specLineId,
    isExtra: row.isExtra,
    description: row.description,
    unit: row.unit,
    unitRate: row.unitRate,
    quantity: row.quantity,
    quotedTotal: row.quotedTotal,
    calculatedTotal: row.calculatedTotal,
    discountPct: row.discountPct,
    grossTotal: row.grossTotal,
    netTotal: row.netTotal,
    pricingStatus: row.pricingStatus as PricingStatus,
    remarks: row.remarks,
    matchConfidence: row.matchConfidence,
    matchMethod: row.matchMethod as MatchMethod,
    sortOrder: row.sortOrder,
  };
}

export function mapCompareSnapshot(row: PrismaCompareSnapshot) {
  return {
    id: row.id,
    projectId: row.projectId,
    inviteId: row.inviteId,
    vendorName: row.vendorName,
    fileName: row.fileName,
    snapshot: row.snapshot as unknown as CompareAppSnapshot,
    originNode: row.originNode as SyncOriginNode,
    officeChangedAt: row.officeChangedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toPrismaSyncOriginNode(node: SyncOriginNode): PrismaSyncOriginNode {
  return node as PrismaSyncOriginNode;
}

export function mapProjectCategory(row: PrismaProjectCategory) {
  return {
    id: row.id,
    projectId: row.projectId,
    categoryNo: row.categoryNo,
    slug: row.slug,
    name: row.name,
    shortcut: row.shortcut,
    sortOrder: row.sortOrder,
    isSystem: row.isSystem,
  };
}

export function toPrismaProjectStatus(status: ProjectStatus): PrismaProjectStatus {
  return status as PrismaProjectStatus;
}

export function toPrismaYardInviteStatus(status: YardInviteStatus): PrismaYardInviteStatus {
  return status as PrismaYardInviteStatus;
}

export function toPrismaQuoteSource(source: QuoteSource): PrismaQuoteSource {
  return source as PrismaQuoteSource;
}

export function toPrismaPricingStatus(status: PricingStatus): PrismaPricingStatus {
  return status as PrismaPricingStatus;
}

export function toPrismaMatchMethod(method: MatchMethod): PrismaMatchMethod {
  return method as PrismaMatchMethod;
}

export function toPrismaScopeLocale(locale: ScopeLocale): PrismaScopeLocale {
  return locale as PrismaScopeLocale;
}
