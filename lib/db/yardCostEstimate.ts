import { prisma } from "@/lib/prisma";
import { getShipyardRfqInviteContext } from "@/lib/db/shipyardRfq";
import { listYardGeneralServices } from "@/lib/db/yardGeneralServices";
import { applyTemplateToEstimateLines } from "@/lib/db/yardCostTemplates";

export type YardCostEstimateLineInput = {
  id?: string;
  specLineId?: string | null;
  generalServiceItemId?: string | null;
  lineSource?: "spec" | "general_service";
  description: string;
  unit?: string | null;
  quantity?: number | null;
  labourHours?: number | null;
  labourRate?: number | null;
  materialCost?: number;
  equipmentCost?: number;
  subcontractCost?: number;
  notes?: string | null;
  sortOrder?: number;
};

export type YardCostEstimateVersionSummary = {
  id: string;
  versionNo: number;
  versionLabel: string;
  status: string;
  templateId: string | null;
  templateName: string | null;
  isSelectedForQuote: boolean;
  grandTotal: number;
  updatedAt: string;
};

export type YardCostEstimateView = {
  id: string;
  inviteId: string;
  versionNo: number;
  versionLabel: string;
  templateId: string | null;
  templateName: string | null;
  isSelectedForQuote: boolean;
  status: string;
  currency: string;
  marginPct: number;
  totalLabour: number;
  totalMaterial: number;
  totalEquipment: number;
  totalSubcontract: number;
  subtotal: number;
  grandTotal: number;
  notes: string | null;
  lines: {
    id: string;
    specLineId: string | null;
    generalServiceItemId: string | null;
    lineSource: string;
    description: string;
    unit: string | null;
    quantity: number | null;
    labourHours: number | null;
    labourRate: number | null;
    labourTotal: number;
    materialCost: number;
    equipmentCost: number;
    subcontractCost: number;
    lineTotal: number;
    notes: string | null;
    sortOrder: number;
    bucket: string | null;
    lineCode: string | null;
  }[];
};

