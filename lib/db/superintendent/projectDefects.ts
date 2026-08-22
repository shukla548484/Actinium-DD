import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/db/superintendent/pagination";
import {
  defectRowKey,
  type DefectImportVesselContext,
  type ParsedDefectRow,
} from "@/lib/superintendent/defectsExcel";

export type DdProjectDefectDto = {
  id: string;
  dryDockProjectId: string;
  department: string;
  defectDetails: string;
  machineryAssociated: string | null;
  requisitionNumber: string | null;
  sortOrder: number;
  importedFromFile: string | null;
  createdAt: string;
};

export async function getDefectImportVesselContext(
  dryDockProjectId: string,
): Promise<DefectImportVesselContext | null> {
  const findFirst = prisma.dryDockProject?.findFirst?.bind(prisma.dryDockProject);
  if (typeof findFirst !== "function") {
    console.error(
      "[projectDefects] Prisma DryDockProject delegate is missing. Run `npx prisma generate`.",
    );
    return null;
  }

  const project = await findFirst({
    where: { id: dryDockProjectId, ...notDeleted },
    select: {
      name: true,
      referenceCode: true,
      classSociety: true,
      vessel: {
        select: {
          name: true,
          code: true,
          imoNumber: true,
          flag: true,
          classSociety: true,
          vesselType: true,
          callSign: true,
          grossTonnage: true,
          yearBuilt: true,
          company: {
            select: {
              name: true,
              code: true,
              address: true,
              contactPerson: true,
              contactEmail: true,
              contactPhone: true,
            },
          },
        },
      },
    },
  });
  if (!project) return null;

  const vessel = project.vessel ?? null;
  const company = vessel?.company ?? null;

  return {
    vesselName: vessel?.name ?? "",
    vesselCode: vessel?.code ?? "",
    imoNumber: vessel?.imoNumber ?? null,
    hullNumber: vessel?.code ?? null,
    flag: vessel?.flag ?? null,
    classSociety: vessel?.classSociety ?? project.classSociety ?? null,
    vesselType: vessel?.vesselType ?? null,
    callSign: vessel?.callSign ?? null,
    grossTonnage: typeof vessel?.grossTonnage === "number" ? vessel.grossTonnage : null,
    yearBuilt: typeof vessel?.yearBuilt === "number" ? vessel.yearBuilt : null,
    companyName: company?.name ?? "",
    companyCode: company?.code ?? "",
    companyAddress: company?.address ?? null,
    companyContactPerson: company?.contactPerson ?? null,
    companyContactEmail: company?.contactEmail ?? null,
    companyContactPhone: company?.contactPhone ?? null,
    projectName: project.name ?? "",
    projectCode: project.referenceCode ?? null,
  };
}

