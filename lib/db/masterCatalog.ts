import { Prisma } from "@prisma/client";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { mapMasterSpecLine } from "@/lib/db/mappers";
import { buildDefaultSpecLines } from "@/lib/tender/defaultSpec";
import type { ParsedSpecImportRow } from "@/lib/tender/specExcel";
import type { MasterSpecLine, SpecLine } from "@/lib/tender/types";

export async function listMasterSpecLines(options?: {
  bucket?: string;
  activeOnly?: boolean;
}): Promise<MasterSpecLine[]> {
  const rows = await prisma.masterSpecLine.findMany({
    where: {
      ...(options?.bucket ? { bucket: options.bucket } : {}),
      ...(options?.activeOnly !== false ? { isActive: true } : {}),
    },
    orderBy: [{ bucket: "asc" }, { sortOrder: "asc" }],
  });
  return rows.map(mapMasterSpecLine);
}

export async function countMasterSpecLines(): Promise<number> {
  return prisma.masterSpecLine.count();
}

export async function ensureMasterCatalogSeeded(): Promise<number> {
  const count = await countMasterSpecLines();
  if (count > 0) return count;
  return seedMasterCatalogFromDefaults();
}

export async function seedMasterCatalogFromDefaults(): Promise<number> {
  const template = buildDefaultSpecLines("master");
  const now = new Date();

  await prisma.masterSpecLine.createMany({
    data: template.map((line) => ({
      id: nanoid(),
      bucket: line.bucket,
      sortOrder: line.sortOrder,
      lineCode: line.lineCode,
      descriptionEn: line.descriptions.en,
      descriptionZh: line.descriptions.zh,
      descriptionJa: line.descriptions.ja,
      unit: line.unit,
      defaultQty: line.defaultQty,
      scopeDays: line.scopeDays,
      scopeAreaM2: line.scopeAreaM2,
      scopeNotes: line.scopeNotes,
      allowDiscount: line.allowDiscount,
      maxDiscountPct: line.maxDiscountPct,
      referenceUnitRate: line.referenceUnitRate,
      calcRule: line.calcRule,
      calcParams: line.calcParams as Prisma.InputJsonValue,
      serviceDefId: line.serviceDefId,
      isOptional: line.isOptional,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })),
    skipDuplicates: true,
  });

  return countMasterSpecLines();
}

export async function getMasterSpecLine(id: string): Promise<MasterSpecLine | null> {
  const row = await prisma.masterSpecLine.findUnique({ where: { id } });
  return row ? mapMasterSpecLine(row) : null;
}

export async function createMasterSpecLine(input: {
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
  serviceDefId?: string | null;
  calcParams?: Prisma.InputJsonValue;
}): Promise<MasterSpecLine> {
  const maxSort = await prisma.masterSpecLine.aggregate({
    where: { bucket: input.bucket },
    _max: { sortOrder: true },
  });
  const sortOrder = (maxSort._max.sortOrder ?? 0) + 10;

  const row = await prisma.masterSpecLine.create({
    data: {
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
      isOptional: input.isOptional ?? false,
      serviceDefId: input.serviceDefId ?? null,
      calcParams: input.calcParams ?? {},
      isActive: true,
    },
  });
  return mapMasterSpecLine(row);
}