function num(value: number | null | undefined, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function defaultVersionLabel(versionNo: number): string {
  return `Quote v${versionNo}`;
}

function computeLineTotals(input: {
  labourHours?: number | null;
  labourRate?: number | null;
  materialCost?: number | null;
  equipmentCost?: number | null;
  subcontractCost?: number | null;
}) {
  const labourTotal = num(input.labourHours) * num(input.labourRate);
  const materialCost = num(input.materialCost);
  const equipmentCost = num(input.equipmentCost);
  const subcontractCost = num(input.subcontractCost);
  const lineTotal = labourTotal + materialCost + equipmentCost + subcontractCost;
  return { labourTotal, materialCost, equipmentCost, subcontractCost, lineTotal };
}

const estimateInclude = {
  lines: { orderBy: { sortOrder: "asc" as const } },
  template: { select: { id: true, name: true } },
};

async function loadEstimateRecord(estimateId: string) {
  return prisma.yardCostEstimate.findUnique({
    where: { id: estimateId },
    include: estimateInclude,
  });
}

function mapEstimateView(
  estimate: NonNullable<Awaited<ReturnType<typeof loadEstimateRecord>>>,
  specLineMeta: Map<string, { bucket: string | null; lineCode: string | null }>,
  generalServiceMeta: Map<string, { lineCode: string }>,
): YardCostEstimateView {
  return {
    id: estimate.id,
    inviteId: estimate.inviteId,
    versionNo: estimate.versionNo,
    versionLabel: estimate.versionLabel ?? defaultVersionLabel(estimate.versionNo),
    templateId: estimate.templateId,
    templateName: estimate.template?.name ?? null,
    isSelectedForQuote: estimate.isSelectedForQuote,
    status: estimate.status,
    currency: estimate.currency,
    marginPct: estimate.marginPct,
    totalLabour: estimate.totalLabour,
    totalMaterial: estimate.totalMaterial,
    totalEquipment: estimate.totalEquipment,
    totalSubcontract: estimate.totalSubcontract,
    subtotal: estimate.subtotal,
    grandTotal: estimate.grandTotal,
    notes: estimate.notes,
    lines: estimate.lines.map((line) => ({
      id: line.id,
      specLineId: line.specLineId,
      generalServiceItemId: line.generalServiceItemId,
      lineSource: line.lineSource,
      description: line.description,
      unit: line.unit,
      quantity: line.quantity,
      labourHours: line.labourHours,
      labourRate: line.labourRate,
      labourTotal: line.labourTotal,
      materialCost: line.materialCost,
      equipmentCost: line.equipmentCost,
      subcontractCost: line.subcontractCost,
      lineTotal: line.lineTotal,
      notes: line.notes,
      sortOrder: line.sortOrder,
      bucket:
        line.lineSource === "general_service"
          ? "general_service_cost"
          : line.specLineId
            ? specLineMeta.get(line.specLineId)?.bucket ?? null
            : null,
      lineCode: line.specLineId
        ? specLineMeta.get(line.specLineId)?.lineCode ?? null
        : line.generalServiceItemId
          ? generalServiceMeta.get(line.generalServiceItemId)?.lineCode ?? null
          : null,
    })),
  };
}

async function recalculateEstimateTotals(estimateId: string, marginPct?: number) {
  const estimate = await prisma.yardCostEstimate.findUnique({ where: { id: estimateId } });
  if (!estimate) return;

  const lines = await prisma.yardCostEstimateLine.findMany({ where: { estimateId } });
  const totalLabour = lines.reduce((s, l) => s + l.labourTotal, 0);
  const totalMaterial = lines.reduce((s, l) => s + l.materialCost, 0);
  const totalEquipment = lines.reduce((s, l) => s + l.equipmentCost, 0);
  const totalSubcontract = lines.reduce((s, l) => s + l.subcontractCost, 0);
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const margin = marginPct ?? estimate.marginPct;
  const grandTotal = subtotal * (1 + margin / 100);

  await prisma.yardCostEstimate.update({
    where: { id: estimateId },
    data: {
      marginPct: margin,
      totalLabour,
      totalMaterial,
      totalEquipment,
      totalSubcontract,
      subtotal,
      grandTotal,
    },
  });
}

async function syncEstimateLines(
  estimateId: string,
  inviteId: string,
  currency: string,
): Promise<YardCostEstimateView | null> {
  const ctx = await getShipyardRfqInviteContext(inviteId);
  if (!ctx) return null;

  const estimate = await prisma.yardCostEstimate.findUnique({
    where: { id: estimateId },
    include: { lines: true },
  });
  if (!estimate) return null;

  const existingSpec = new Map(
    estimate.lines.filter((l) => l.specLineId).map((l) => [l.specLineId!, l]),
  );
  const existingGeneral = new Map(
    estimate.lines.filter((l) => l.generalServiceItemId).map((l) => [l.generalServiceItemId!, l]),
  );

  for (const [i, spec] of ctx.specLines.entries()) {
    if (existingSpec.has(spec.id)) continue;
    await prisma.yardCostEstimateLine.create({
      data: {
        estimateId,
        specLineId: spec.id,
        lineSource: "spec",
        description: spec.description,
        unit: spec.unit,
        quantity: spec.defaultQty,
        sortOrder: spec.sortOrder ?? i,
      },
    });
  }

  const generalServices = await listYardGeneralServices(
    (await prisma.yardInvite.findUnique({ where: { id: inviteId }, select: { yardCompanyId: true } }))
      ?.yardCompanyId,
  );

  for (const [i, gs] of generalServices.entries()) {
    if (existingGeneral.has(gs.id)) continue;
    await prisma.yardCostEstimateLine.create({
      data: {
        estimateId,
        generalServiceItemId: gs.id,
        lineSource: "general_service",
        description: gs.description,
        unit: gs.unit,
        quantity: gs.defaultQty,
        labourHours: gs.defaultLabourHours,
        labourRate: gs.defaultLabourRate,
        materialCost: gs.defaultMaterialCost ?? 0,
        equipmentCost: gs.defaultEquipmentCost ?? 0,
        sortOrder: 1000 + i,
      },
    });
  }

  await recalculateEstimateTotals(estimateId);

  const refreshed = await loadEstimateRecord(estimateId);
  if (!refreshed) return null;

  const specMeta = new Map(
    ctx.specLines.map((s) => [s.id, { bucket: s.bucket, lineCode: s.lineCode ?? null }]),
  );
  const gsMeta = new Map(generalServices.map((g) => [g.id, { lineCode: g.lineCode }]));
  return mapEstimateView(refreshed, specMeta, gsMeta);
}

async function resolveEstimate(
  inviteId: string,
  opts: { versionNo?: number; estimateId?: string },
) {
  if (opts.estimateId) {
    return prisma.yardCostEstimate.findFirst({
      where: { id: opts.estimateId, inviteId },
      include: estimateInclude,
    });
  }

  if (opts.versionNo) {
    return prisma.yardCostEstimate.findUnique({
      where: { inviteId_versionNo: { inviteId, versionNo: opts.versionNo } },
      include: estimateInclude,
    });
  }

  return prisma.yardCostEstimate.findFirst({
    where: { inviteId },
    orderBy: { versionNo: "desc" },
    include: estimateInclude,
  });
}

async function ensureFirstEstimate(inviteId: string, currency: string) {
  const existing = await prisma.yardCostEstimate.findFirst({
    where: { inviteId },
    orderBy: { versionNo: "asc" },
  });
  if (existing) return existing;

  return prisma.yardCostEstimate.create({
    data: {
      inviteId,
      versionNo: 1,
      versionLabel: defaultVersionLabel(1),
      isSelectedForQuote: true,
      currency,
    },
  });
}

export async function listYardCostEstimateVersions(
  inviteId: string,
): Promise<YardCostEstimateVersionSummary[]> {
  const rows = await prisma.yardCostEstimate.findMany({
    where: { inviteId },
    include: { template: { select: { name: true } } },
    orderBy: { versionNo: "asc" },
  });

  return rows.map((r) => ({
    id: r.id,
    versionNo: r.versionNo,
    versionLabel: r.versionLabel ?? defaultVersionLabel(r.versionNo),
    status: r.status,
    templateId: r.templateId,
    templateName: r.template?.name ?? null,
    isSelectedForQuote: r.isSelectedForQuote,
    grandTotal: r.grandTotal,
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function getYardCostEstimateForInvite(
  inviteId: string,
  opts: { versionNo?: number; estimateId?: string } = {},
): Promise<{
  estimate: YardCostEstimateView;
  versions: YardCostEstimateVersionSummary[];
  rfq: NonNullable<Awaited<ReturnType<typeof getShipyardRfqInviteContext>>>;
} | null> {
  const ctx = await getShipyardRfqInviteContext(inviteId);
  if (!ctx) return null;

  await ensureFirstEstimate(inviteId, ctx.project.currency ?? "USD");

  let estimate = await resolveEstimate(inviteId, opts);
  if (!estimate) return null;

  const synced = await syncEstimateLines(estimate.id, inviteId, ctx.project.currency ?? "USD");
  if (!synced) return null;

  const versions = await listYardCostEstimateVersions(inviteId);
  return { estimate: synced, versions, rfq: ctx };
}

export async function createYardCostEstimateVersion(
  inviteId: string,
  input: {
    versionLabel?: string;
    templateId?: string | null;
    cloneFromEstimateId?: string | null;
    setSelected?: boolean;
  },
): Promise<YardCostEstimateView | null> {
  const ctx = await getShipyardRfqInviteContext(inviteId);
  if (!ctx) return null;

  const maxVersion = await prisma.yardCostEstimate.aggregate({
    where: { inviteId },
    _max: { versionNo: true },
  });
  const versionNo = (maxVersion._max.versionNo ?? 0) + 1;
  const versionLabel = input.versionLabel?.trim() || defaultVersionLabel(versionNo);

  let sourceLines: Awaited<ReturnType<typeof prisma.yardCostEstimateLine.findMany>> = [];
  let marginPct = 0;
  let templateId = input.templateId ?? null;

  if (input.cloneFromEstimateId) {
    const source = await prisma.yardCostEstimate.findFirst({
      where: { id: input.cloneFromEstimateId, inviteId },
      include: { lines: true },
    });
    if (source) {
      sourceLines = source.lines;
      marginPct = source.marginPct;
      templateId = source.templateId;
    }
  }

  if (input.setSelected) {
    await prisma.yardCostEstimate.updateMany({
      where: { inviteId },
      data: { isSelectedForQuote: false },
    });
  }

  const estimate = await prisma.yardCostEstimate.create({
    data: {
      inviteId,
      versionNo,
      versionLabel,
      templateId,
      marginPct,
      currency: ctx.project.currency ?? "USD",
      isSelectedForQuote: input.setSelected ?? false,
      notes: null,
    },
  });

  if (sourceLines.length > 0) {
    for (const line of sourceLines) {
      const totals = computeLineTotals(line);
      await prisma.yardCostEstimateLine.create({
        data: {
          estimateId: estimate.id,
          specLineId: line.specLineId,
          generalServiceItemId: line.generalServiceItemId,
          lineSource: line.lineSource,
          description: line.description,
          unit: line.unit,
          quantity: line.quantity,
          labourHours: line.labourHours,
          labourRate: line.labourRate,
          labourTotal: totals.labourTotal,
          materialCost: totals.materialCost,
          equipmentCost: totals.equipmentCost,
          subcontractCost: totals.subcontractCost,
          lineTotal: totals.lineTotal,
          notes: line.notes,
          sortOrder: line.sortOrder,
        },
      });
    }
  } else {
    await syncEstimateLines(estimate.id, inviteId, ctx.project.currency ?? "USD");
  }

  if (templateId) {
    await applyTemplateToEstimateLines(estimate.id, templateId);
  }

  await recalculateEstimateTotals(estimate.id, marginPct);

  const result = await getYardCostEstimateForInvite(inviteId, { estimateId: estimate.id });
  return result?.estimate ?? null;
}

export async function saveYardCostEstimate(
  inviteId: string,
  input: {
    estimateId?: string;
    marginPct?: number;
    notes?: string | null;
    status?: string;
    isSelectedForQuote?: boolean;
    lines?: YardCostEstimateLineInput[];
  },
): Promise<YardCostEstimateView | null> {
  const ctx = await getShipyardRfqInviteContext(inviteId);
  if (!ctx) return null;

  const estimate = await resolveEstimate(inviteId, { estimateId: input.estimateId });
  if (!estimate) return null;

  if (input.isSelectedForQuote) {
    await prisma.yardCostEstimate.updateMany({
      where: { inviteId },
      data: { isSelectedForQuote: false },
    });
  }

  if (input.lines) {
    for (const [i, line] of input.lines.entries()) {
      const totals = computeLineTotals(line);
      if (line.id) {
        await prisma.yardCostEstimateLine.update({
          where: { id: line.id },
          data: {
            description: line.description,
            unit: line.unit,
            quantity: line.quantity,
            labourHours: line.labourHours,
            labourRate: line.labourRate,
            labourTotal: totals.labourTotal,
            materialCost: totals.materialCost,
            equipmentCost: totals.equipmentCost,
            subcontractCost: totals.subcontractCost,
            lineTotal: totals.lineTotal,
            notes: line.notes,
            sortOrder: line.sortOrder ?? i,
          },
        });
      }
    }
  }

  await recalculateEstimateTotals(estimate.id, input.marginPct);

  await prisma.yardCostEstimate.update({
    where: { id: estimate.id },
    data: {
      notes: input.notes,
      status: input.status ?? estimate.status,
      isSelectedForQuote: input.isSelectedForQuote ?? estimate.isSelectedForQuote,
    },
  });

  if (input.status === "submitted" || (input.lines && input.lines.length > 0)) {
    await prisma.yardInvite.update({
      where: { id: inviteId },
      data: { workflowStage: "cost_estimate" },
    });
  }

  const result = await getYardCostEstimateForInvite(inviteId, { estimateId: estimate.id });
  return result?.estimate ?? null;
}

export async function applyTemplateToEstimateVersion(
  inviteId: string,
  estimateId: string,
  templateId: string,
): Promise<YardCostEstimateView | null> {
  const estimate = await prisma.yardCostEstimate.findFirst({
    where: { id: estimateId, inviteId },
  });
  if (!estimate) return null;

  await applyTemplateToEstimateLines(estimateId, templateId);
  await recalculateEstimateTotals(estimateId);

  const result = await getYardCostEstimateForInvite(inviteId, { estimateId });
  return result?.estimate ?? null;
}

export async function getSelectedEstimateForInvite(
  inviteId: string,
): Promise<YardCostEstimateView | null> {
  const selected = await prisma.yardCostEstimate.findFirst({
    where: { inviteId, isSelectedForQuote: true },
  });
  const fallback = selected ?? (await prisma.yardCostEstimate.findFirst({
    where: { inviteId },
    orderBy: { versionNo: "desc" },
  }));
  if (!fallback) return null;

  const result = await getYardCostEstimateForInvite(inviteId, { estimateId: fallback.id });
  return result?.estimate ?? null;
}
