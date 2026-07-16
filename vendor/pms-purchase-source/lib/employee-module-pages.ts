import "server-only";

import type { PrismaClient } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getDatabaseForUser } from "@/lib/services/master-company-database";
import { CREW_NAV_CATALOG } from "@/lib/nav/crew-nav-catalog.generated";
import { normalizeNavPath } from "@/lib/nav/master-crew-sync-nav";
import { mergeCompanionCrewRankPagePaths } from "@/lib/crew-rank-default-pages";

export type EmployeeModulePageKind = "default" | "manual";

export type ModulePageAssignmentInput = {
  moduleId: string;
  moduleName: string;
  defaultPagePaths: string[];
  manualPagePaths: string[];
  manualPagesCustomized: boolean;
};

export type ModulePageAssignmentView = {
  moduleId: string;
  moduleName: string;
  defaultPagePaths: string[];
  manualPagePaths: string[];
  manualPagesCustomized: boolean;
  catalogPagePaths: string[];
};

export function normalizePagePaths(paths: Iterable<string>): string[] {
  const set = new Set<string>();
  for (const p of paths) {
    const n = normalizeNavPath(p);
    if (n) set.add(n);
  }
  return [...set].sort();
}

/** All navigable pages for a module from the shared nav catalog. */
export function getCatalogPagePathsForModule(moduleName: string): string[] {
  return normalizePagePaths(
    CREW_NAV_CATALOG.filter((e) => e.moduleName === moduleName).map((e) => e.href)
  );
}

export function getCatalogEntriesForModule(moduleName: string) {
  return CREW_NAV_CATALOG.filter((e) => e.moduleName === moduleName);
}

function isValidPageKind(kind: string): kind is EmployeeModulePageKind {
  return kind === "default" || kind === "manual";
}

type DbClient = Pick<
  PrismaClient,
  "employeeModule" | "employeeModulePage" | "module"
>;

export async function loadEmployeeModulePageAssignments(
  employeeId: string,
  assignedModules: Array<{ module: { id: string; name: string } }>,
  db: DbClient = prisma,
  options?: {
    /** When set, the Default column uses these paths instead of per-employee default rows. */
    accessLevelDefaultPagesByModule?: Map<string, string[]>;
  }
): Promise<ModulePageAssignmentView[]> {
  const [pageRows, moduleRows] = await Promise.all([
    db.employeeModulePage.findMany({
      where: { employeeId },
      select: { moduleId: true, pagePath: true, pageKind: true },
    }),
    db.employeeModule.findMany({
      where: { employeeId },
      select: { moduleId: true, manualPagesCustomized: true },
    }),
  ]);

  const customizedByModule = new Map(
    moduleRows.map((r) => [r.moduleId, r.manualPagesCustomized])
  );
  const defaultsByModule = new Map<string, string[]>();
  const manualsByModule = new Map<string, string[]>();

  for (const row of pageRows) {
    if (!isValidPageKind(row.pageKind)) continue;
    const path = normalizeNavPath(row.pagePath);
    const bucket =
      row.pageKind === "default" ? defaultsByModule : manualsByModule;
    const list = bucket.get(row.moduleId) ?? [];
    list.push(path);
    bucket.set(row.moduleId, list);
  }

  return assignedModules.map(({ module }) => {
    const catalogPagePaths = getCatalogPagePathsForModule(module.name);
    const levelDefaults = options?.accessLevelDefaultPagesByModule?.get(module.id);
    const employeeStoredDefault = defaultsByModule.get(module.id);
    const defaultPagePaths = normalizePagePaths(
      levelDefaults?.length
        ? levelDefaults
        : employeeStoredDefault?.length
          ? employeeStoredDefault
          : catalogPagePaths
    );
    const storedManual = manualsByModule.get(module.id);
    const manualPagesCustomized = customizedByModule.get(module.id) ?? false;
    const manualPagePaths = normalizePagePaths(
      storedManual?.length
        ? storedManual
        : manualPagesCustomized
          ? []
          : defaultPagePaths
    );

    return {
      moduleId: module.id,
      moduleName: module.name,
      defaultPagePaths,
      manualPagePaths,
      manualPagesCustomized,
      catalogPagePaths,
    };
  });
}

