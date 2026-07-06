import { prisma } from "@/lib/prisma";
import { getOrCreateYardProfile } from "@/lib/db/yardProfile";
import {
  YARD_COST_TEMPLATE_SEED,
  YARD_GENERAL_SERVICE_SEED,
} from "@/lib/shipyard/generalServiceSeed";

export type YardGeneralServiceItemView = {
  id: string;
  lineCode: string;
  description: string;
  unit: string | null;
  defaultQty: number | null;
  defaultLabourHours: number | null;
  defaultLabourRate: number | null;
  defaultMaterialCost: number | null;
  defaultEquipmentCost: number | null;
  sortOrder: number;
  active: boolean;
};

function mapItem(row: {
  id: string;
  lineCode: string;
  description: string;
  unit: string | null;
  defaultQty: number | null;
  defaultLabourHours: number | null;
  defaultLabourRate: number | null;
  defaultMaterialCost: number | null;
  defaultEquipmentCost: number | null;
  sortOrder: number;
  active: boolean;
}): YardGeneralServiceItemView {
  return { ...row };
}

export async function seedYardGeneralServicesAndTemplates(yardProfileId: string) {
  const existing = await prisma.yardGeneralServiceItem.count({ where: { yardProfileId } });
  if (existing > 0) return;

  const items = await Promise.all(
    YARD_GENERAL_SERVICE_SEED.map((item, i) =>
      prisma.yardGeneralServiceItem.create({
        data: {
          yardProfileId,
          lineCode: item.lineCode,
          description: item.description,
          unit: item.unit,
          defaultQty: item.defaultQty,
          defaultLabourHours: "defaultLabourHours" in item ? item.defaultLabourHours : null,
          defaultLabourRate: "defaultLabourRate" in item ? item.defaultLabourRate : null,
          defaultMaterialCost: "defaultMaterialCost" in item ? item.defaultMaterialCost : null,
          defaultEquipmentCost: "defaultEquipmentCost" in item ? item.defaultEquipmentCost : null,
          sortOrder: i,
        },
      }),
    ),
  );

  const itemByCode = new Map(items.map((i) => [i.lineCode, i]));

  for (const [ti, tmpl] of YARD_COST_TEMPLATE_SEED.entries()) {
    const template = await prisma.yardCostTemplate.create({
      data: {
        yardProfileId,
        name: tmpl.name,
        targetOwnerLabel: tmpl.targetOwnerLabel,
        marginPct: tmpl.marginPct,
        isDefault: tmpl.isDefault,
        sortOrder: ti,
      },
    });

    await prisma.yardCostTemplateLine.createMany({
      data: YARD_GENERAL_SERVICE_SEED.map((seed, i) => {
        const item = itemByCode.get(seed.lineCode)!;
        const labourHours = "defaultLabourHours" in seed ? seed.defaultLabourHours ?? 0 : 0;
        const labourRate =
          ("defaultLabourRate" in seed ? seed.defaultLabourRate ?? 0 : 0) * tmpl.rateMultiplier;
        const materialCost =
          ("defaultMaterialCost" in seed ? seed.defaultMaterialCost ?? 0 : 0) * tmpl.rateMultiplier;
        const equipmentCost =
          ("defaultEquipmentCost" in seed ? seed.defaultEquipmentCost ?? 0 : 0) * tmpl.rateMultiplier;
        return {
          templateId: template.id,
          generalServiceItemId: item.id,
          lineCode: seed.lineCode,
          description: seed.description,
          unit: seed.unit,
          labourHours,
          labourRate,
          materialCost,
          equipmentCost,
          subcontractCost: 0,
          sortOrder: i,
        };
      }),
    });
  }
}

export async function listYardGeneralServices(
  companyId?: string | null,
): Promise<YardGeneralServiceItemView[]> {
  const profile = await getOrCreateYardProfile(companyId);
  if (!profile) return [];

  await seedYardGeneralServicesAndTemplates(profile.id);

  const rows = await prisma.yardGeneralServiceItem.findMany({
    where: { yardProfileId: profile.id, active: true },
    orderBy: { sortOrder: "asc" },
  });
  return rows.map(mapItem);
}

export async function getYardProfileIdForInvite(inviteId: string): Promise<string | null> {
  const invite = await prisma.yardInvite.findUnique({
    where: { id: inviteId },
    select: { yardCompanyId: true },
  });
  const profile = await getOrCreateYardProfile(invite?.yardCompanyId);
  return profile?.id ?? null;
}
