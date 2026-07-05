import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { JOB_LIBRARY_CATALOG, type JobLibrarySeedNode } from "./catalog";

let seedPromise: Promise<void> | null = null;

async function insertNode(
  node: JobLibrarySeedNode,
  parentId: string | null,
  sortOrder: number,
): Promise<void> {
  const created = await prisma.jobLibraryNode.create({
    data: {
      parentId,
      nodeType: node.nodeType,
      code: node.code,
      name: node.name,
      description: node.description ?? null,
      department: node.department ?? null,
      workshop: node.workshop ?? null,
      sortOrder,
      referenceCode: node.referenceCode ?? null,
      defaultPriority: node.defaultPriority ?? null,
      estimatedManhours: node.estimatedManhours ?? null,
      inputTemplate: (node.inputTemplate ?? null) as Prisma.InputJsonValue,
      mtilPhase: node.mtilPhase ?? null,
      mtilJobCode: node.mtilJobCode ?? null,
      dynamicTemplateKey: node.dynamicTemplateKey ?? null,
      mtilMeta: (node.mtilMeta ?? null) as Prisma.InputJsonValue,
    },
  });

  for (let i = 0; i < (node.children?.length ?? 0); i++) {
    const child = node.children![i]!;
    await insertNode(child, created.id, i);
  }
}

export async function ensureJobLibrarySeeded(): Promise<void> {
  if (seedPromise) return seedPromise;

  seedPromise = (async () => {
    const count = await prisma.jobLibraryNode.count({ where: { deletedAt: null } });
    if (count > 0) return;

    for (let i = 0; i < JOB_LIBRARY_CATALOG.length; i++) {
      await insertNode(JOB_LIBRARY_CATALOG[i]!, null, i);
    }
  })();

  return seedPromise;
}

export async function resetJobLibrarySeedForDev(): Promise<void> {
  await prisma.jobLibraryNode.deleteMany({});
  seedPromise = null;
  await ensureJobLibrarySeeded();
}

/** Upsert MTIL Phase 1 department if missing (for existing databases). */
export async function ensureMtilPhase1Seeded(): Promise<{ inserted: boolean; jobCount: number }> {
  const { generatePhase1JobLibraryTree, getPhase1Stats } = await import(
    "@/lib/mtil/phases/phase1/generate"
  );
  const stats = getPhase1Stats();

  const existing = await prisma.jobLibraryNode.findFirst({
    where: { code: "mtil_p1_main_propulsion", deletedAt: null },
  });
  if (existing) return { inserted: false, jobCount: stats.jobCount };

  const tree = generatePhase1JobLibraryTree();
  const maxSort = await prisma.jobLibraryNode.aggregate({
    where: { parentId: null, deletedAt: null },
    _max: { sortOrder: true },
  });
  await insertNode(tree, null, (maxSort._max.sortOrder ?? -1) + 1);

  try {
    const { seedJobCatalogPhase1 } = await import("@/lib/mtil/db/seedJobCatalogPhase1");
    await seedJobCatalogPhase1();
  } catch (err) {
    console.warn("[mtil] Job catalog DB seed skipped:", err);
  }

  return { inserted: true, jobCount: stats.jobCount };
}

/** Upsert Phase 1 v0.4 engineering workbook library (JOB-ENG-ME / TMP-ENG-ME). */
export async function ensureMtilPhase1WorkbookV04Seeded(): Promise<{
  inserted: boolean;
  jobCount: number;
  templates: number;
  libraryVersion: string;
}> {
  const { getPhase1WorkbookV04Stats } = await import("@/lib/mtil/phases/phase1/workbookJobLibraryTree");
  const { seedPhase1WorkbookV04, isPhase1WorkbookV04Seeded } = await import(
    "@/lib/mtil/db/seedPhase1WorkbookV04"
  );
  const stats = getPhase1WorkbookV04Stats();

  if (await isPhase1WorkbookV04Seeded()) {
    return {
      inserted: false,
      jobCount: stats.jobCount,
      templates: stats.catalogTemplateCount,
      libraryVersion: stats.libraryVersion,
    };
  }

  const result = await seedPhase1WorkbookV04();
  return {
    inserted: true,
    jobCount: result.jobCount,
    templates: result.templates,
    libraryVersion: result.libraryVersion,
  };
}