export async function listProjectDefects(dryDockProjectId: string): Promise<DdProjectDefectDto[]> {
  const findMany = prisma.ddProjectDefect?.findMany?.bind(prisma.ddProjectDefect);
  if (typeof findMany !== "function") {
    console.error(
      "[projectDefects] Prisma DdProjectDefect delegate is missing. Run `npx prisma generate`.",
    );
    return [];
  }
  const rows = await findMany({
    where: { dryDockProjectId, ...notDeleted },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return rows.map((row) => ({
    id: row.id,
    dryDockProjectId: row.dryDockProjectId,
    department: row.department,
    defectDetails: row.defectDetails,
    machineryAssociated: row.machineryAssociated,
    requisitionNumber: row.requisitionNumber,
    sortOrder: row.sortOrder,
    importedFromFile: row.importedFromFile,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function countProjectDefects(dryDockProjectId: string): Promise<number> {
  const countFn = prisma.ddProjectDefect?.count?.bind(prisma.ddProjectDefect);
  if (typeof countFn !== "function") {
    console.error(
      "[projectDefects] Prisma DdProjectDefect delegate is missing. Run `npx prisma generate`.",
    );
    return 0;
  }
  return countFn({ where: { dryDockProjectId, ...notDeleted } });
}

export function summarizeImportedDefectsForVesselInput(
  defects: Array<{
    department: string;
    defectDetails: string;
    machineryAssociated: string | null;
    requisitionNumber?: string | null;
  }>,
): { openDefects: string; machineryStatus: string; importedDefectCount: number } {
  const openDefects = defects
    .map((d) => {
      const req = d.requisitionNumber?.trim() ? ` (Req ${d.requisitionNumber.trim()})` : "";
      return `${d.department}: ${d.defectDetails}${req}`;
    })
    .join("\n");

  const machinery = [
    ...new Set(
      defects
        .map((d) => d.machineryAssociated?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  return {
    openDefects,
    machineryStatus: machinery.length > 0 ? machinery.join("\n") : "See imported defects.",
    importedDefectCount: defects.length,
  };
}

/**
 * Imported or manually added DdProjectDefect rows satisfy Current defects.
 * Photos are not required. Does not overwrite approved / inactive submissions.
 */
export async function syncVesselDefectsInputFromImportedRows(
  dryDockProjectId: string,
  defects: Array<{
    department: string;
    defectDetails: string;
    machineryAssociated: string | null;
    requisitionNumber?: string | null;
  }>,
) {
  if (defects.length === 0) return null;

  const { getActiveInputSubmission, upsertInputSubmission } = await import(
    "@/lib/db/superintendent/inputs"
  );

  const existing = await getActiveInputSubmission(dryDockProjectId, "vessel_defects");
  if (existing?.status === "approved" || existing?.status === "inactive") {
    return existing;
  }

  const summary = summarizeImportedDefectsForVesselInput(defects);
  const existingValues = existing?.valuesJson ?? {};
  const valuesJson = {
    ...existingValues,
    openDefects: summary.openDefects,
    machineryStatus:
      typeof existingValues.machineryStatus === "string" &&
      existingValues.machineryStatus.trim() &&
      existingValues.machineryStatus.trim() !== "See imported defects."
        ? existingValues.machineryStatus
        : summary.machineryStatus,
    importedDefectCount: summary.importedDefectCount,
  };

  return upsertInputSubmission({
    dryDockProjectId,
    sectionKey: "vessel_defects",
    valuesJson,
    enteredByRole: existing?.enteredByRole ?? "vessel",
    enteredByName: existing?.enteredByName ?? "Defects list",
    status: "submitted",
  });
}

export async function createProjectDefect(input: {
  dryDockProjectId: string;
  department: string;
  defectDetails: string;
  machineryAssociated?: string | null;
  requisitionNumber?: string | null;
  createdByUserId: string | null;
}): Promise<{
  defect: DdProjectDefectDto;
  defects: DdProjectDefectDto[];
  submission: Awaited<ReturnType<typeof syncVesselDefectsInputFromImportedRows>>;
}> {
  const department = input.department.trim();
  const defectDetails = input.defectDetails.trim();
  const machineryAssociated = input.machineryAssociated?.trim() || null;
  const requisitionNumber = input.requisitionNumber?.trim() || null;
  if (!department || !defectDetails) {
    throw new Error("Department and defect details are required.");
  }

  const existing = await prisma.ddProjectDefect.findMany({
    where: { dryDockProjectId: input.dryDockProjectId, ...notDeleted },
    select: { department: true, defectDetails: true, sortOrder: true },
  });
  if (existing.some((row) => defectRowKey(row) === defectRowKey({ department, defectDetails }))) {
    throw new Error("This defect is already on the list.");
  }

  const sortOrder = existing.reduce((max, row) => Math.max(max, row.sortOrder), 0) + 1;
  const row = await prisma.ddProjectDefect.create({
    data: {
      dryDockProjectId: input.dryDockProjectId,
      department,
      defectDetails,
      machineryAssociated,
      requisitionNumber,
      sortOrder,
      createdByUserId: input.createdByUserId,
    },
  });

  const defects = await listProjectDefects(input.dryDockProjectId);
  const submission = await syncVesselDefectsInputFromImportedRows(
    input.dryDockProjectId,
    defects,
  );
  return {
    defect: {
      id: row.id,
      dryDockProjectId: row.dryDockProjectId,
      department: row.department,
      defectDetails: row.defectDetails,
      machineryAssociated: row.machineryAssociated,
      requisitionNumber: row.requisitionNumber,
      sortOrder: row.sortOrder,
      importedFromFile: row.importedFromFile,
      createdAt: row.createdAt.toISOString(),
    },
    defects,
    submission,
  };
}

export async function importProjectDefects(input: {
  dryDockProjectId: string;
  rows: ParsedDefectRow[];
  fileName: string | null;
  createdByUserId: string | null;
}): Promise<{
  imported: number;
  skipped: number;
  defects: DdProjectDefectDto[];
  submission: Awaited<ReturnType<typeof syncVesselDefectsInputFromImportedRows>>;
}> {
  const existing = await prisma.ddProjectDefect.findMany({
    where: { dryDockProjectId: input.dryDockProjectId, ...notDeleted },
    select: { department: true, defectDetails: true, sortOrder: true },
  });
  const existingKeys = new Set(existing.map((row) => defectRowKey(row)));
  let sortOrder = existing.reduce((max, row) => Math.max(max, row.sortOrder), 0);
  let imported = 0;
  let skipped = 0;

  for (const row of input.rows) {
    const key = defectRowKey(row);
    if (existingKeys.has(key)) {
      skipped += 1;
      continue;
    }
    sortOrder += 1;
    await prisma.ddProjectDefect.create({
      data: {
        dryDockProjectId: input.dryDockProjectId,
        department: row.department,
        defectDetails: row.defectDetails,
        machineryAssociated: row.machineryAssociated,
        requisitionNumber: row.requisitionNumber,
        sortOrder,
        importedFromFile: input.fileName,
        createdByUserId: input.createdByUserId,
      },
    });
    existingKeys.add(key);
    imported += 1;
  }

  const defects = await listProjectDefects(input.dryDockProjectId);
  const submission = await syncVesselDefectsInputFromImportedRows(
    input.dryDockProjectId,
    defects,
  );
  return { imported, skipped, defects, submission };
}
