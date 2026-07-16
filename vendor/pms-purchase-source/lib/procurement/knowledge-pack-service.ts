import prisma from "@/lib/prisma";
import type { KnowledgeFactConfidence, KnowledgePackStatus } from "@prisma/client";
import {
  computeKnowledgePackQualityScore,
  slugifyKnowledgePackTitle,
} from "@/lib/procurement/knowledge-pack-quality";
import { writeEntityVersion, writePlatformAuditEvent } from "@/lib/procurement/platform-audit";
import { getClarificationById } from "@/lib/procurement/rfq-clarification-service";
import {
  getRequisitionItemMachineryId,
  resolveMachineryMetadata,
} from "@/lib/procurement/requisition-machinery";
import { autoLinkKnowledgePackFromClarification } from "@/lib/procurement/knowledge-pack-entity-links";
import type { NextRequest } from "next/server";

const packInclude = {
  assets: true,
  facts: true,
  vessel: { select: { id: true, name: true, code: true } },
  machinery: { select: { id: true, code: true, name: true, make: true, model: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true } },
} as const;

export async function matchKnowledgePacks(params: {
  partNumber?: string | null;
  drawingNumber?: string | null;
  itemNumber?: string | null;
  /** Machinery (model/type) id — same as SPR requisition-level machinery, not MachineryInstance. */
  machineryId?: string | null;
  impaNumber?: string | null;
  vesselId?: string | null;
  companyId?: string | null;
  status?: KnowledgePackStatus;
}) {
  const part = params.partNumber?.trim();
  if (!part) return [];

  const where: Record<string, unknown> = {
    status: params.status ?? "ACTIVE",
    primaryPartNumber: { equals: part, mode: "insensitive" },
  };

  if (params.drawingNumber?.trim()) {
    where.drawingNumber = { equals: params.drawingNumber.trim(), mode: "insensitive" };
  }
  if (params.itemNumber?.trim()) {
    where.itemNumber = { equals: params.itemNumber.trim(), mode: "insensitive" };
  }
  if (params.impaNumber?.trim()) {
    where.impaNumber = params.impaNumber.trim();
  }
  if (params.companyId) {
    where.companyId = params.companyId;
  }

  const scopeFilters: Record<string, unknown>[] = [];
  if (params.machineryId) {
    scopeFilters.push({
      OR: [{ machineryId: params.machineryId }, { machineryId: null }],
    });
  }
  if (params.vesselId) {
    scopeFilters.push({
      OR: [{ vesselId: params.vesselId }, { vesselId: null }],
    });
  }
  if (scopeFilters.length) {
    where.AND = scopeFilters;
  }

  return prisma.knowledgePack.findMany({
    where: where as any,
    include: packInclude,
    orderBy: [{ useCount: "desc" }, { updatedAt: "desc" }],
    take: 10,
  });
}

/** Warn before creating/promoting when similar ACTIVE packs already exist. */
export async function findSimilarKnowledgePacks(params: {
  partNumber?: string | null;
  drawingNumber?: string | null;
  machineryId?: string | null;
  companyId?: string | null;
  excludePackId?: string | null;
}) {
  const part = params.partNumber?.trim();
  if (!part) return [];

  const where: Record<string, unknown> = {
    status: "ACTIVE",
    primaryPartNumber: { equals: part, mode: "insensitive" },
    ...(params.excludePackId ? { id: { not: params.excludePackId } } : {}),
    ...(params.companyId ? { companyId: params.companyId } : {}),
  };

  if (params.drawingNumber?.trim()) {
    where.drawingNumber = { equals: params.drawingNumber.trim(), mode: "insensitive" };
  }

  if (params.machineryId) {
    where.OR = [{ machineryId: params.machineryId }, { machineryId: null }];
  }

  return prisma.knowledgePack.findMany({
    where: where as any,
    include: {
      machinery: { select: { code: true, name: true } },
    },
    orderBy: [{ qualityScorePercent: "desc" }, { updatedAt: "desc" }],
    take: 5,
  });
}

export async function previewPromoteClarificationDuplicates(clarificationId: string) {
  const clarification = await getClarificationById(clarificationId);
  if (!clarification) return { clarification: null, similarPacks: [] as Awaited<ReturnType<typeof findSimilarKnowledgePacks>> };

  const item = clarification.requisitionItem;
  const machineryId = getRequisitionItemMachineryId(item);
  const similarPacks = item?.partNumber
    ? await findSimilarKnowledgePacks({
        partNumber: item.partNumber,
        drawingNumber: item.drawingNumber,
        machineryId,
        companyId: clarification.requisition.vessel.companyId ?? undefined,
        excludePackId: clarification.promotedKnowledgePackId,
      })
    : [];

  return { clarification, similarPacks };
}

export async function getKnowledgePackById(id: string) {
  return prisma.knowledgePack.findUnique({
    where: { id },
    include: packInclude,
  });
}

export async function getKnowledgePackBySlug(slug: string) {
  return prisma.knowledgePack.findFirst({
    where: { slug, vendorPublished: true, status: "ACTIVE" },
    include: {
      assets: { where: { isVendorVisible: true } },
      facts: true,
    },
  });
}