/** Upsert MTIL Phase 2 department if missing (for existing databases). */
export async function ensureMtilPhase2Seeded(): Promise<{ inserted: boolean; jobCount: number }> {
  const { generatePhase2JobLibraryTree, getPhase2Stats } = await import(
    "@/lib/mtil/phases/phase2/generate"
  );
  const stats = getPhase2Stats();

  const existing = await prisma.jobLibraryNode.findFirst({
    where: { code: "mtil_p2_auxiliary_machinery", deletedAt: null },
  });
  if (existing) return { inserted: false, jobCount: stats.jobCount };

  const tree = generatePhase2JobLibraryTree();
  const maxSort = await prisma.jobLibraryNode.aggregate({
    where: { parentId: null, deletedAt: null },
    _max: { sortOrder: true },
  });
  await insertNode(tree, null, (maxSort._max.sortOrder ?? -1) + 1);

  try {
    const { seedJobCatalogPhase2 } = await import("@/lib/mtil/db/seedJobCatalogPhase2");
    await seedJobCatalogPhase2();
  } catch (err) {
    console.warn("[mtil] Phase 2 job catalog DB seed skipped:", err);
  }

  return { inserted: true, jobCount: stats.jobCount };
}

/** Upsert Phase 2 v0.5 engineering workbook library (JOB-ENG-AUX / TMP-ENG-AUX). */
export async function ensureMtilPhase2WorkbookV05Seeded(): Promise<{
  inserted: boolean;
  jobCount: number;
  templates: number;
  libraryVersion: string;
}> {
  const { getPhase2WorkbookV05Stats } = await import("@/lib/mtil/phases/phase2/workbookJobLibraryTree");
  const { seedPhase2WorkbookV05, isPhase2WorkbookV05Seeded } = await import(
    "@/lib/mtil/db/seedPhase2WorkbookV05"
  );
  const stats = getPhase2WorkbookV05Stats();

  const existing = await isPhase2WorkbookV05Seeded();
  if (existing) {
    return {
      inserted: false,
      jobCount: stats.jobCount,
      templates: stats.catalogTemplateCount,
      libraryVersion: stats.libraryVersion,
    };
  }

  const result = await seedPhase2WorkbookV05();
  return {
    inserted: true,
    jobCount: result.jobCount,
    templates: result.templates,
    libraryVersion: result.libraryVersion,
  };
}

/** Upsert MTIL Phase 3 department if missing (for existing databases). */
export async function ensureMtilPhase3Seeded(): Promise<{ inserted: boolean; jobCount: number }> {
  const { generatePhase3JobLibraryTree, getPhase3Stats } = await import(
    "@/lib/mtil/phases/phase3/generate"
  );
  const stats = getPhase3Stats();

  const existing = await prisma.jobLibraryNode.findFirst({
    where: { code: "mtil_p3_pumps_valves_piping", deletedAt: null },
  });
  if (existing) return { inserted: false, jobCount: stats.jobCount };

  const tree = generatePhase3JobLibraryTree();
  const maxSort = await prisma.jobLibraryNode.aggregate({
    where: { parentId: null, deletedAt: null },
    _max: { sortOrder: true },
  });
  await insertNode(tree, null, (maxSort._max.sortOrder ?? -1) + 1);

  try {
    const { seedJobCatalogPhase3 } = await import("@/lib/mtil/db/seedJobCatalogPhase3");
    await seedJobCatalogPhase3();
  } catch (err) {
    console.warn("[mtil] Phase 3 job catalog DB seed skipped:", err);
  }

  return { inserted: true, jobCount: stats.jobCount };
}

/** Upsert Phase 3 v0.6 engineering workbook library (JOB-ENG-PVP / TMP-PVP). */
export async function ensureMtilPhase3WorkbookV06Seeded(): Promise<{
  inserted: boolean;
  jobCount: number;
  templates: number;
  libraryVersion: string;
}> {
  const { getPhase3WorkbookV06Stats } = await import("@/lib/mtil/phases/phase3/workbookJobLibraryTree");
  const { seedPhase3WorkbookV06, isPhase3WorkbookV06Seeded } = await import(
    "@/lib/mtil/db/seedPhase3WorkbookV06"
  );
  const stats = getPhase3WorkbookV06Stats();

  if (await isPhase3WorkbookV06Seeded()) {
    return {
      inserted: false,
      jobCount: stats.jobCount,
      templates: stats.catalogTemplateCount,
      libraryVersion: stats.libraryVersion,
    };
  }

  const result = await seedPhase3WorkbookV06();
  return {
    inserted: true,
    jobCount: result.jobCount,
    templates: result.templates,
    libraryVersion: result.libraryVersion,
  };
}

