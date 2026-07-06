import { prisma } from "@/lib/prisma";
import { getOrCreateYardProfile } from "@/lib/db/yardProfile";
import { seedYardGeneralServicesAndTemplates } from "@/lib/db/yardGeneralServices";

export type YardCostTemplateSummary = {
  id: string;
  name: string;
  targetOwnerLabel: string | null;
  description: string | null;
  marginPct: number;
  isDefault: boolean;
  lineCount: number;
};

export type YardCostTemplateLineView = {
  id: string;
  lineCode: string | null;
  description: string;
  unit: string | null;
  labourHours: number | null;
  labourRate: number | null;
  materialCost: number;
  equipmentCost: number;
  subcontractCost: number;
  generalServiceItemId: string | null;
};

export type YardCostTemplateDetail = YardCostTemplateSummary & {
  lines: YardCostTemplateLineView[];
};

export async function listYardCostTemplates(
  companyId?: string | null,
): Promise<YardCostTemplateSummary[]> {
  const profile = await getOrCreateYardProfile(companyId);
  if (!profile) return [];

  await seedYardGeneralServicesAndTemplates(profile.id);

  const rows = await prisma.yardCostTemplate.findMany({
    where: { yardProfileId: profile.id },
    include: { _count: { select: { lines: true } } },
    orderBy: { sortOrder: "asc" },
  });

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    targetOwnerLabel: r.targetOwnerLabel,
    description: r.description,
    marginPct: r.marginPct,
    isDefault: r.isDefault,
    lineCount: r._count.lines,
  }));
}

export async function getYardCostTemplate(templateId: string): Promise<YardCostTemplateDetail | null> {
  const row = await prisma.yardCostTemplate.findUnique({
    where: { id: templateId },
    include: { lines: { orderBy: { sortOrder: "asc" } }, _count: { select: { lines: true } } },
  });
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    targetOwnerLabel: row.targetOwnerLabel,
    description: row.description,
    marginPct: row.marginPct,
    isDefault: row.isDefault,
    lineCount: row._count.lines,
    lines: row.lines.map((l) => ({
      id: l.id,
      lineCode: l.lineCode,
      description: l.description,
      unit: l.unit,
      labourHours: l.labourHours,
      labourRate: l.labourRate,
      materialCost: l.materialCost,
      equipmentCost: l.equipmentCost,
      subcontractCost: l.subcontractCost,
      generalServiceItemId: l.generalServiceItemId,
    })),
  };
}

/** Apply template labour/material/equipment rates to estimate lines matched by lineCode or general service id. */
export async function applyTemplateToEstimateLines(
  estimateId: string,
  templateId: string,
): Promise<void> {
  const [template, lines] = await Promise.all([
    prisma.yardCostTemplate.findUnique({
      where: { id: templateId },
      include: { lines: true },
    }),
    prisma.yardCostEstimateLine.findMany({ where: { estimateId } }),
  ]);
  if (!template) return;

  const byCode = new Map(
    template.lines.filter((l) => l.lineCode).map((l) => [l.lineCode!, l]),
  );
  const byServiceId = new Map(
    template.lines.filter((l) => l.generalServiceItemId).map((l) => [l.generalServiceItemId!, l]),
  );

  for (const line of lines) {
    let templateLine = line.generalServiceItemId
      ? byServiceId.get(line.generalServiceItemId)
      : undefined;

    if (!templateLine && line.specLineId) {
      const specLine = await prisma.specLine.findUnique({
        where: { id: line.specLineId },
        select: { lineCode: true },
      });
      if (specLine?.lineCode) {
        templateLine = byCode.get(specLine.lineCode);
      }
    }

    if (!templateLine) continue;

    const labourTotal = (templateLine.labourHours ?? 0) * (templateLine.labourRate ?? 0);
    const lineTotal =
      labourTotal +
      templateLine.materialCost +
      templateLine.equipmentCost +
      templateLine.subcontractCost;

    await prisma.yardCostEstimateLine.update({
      where: { id: line.id },
      data: {
        labourHours: templateLine.labourHours,
        labourRate: templateLine.labourRate,
        labourTotal,
        materialCost: templateLine.materialCost,
        equipmentCost: templateLine.equipmentCost,
        subcontractCost: templateLine.subcontractCost,
        lineTotal,
      },
    });
  }

  await prisma.yardCostEstimate.update({
    where: { id: estimateId },
    data: { templateId, marginPct: template.marginPct },
  });
}