export async function linkKnowledgePackToRequisitionItem(params: {
  requisitionItemId: string;
  knowledgePackId: string;
  employeeId: string;
  includeInVendorPack?: boolean;
  request?: NextRequest;
}) {
  const [item, pack] = await Promise.all([
    prisma.requisitionItem.findUnique({
      where: { id: params.requisitionItemId },
      include: { requisition: { select: { vesselId: true, companyId: true } } },
    }),
    prisma.knowledgePack.findUnique({ where: { id: params.knowledgePackId } }),
  ]);

  if (!item || !pack) throw new Error("Item or knowledge pack not found");

  const link = await prisma.requisitionItemKnowledgeLink.upsert({
    where: {
      requisitionItemId_knowledgePackId: {
        requisitionItemId: params.requisitionItemId,
        knowledgePackId: params.knowledgePackId,
      },
    },
    create: {
      requisitionItemId: params.requisitionItemId,
      knowledgePackId: params.knowledgePackId,
      knowledgePackVersion: pack.versionNumber,
      includeInVendorPack: params.includeInVendorPack ?? true,
      attachedById: params.employeeId,
    },
    update: {
      knowledgePackVersion: pack.versionNumber,
      includeInVendorPack: params.includeInVendorPack ?? true,
      attachedById: params.employeeId,
      attachedAt: new Date(),
    },
  });

  await prisma.knowledgePack.update({
    where: { id: pack.id },
    data: { useCount: { increment: 1 }, lastUsedAt: new Date() },
  });

  await writePlatformAuditEvent(
    {
      actorEmployeeId: params.employeeId,
      vesselId: item.requisition.vesselId,
      module: "Purchase",
      entityType: "KnowledgePack",
      entityId: pack.id,
      action: "LINKED_TO_REQUISITION_ITEM",
      newValue: { requisitionItemId: params.requisitionItemId },
    },
    params.request
  );

  return link;
}