/** Upsert Phase 4 v0.7 engineering workbook library (JOB-DECK-DCG / TMP-DECK). */
export async function ensureMtilPhase4WorkbookV07Seeded(): Promise<{
  inserted: boolean;
  jobCount: number;
  templates: number;
  libraryVersion: string;
}> {
  const { getPhase4WorkbookV07Stats } = await import("@/lib/mtil/phases/phase4/workbookJobLibraryTree");
  const { seedPhase4WorkbookV07, isPhase4WorkbookV07Seeded } = await import(
    "@/lib/mtil/db/seedPhase4WorkbookV07"
  );
  const stats = getPhase4WorkbookV07Stats();

  if (await isPhase4WorkbookV07Seeded()) {
    return {
      inserted: false,
      jobCount: stats.jobCount,
      templates: stats.catalogTemplateCount,
      libraryVersion: stats.libraryVersion,
    };
  }

  const result = await seedPhase4WorkbookV07();
  return {
    inserted: true,
    jobCount: result.jobCount,
    templates: result.templates,
    libraryVersion: result.libraryVersion,
  };
}

/** Upsert Phase 5 v0.8 engineering workbook library (JOB-HUL-HUL / TMP-HUL). */
export async function ensureMtilPhase5WorkbookV08Seeded(): Promise<{
  inserted: boolean;
  jobCount: number;
  templates: number;
  libraryVersion: string;
  initializedOnly?: boolean;
}> {
  const { getPhase5WorkbookV08Stats } = await import("@/lib/mtil/phases/phase5/workbookJobLibraryTree");
  const { seedPhase5WorkbookV08, isPhase5WorkbookV08Seeded } = await import(
    "@/lib/mtil/db/seedPhase5WorkbookV08"
  );
  const stats = getPhase5WorkbookV08Stats();

  if (await isPhase5WorkbookV08Seeded()) {
    return {
      inserted: false,
      jobCount: stats.jobCount,
      templates: stats.catalogTemplateCount,
      libraryVersion: stats.libraryVersion,
      initializedOnly: stats.initializedOnly,
    };
  }

  const result = await seedPhase5WorkbookV08();
  return {
    inserted: true,
    jobCount: result.jobCount,
    templates: result.templates,
    libraryVersion: result.libraryVersion,
    initializedOnly: stats.initializedOnly,
  };
}

/** Upsert Phase 6 v0.9 engineering workbook library (JOB-ELC-ELC / TMP-ELC). */
export async function ensureMtilPhase6WorkbookV09Seeded(): Promise<{
  inserted: boolean;
  jobCount: number;
  templates: number;
  libraryVersion: string;
  initializedOnly?: boolean;
}> {
  const { getPhase6WorkbookV09Stats } = await import("@/lib/mtil/phases/phase6/workbookJobLibraryTree");
  const { seedPhase6WorkbookV09, isPhase6WorkbookV09Seeded } = await import(
    "@/lib/mtil/db/seedPhase6WorkbookV09"
  );
  const stats = getPhase6WorkbookV09Stats();

  if (await isPhase6WorkbookV09Seeded()) {
    return {
      inserted: false,
      jobCount: stats.jobCount,
      templates: stats.catalogTemplateCount,
      libraryVersion: stats.libraryVersion,
      initializedOnly: stats.initializedOnly,
    };
  }

  const result = await seedPhase6WorkbookV09();
  return {
    inserted: true,
    jobCount: result.jobCount,
    templates: result.templates,
    libraryVersion: result.libraryVersion,
    initializedOnly: stats.initializedOnly,
  };
}

/** Upsert Phase 7 v1.0 engineering workbook library (JOB-CGO-TNK / TMP-CGO). */
export async function ensureMtilPhase7WorkbookV10Seeded(): Promise<{
  inserted: boolean;
  jobCount: number;
  templates: number;
  libraryVersion: string;
  initializedOnly?: boolean;
}> {
  const { getPhase7WorkbookV10Stats } = await import("@/lib/mtil/phases/phase7/workbookJobLibraryTree");
  const { seedPhase7WorkbookV10, isPhase7WorkbookV10Seeded } = await import(
    "@/lib/mtil/db/seedPhase7WorkbookV10"
  );
  const stats = getPhase7WorkbookV10Stats();

  if (await isPhase7WorkbookV10Seeded()) {
    return {
      inserted: false,
      jobCount: stats.jobCount,
      templates: stats.catalogTemplateCount,
      libraryVersion: stats.libraryVersion,
      initializedOnly: stats.initializedOnly,
    };
  }

  const result = await seedPhase7WorkbookV10();
  return {
    inserted: true,
    jobCount: result.jobCount,
    templates: result.templates,
    libraryVersion: result.libraryVersion,
    initializedOnly: stats.initializedOnly,
  };
}
