import prisma from "@/lib/prisma";
import type { KnowledgePackEntityType, KnowledgePackLinkRole } from "@prisma/client";
import { writePlatformAuditEvent } from "@/lib/procurement/platform-audit";
import type { NextRequest } from "next/server";

export const ENTITY_ROUTE: Record<KnowledgePackEntityType, (id: string) => string> = {
  Machinery: (id) => `/technical/machinery/${id}`,
  SparePart: (id) => `/technical/spare-parts?highlight=${id}`,
  Job: (id) => `/technical/maintenance/jobs/${id}`,
  Defect: (id) => `/technical/defects/${id}`,
  Requisition: (id) => `/purchase/requisitions/${id}/view`,
  RequisitionItem: (id) => `#item-${id}`,
  RfqClarification: (id) => `#clarification-${id}`,
  Vendor: (id) => `/purchase/vendor-management/view/${id}`,
};

export async function linkKnowledgePackEntity(params: {
  knowledgePackId: string;
  entityType: KnowledgePackEntityType;
  entityId: string;
  linkRole?: KnowledgePackLinkRole;
  label?: string | null;
  employeeId?: string | null;
  request?: NextRequest;
}) {
  const link = await prisma.knowledgePackEntityLink.upsert({
    where: {
      knowledgePackId_entityType_entityId: {
        knowledgePackId: params.knowledgePackId,
        entityType: params.entityType,
        entityId: params.entityId,
      },
    },
    create: {
      knowledgePackId: params.knowledgePackId,
      entityType: params.entityType,
      entityId: params.entityId,
      linkRole: params.linkRole ?? "RELATED",
      label: params.label ?? null,
      createdById: params.employeeId ?? null,
    },
    update: {
      linkRole: params.linkRole ?? undefined,
      label: params.label ?? undefined,
    },
  });

  await writePlatformAuditEvent(
    {
      actorEmployeeId: params.employeeId,
      module: "Purchase",
      entityType: "KnowledgePack",
      entityId: params.knowledgePackId,
      action: "ENTITY_LINKED",
      newValue: { entityType: params.entityType, entityId: params.entityId },
    },
    params.request
  );

  return link;
}

export async function listKnowledgePackEntityLinks(knowledgePackId: string) {
  const links = await prisma.knowledgePackEntityLink.findMany({
    where: { knowledgePackId },
    orderBy: { createdAt: "desc" },
  });

  return links.map((link) => ({
    ...link,
    href: ENTITY_ROUTE[link.entityType]?.(link.entityId) ?? null,
  }));
}

export async function listKnowledgePacksForEntity(entityType: KnowledgePackEntityType, entityId: string) {
  return prisma.knowledgePackEntityLink.findMany({
    where: { entityType, entityId },
    include: {
      knowledgePack: {
        select: {
          id: true,
          title: true,
          slug: true,
          status: true,
          qualityScorePercent: true,
          primaryPartNumber: true,
          vendorPublished: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

/** Auto-link digital twin nodes when a pack is created from a clarification. */
export async function autoLinkKnowledgePackFromClarification(params: {
  packId: string;
  clarificationId: string;
  requisitionId: string;
  requisitionItemId?: string | null;
  machineryId?: string | null;
  vendorId?: string | null;
  partNumber?: string | null;
  employeeId?: string | null;
  request?: NextRequest;
}) {
  const tasks: Array<Promise<unknown>> = [
    linkKnowledgePackEntity({
      knowledgePackId: params.packId,
      entityType: "RfqClarification",
      entityId: params.clarificationId,
      linkRole: "SOURCE",
      label: "Source clarification",
      employeeId: params.employeeId,
      request: params.request,
    }),
    linkKnowledgePackEntity({
      knowledgePackId: params.packId,
      entityType: "Requisition",
      entityId: params.requisitionId,
      linkRole: "RELATED",
      employeeId: params.employeeId,
      request: params.request,
    }),
  ];

  if (params.requisitionItemId) {
    tasks.push(
      linkKnowledgePackEntity({
        knowledgePackId: params.packId,
        entityType: "RequisitionItem",
        entityId: params.requisitionItemId,
        linkRole: "PRIMARY",
        employeeId: params.employeeId,
        request: params.request,
      })
    );
  }

  if (params.machineryId) {
    tasks.push(
      linkKnowledgePackEntity({
        knowledgePackId: params.packId,
        entityType: "Machinery",
        entityId: params.machineryId,
        linkRole: "PRIMARY",
        employeeId: params.employeeId,
        request: params.request,
      })
    );
  }

  if (params.vendorId) {
    tasks.push(
      linkKnowledgePackEntity({
        knowledgePackId: params.packId,
        entityType: "Vendor",
        entityId: params.vendorId,
        linkRole: "RELATED",
        employeeId: params.employeeId,
        request: params.request,
      })
    );
  }

  if (params.partNumber?.trim() && params.machineryId) {
    const spare = await prisma.sparePart.findFirst({
      where: {
        sparePartNumber: { equals: params.partNumber.trim(), mode: "insensitive" },
        machineryId: params.machineryId,
      },
      select: { id: true, sparePartNumber: true, name: true },
    });
    if (spare) {
      tasks.push(
        linkKnowledgePackEntity({
          knowledgePackId: params.packId,
          entityType: "SparePart",
          entityId: spare.id,
          linkRole: "PRIMARY",
          label: spare.name ?? spare.sparePartNumber,
          employeeId: params.employeeId,
          request: params.request,
        })
      );
    }
  }

  await Promise.all(tasks);
}

export async function resolveEntityLinkLabels(
  links: Array<{ entityType: KnowledgePackEntityType; entityId: string; label: string | null }>
) {
  const resolved = await Promise.all(
    links.map(async (link) => {
      if (link.label) return { ...link, displayName: link.label };

      switch (link.entityType) {
        case "Machinery": {
          const row = await prisma.machinery.findUnique({
            where: { id: link.entityId },
            select: { code: true, name: true },
          });
          return { ...link, displayName: row ? `${row.code} — ${row.name}` : link.entityId };
        }
        case "SparePart": {
          const row = await prisma.sparePart.findUnique({
            where: { id: link.entityId },
            select: { sparePartNumber: true, name: true },
          });
          return { ...link, displayName: row?.name || row?.sparePartNumber || link.entityId };
        }
        case "Requisition": {
          const row = await prisma.requisition.findUnique({
            where: { id: link.entityId },
            select: { requisitionNumber: true, heading: true },
          });
          return { ...link, displayName: row?.requisitionNumber || link.entityId };
        }
        case "RfqClarification": {
          return { ...link, displayName: "RFQ clarification" };
        }
        case "Vendor": {
          const row = await prisma.vendor.findUnique({
            where: { id: link.entityId },
            select: { name: true },
          });
          return { ...link, displayName: row?.name || link.entityId };
        }
        default:
          return { ...link, displayName: link.entityId };
      }
    })
  );

  return resolved.map((link) => ({
    ...link,
    href: ENTITY_ROUTE[link.entityType]?.(link.entityId) ?? null,
  }));
}