export async function updateMasterSpecLine(
  id: string,
  patch: Partial<{
    bucket: string;
    lineCode: string | null;
    description: string;
    descriptions: { en: string; zh: string | null; ja: string | null };
    unit: string | null;
    defaultQty: number | null;
    scopeDays: number | null;
    scopeAreaM2: number | null;
    scopeNotes: string | null;
    referenceUnitRate: number | null;
    maxDiscountPct: number | null;
    allowDiscount: boolean;
    isOptional: boolean;
    calcRule: string;
    isActive: boolean;
    sortOrder: number;
  }>,
): Promise<MasterSpecLine | null> {
  const existing = await prisma.masterSpecLine.findUnique({ where: { id } });
  if (!existing) return null;

  const descriptions = patch.descriptions;
  const row = await prisma.masterSpecLine.update({
    where: { id },
    data: {
      bucket: patch.bucket,
      lineCode: patch.lineCode,
      descriptionEn: descriptions?.en ?? patch.description ?? undefined,
      descriptionZh: descriptions?.zh !== undefined ? descriptions.zh : undefined,
      descriptionJa: descriptions?.ja !== undefined ? descriptions.ja : undefined,
      unit: patch.unit,
      defaultQty: patch.defaultQty,
      scopeDays: patch.scopeDays,
      scopeAreaM2: patch.scopeAreaM2,
      scopeNotes: patch.scopeNotes,
      referenceUnitRate: patch.referenceUnitRate,
      maxDiscountPct: patch.maxDiscountPct,
      allowDiscount: patch.allowDiscount,
      isOptional: patch.isOptional,
      calcRule: patch.calcRule,
      isActive: patch.isActive,
      sortOrder: patch.sortOrder,
    },
  });
  return mapMasterSpecLine(row);
}

export async function deleteMasterSpecLine(id: string): Promise<boolean> {
  try {
    await prisma.masterSpecLine.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

export async function importMasterSpecRows(
  rows: ParsedSpecImportRow[],
): Promise<{ imported: number; skipped: number; importedLines: string[]; skippedLines: string[] }> {
  const existing = await prisma.masterSpecLine.findMany({ select: { lineCode: true } });
  const existingCodes = new Set(existing.map((l) => l.lineCode?.toLowerCase()).filter(Boolean));

  const imported: string[] = [];
  const skipped: string[] = [];

  for (const row of rows) {
    if (row.lineCode && existingCodes.has(row.lineCode.toLowerCase())) {
      skipped.push(row.lineCode);
      continue;
    }

    await createMasterSpecLine({
      bucket: row.bucket,
      lineCode: row.lineCode,
      description: row.description,
      descriptionZh: row.descriptionZh,
      descriptionJa: row.descriptionJa,
      unit: row.unit,
      defaultQty: row.defaultQty,
      calcRule: row.calcRule,
      scopeDays: row.scopeDays,
      scopeAreaM2: row.scopeAreaM2,
      scopeNotes: row.scopeNotes,
      referenceUnitRate: row.referenceUnitRate,
      maxDiscountPct: row.maxDiscountPct,
      allowDiscount: row.allowDiscount,
      isOptional: row.isOptional,
    });

    imported.push(row.lineCode ?? row.description.slice(0, 40));
    if (row.lineCode) existingCodes.add(row.lineCode.toLowerCase());
  }

  return { imported: imported.length, skipped: skipped.length, importedLines: imported, skippedLines: skipped };
}

/** Build spec line create payloads for a new project from master catalog. */
export async function buildProjectSpecFromMaster(
  projectId: string,
): Promise<Omit<SpecLine, "id">[] | null> {
  await ensureMasterCatalogSeeded();
  const master = await listMasterSpecLines({ activeOnly: true });
  if (master.length === 0) return null;

  return master.map((line, i) => ({
    projectId,
    bucket: line.bucket,
    sortOrder: i,
    lineCode: line.lineCode,
    description: line.description,
    descriptions: line.descriptions,
    unit: line.unit,
    defaultQty: line.defaultQty,
    scopeDays: line.scopeDays,
    scopeAreaM2: line.scopeAreaM2,
    scopeNotes: line.scopeNotes,
    ownerLocked: true,
    allowDiscount: line.allowDiscount,
    maxDiscountPct: line.maxDiscountPct,
    referenceUnitRate: line.referenceUnitRate,
    calcRule: line.calcRule,
    calcParams: line.calcParams,
    serviceDefId: line.serviceDefId,
    isOptional: line.isOptional,
  }));
}