export async function promoteClarificationToKnowledgePack(params: {
  clarificationId: string;
  employeeId: string;
  title?: string;
  request?: NextRequest;
}) {
  const clarification = await getClarificationById(params.clarificationId);
  if (!clarification) throw new Error("Clarification not found");
  if (clarification.status !== "ANSWERED" && clarification.status !== "CLOSED") {
    throw new Error("Only answered clarifications can be promoted");
  }

  const item = clarification.requisitionItem;
  const partNumber = item?.partNumber || item?.itemName || "unknown-part";
  const machineryId = getRequisitionItemMachineryId(item);
  const machineryMeta = await resolveMachineryMetadata(machineryId);
  const title =
    params.title?.trim() ||
    `${partNumber}${item?.itemName ? ` — ${item.itemName}` : ""}`.slice(0, 120);

  const existing = item?.partNumber
    ? await prisma.knowledgePack.findFirst({
        where: {
          primaryPartNumber: { equals: item.partNumber, mode: "insensitive" },
          status: "ACTIVE",
          ...(machineryMeta.machineryId
            ? {
                OR: [{ machineryId: machineryMeta.machineryId }, { machineryId: null }],
              }
            : {}),
          ...(clarification.requisition.vessel.companyId
            ? { companyId: clarification.requisition.vessel.companyId }
            : {}),
        },
        include: { assets: true, facts: true },
      })
    : null;

  let packId: string;

  if (existing) {
    const responseAssets = clarification.attachments.filter(
      (a) => a.role === "VESSEL_RESPONSE" && a.fileUrl
    );
    for (const asset of responseAssets) {
      await prisma.knowledgePackAsset.create({
        data: {
          knowledgePackId: existing.id,
          assetType: "QA_THREAD",
          fileName: asset.fileName,
          mimeType: asset.mimeType,
          fileSize: asset.fileSize,
          fileUrl: asset.fileUrl,
          sourceType: "CLARIFICATION",
          sourceEntityId: clarification.id,
          isVendorVisible: true,
          approvedById: params.employeeId,
          approvedAt: new Date(),
        },
      });
    }

    if (clarification.responseText) {
      await prisma.knowledgePackFact.create({
        data: {
          knowledgePackId: existing.id,
          category: "CLARIFICATION",
          label: clarification.requestType.replace(/_/g, " "),
          value: clarification.responseText,
          confidence: "CHIEF_ENGINEER",
          sourceClarificationId: clarification.id,
          confirmedById: params.employeeId,
          confirmedAt: new Date(),
        },
      });
    }

    const quality = computeKnowledgePackQualityScore({
      assets: [...existing.assets, ...responseAssets.map(() => ({ assetType: "QA_THREAD" as const }))],
      facts: [...existing.facts, ...(clarification.responseText ? [{ label: "Q&A", value: "x" }] : [])],
      hasDrawingNumber: !!existing.drawingNumber,
      hasPartNumber: !!existing.primaryPartNumber,
      hasSummary: !!existing.summaryText,
    });

    const nextVersion = existing.versionNumber + 1;
    const updated = await prisma.knowledgePack.update({
      where: { id: existing.id },
      data: {
        versionNumber: nextVersion,
        qualityScorePercent: quality.scorePercent,
        summaryText: existing.summaryText || clarification.responseText?.slice(0, 500),
      },
      include: packInclude,
    });

    await writeEntityVersion({
      entityType: "KnowledgePack",
      entityId: existing.id,
      versionNumber: nextVersion,
      changeSummary: "Promoted RFQ clarification",
      changedById: params.employeeId,
      snapshot: updated,
    });

    packId = existing.id;
  } else {
    const slug = slugifyKnowledgePackTitle(title, item?.partNumber);
    const created = await prisma.knowledgePack.create({
      data: {
        companyId: clarification.requisition.vessel.companyId,
        vesselId: clarification.requisition.vesselId,
        title,
        slug,
        status: "ACTIVE",
        primaryPartNumber: item?.partNumber ?? null,
        partName: item?.partName ?? item?.itemName ?? null,
        drawingNumber: item?.drawingNumber ?? null,
        itemNumber: item?.itemNumber ?? null,
        machineryId: machineryMeta.machineryId,
        machineryModelCode: machineryMeta.machineryModelCode,
        summaryText: clarification.responseText?.slice(0, 500) ?? null,
        createdById: params.employeeId,
        approverId: params.employeeId,
        facts: clarification.responseText
          ? {
              create: {
                category: "CLARIFICATION",
                label: clarification.requestType.replace(/_/g, " "),
                value: clarification.responseText,
                confidence: "CHIEF_ENGINEER",
                sourceClarificationId: clarification.id,
                confirmedById: params.employeeId,
                confirmedAt: new Date(),
              },
            }
          : undefined,
      },
      include: packInclude,
    });

    for (const asset of clarification.attachments.filter((a) => a.role === "VESSEL_RESPONSE")) {
      if (!asset.fileUrl) continue;
      await prisma.knowledgePackAsset.create({
        data: {
          knowledgePackId: created.id,
          assetType: "QA_THREAD",
          fileName: asset.fileName,
          mimeType: asset.mimeType,
          fileSize: asset.fileSize,
          fileUrl: asset.fileUrl,
          sourceType: "CLARIFICATION",
          sourceEntityId: clarification.id,
          isVendorVisible: true,
          approvedById: params.employeeId,
          approvedAt: new Date(),
        },
      });
    }

    const quality = computeKnowledgePackQualityScore({
      assets: created.assets,
      facts: created.facts,
      hasDrawingNumber: !!created.drawingNumber,
      hasPartNumber: !!created.primaryPartNumber,
      hasSummary: !!created.summaryText,
    });

    await prisma.knowledgePack.update({
      where: { id: created.id },
      data: { qualityScorePercent: quality.scorePercent },
    });

    packId = created.id;
  }

  await prisma.rfqClarificationRequest.update({
    where: { id: clarification.id },
    data: { promotedKnowledgePackId: packId },
  });

  await autoLinkKnowledgePackFromClarification({
    packId,
    clarificationId: clarification.id,
    requisitionId: clarification.requisitionId,
    requisitionItemId: clarification.requisitionItemId,
    machineryId,
    vendorId: clarification.vendorId,
    partNumber: item?.partNumber,
    employeeId: params.employeeId,
    request: params.request,
  });

  if (clarification.requisitionItemId) {
    await linkKnowledgePackToRequisitionItem({
      requisitionItemId: clarification.requisitionItemId,
      knowledgePackId: packId,
      employeeId: params.employeeId,
      includeInVendorPack: true,
      request: params.request,
    });
  }

  await writePlatformAuditEvent(
    {
      actorEmployeeId: params.employeeId,
      vesselId: clarification.vesselId,
      module: "Purchase",
      entityType: "KnowledgePack",
      entityId: packId,
      action: "PROMOTED_FROM_CLARIFICATION",
      metadata: { clarificationId: clarification.id },
    },
    params.request
  );

  return getKnowledgePackById(packId);
}

export async function getVendorKnowledgeUrlForItem(requisitionItemId: string) {
  try {
    const links = await prisma.requisitionItemKnowledgeLink.findMany({
      where: { requisitionItemId, includeInVendorPack: true },
      include: {
        knowledgePack: {
          select: {
            id: true,
            slug: true,
            title: true,
            status: true,
            versionNumber: true,
            vendorPublished: true,
          },
        },
      },
    });
    return links
      .filter((l) => l.knowledgePack.status === "ACTIVE" && l.knowledgePack.vendorPublished)
      .map((l) => ({
        packId: l.knowledgePack.id,
        title: l.knowledgePack.title,
        version: l.knowledgePackVersion,
        url: `/vendor/knowledge/${l.knowledgePack.slug}`,
      }));
  } catch (error) {
    // Knowledge-pack tables/columns may not be migrated yet — quote flow must still work.
    console.warn("[getVendorKnowledgeUrlForItem] skipped:", error);
    return [];
  }
}