/** Effective nav paths for an office employee (manual pages per module). */
export async function resolveEmployeeAllowedPagePaths(
  employeeId: string,
  assignedModules: Array<{ module: { id: string; name: string } }>,
  employee?: {
    designationAccessLevel?: number | null;
    companyId?: string | null;
    masterCompanyId?: string | null;
    company?: { id: string } | null;
  }
): Promise<string[] | undefined> {
  if (assignedModules.length === 0) return undefined;

  let db: DbClient = prisma;
  const companyId = employee?.company?.id ?? employee?.companyId;
  if (companyId && employee) {
    try {
      const { prisma: companyDb } = await getDatabaseForUser(
        employeeId,
        employee.designationAccessLevel ?? null,
        companyId,
        employee.masterCompanyId
      );
      const rowCount = await companyDb.employeeModulePage.count({
        where: { employeeId },
      });
      if (rowCount > 0) {
        db = companyDb as DbClient;
      }
    } catch {
      // fall back to master
    }
  }

  const assignments = await loadEmployeeModulePageAssignments(
    employeeId,
    assignedModules,
    db
  );

  const hasAnyStoredPages = await db.employeeModulePage.count({
    where: { employeeId },
  });

  if (hasAnyStoredPages === 0) return undefined;

  const paths = new Set<string>();
  for (const a of assignments) {
    const effective =
      a.manualPagesCustomized || a.manualPagePaths.length > 0
        ? a.manualPagePaths
        : a.defaultPagePaths.length > 0
          ? a.defaultPagePaths
          : a.catalogPagePaths;
    for (const p of effective) paths.add(p);
  }

  const accessLevel = employee?.designationAccessLevel;
  const merged =
    accessLevel != null
      ? mergeCompanionCrewRankPagePaths(accessLevel, paths)
      : [...paths].sort();

  return merged.length > 0 ? merged : undefined;
}

export async function saveEmployeeModulePageAssignments(
  employeeId: string,
  moduleAssignments: ModulePageAssignmentInput[],
  db: DbClient = prisma
): Promise<void> {
  const moduleIds = moduleAssignments.map((m) => m.moduleId);

  await db.employeeModulePage.deleteMany({
    where: {
      employeeId,
      ...(moduleIds.length > 0 ? { moduleId: { notIn: moduleIds } } : {}),
    },
  });

  if (moduleIds.length === 0) {
    await db.employeeModulePage.deleteMany({ where: { employeeId } });
    return;
  }

  const pageRows: Array<{
    employeeId: string;
    moduleId: string;
    pagePath: string;
    pageKind: string;
  }> = [];

  for (const assignment of moduleAssignments) {
    const catalog = getCatalogPagePathsForModule(assignment.moduleName);
    const catalogSet = new Set(catalog);

    const defaultPaths = normalizePagePaths(
      assignment.defaultPagePaths.filter((p) => catalogSet.has(normalizeNavPath(p)))
    );
    const defaultOrCatalog = defaultPaths.length > 0 ? defaultPaths : catalog;

    let manualPaths = normalizePagePaths(
      assignment.manualPagePaths.filter((p) => catalogSet.has(normalizeNavPath(p)))
    );
    let manualCustomized = assignment.manualPagesCustomized;

    if (!manualCustomized) {
      manualPaths = [...defaultOrCatalog];
    } else if (manualPaths.length === 0) {
      manualPaths = [...defaultOrCatalog];
      manualCustomized = false;
    }

    for (const path of defaultOrCatalog) {
      pageRows.push({
        employeeId,
        moduleId: assignment.moduleId,
        pagePath: path,
        pageKind: "default",
      });
    }
    for (const path of manualPaths) {
      pageRows.push({
        employeeId,
        moduleId: assignment.moduleId,
        pagePath: path,
        pageKind: "manual",
      });
    }

    await db.employeeModule.updateMany({
      where: { employeeId, moduleId: assignment.moduleId },
      data: { manualPagesCustomized: manualCustomized },
    });
  }

  await db.employeeModulePage.deleteMany({
    where: { employeeId, moduleId: { in: moduleIds } },
  });

  if (pageRows.length > 0) {
    await db.employeeModulePage.createMany({
      data: pageRows,
      skipDuplicates: true,
    });
  }
}

/** Seed default + manual page rows from catalog when modules are assigned without explicit pages. */
export function buildCatalogModulePageAssignments(
  modules: Array<{ id: string; name: string }>
): ModulePageAssignmentInput[] {
  return modules.map((module) => {
    const paths = getCatalogPagePathsForModule(module.name);
    return {
      moduleId: module.id,
      moduleName: module.name,
      defaultPagePaths: paths,
      manualPagePaths: paths,
      manualPagesCustomized: false,
    };
  });
}
