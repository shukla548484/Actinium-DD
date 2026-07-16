import { createHash, randomInt } from "crypto";
import prisma from "@/lib/prisma";
import type { KnowledgePackStatus } from "@prisma/client";
import { canManagePurchaseClarifications } from "@/lib/procurement/clarification-notifications";
import { writeEntityVersion, writePlatformAuditEvent } from "@/lib/procurement/platform-audit";
import type { NextRequest } from "next/server";

const OTP_TTL_MS = 10 * 60 * 1000;

function hashOtp(code: string, packId: string) {
  return createHash("sha256").update(`${packId}:${code}`).digest("hex");
}

export function canManageKnowledgeLibrary(accessLevel?: number | null) {
  return canManagePurchaseClarifications(accessLevel);
}

export async function listKnowledgePacksForOffice(params: {
  status?: KnowledgePackStatus;
  partNumber?: string;
  vesselId?: string;
  vendorPublished?: boolean;
  take?: number;
}) {
  return prisma.knowledgePack.findMany({
    where: {
      ...(params.status ? { status: params.status } : {}),
      ...(params.partNumber?.trim()
        ? { primaryPartNumber: { contains: params.partNumber.trim(), mode: "insensitive" } }
        : {}),
      ...(params.vesselId ? { OR: [{ vesselId: params.vesselId }, { vesselId: null }] } : {}),
      ...(params.vendorPublished != null ? { vendorPublished: params.vendorPublished } : {}),
    },
    include: {
      vessel: { select: { id: true, name: true, code: true } },
      machinery: { select: { id: true, code: true, name: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { entityLinks: true, requisitionLinks: true } },
    },
    orderBy: [{ updatedAt: "desc" }],
    take: params.take ?? 100,
  });
}

export async function getKnowledgePackDetail(id: string) {
  return prisma.knowledgePack.findUnique({
    where: { id },
    include: {
      vessel: { select: { id: true, name: true, code: true } },
      machinery: { select: { id: true, code: true, name: true } },
      assets: true,
      facts: true,
      entityLinks: { orderBy: { createdAt: "desc" } },
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      vendorPublishedBy: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { requisitionLinks: true, promotedClarifications: true } },
    },
  });
}

export async function requestKnowledgePackPublishOtp(params: {
  packId: string;
  employeeId: string;
  request?: NextRequest;
}) {
  const pack = await prisma.knowledgePack.findUnique({ where: { id: params.packId } });
  if (!pack) throw new Error("Knowledge pack not found");
  if (pack.status !== "ACTIVE") throw new Error("Only active packs can be published to vendors");
  if (pack.vendorPublished) throw new Error("Pack is already published to vendors");

  const code = String(randomInt(100000, 999999));
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await prisma.knowledgePackApprovalChallenge.create({
    data: {
      knowledgePackId: pack.id,
      action: "VENDOR_PUBLISH",
      requestedById: params.employeeId,
      approverId: pack.approverId ?? params.employeeId,
      codeHash: hashOtp(code, pack.id),
      expiresAt,
    },
  });

  const approverId = pack.approverId ?? params.employeeId;

  await prisma.operationNotification.create({
    data: {
      title: "Knowledge pack publish verification",
      message: `Enter code ${code} to publish "${pack.title}" to vendors. Valid for 10 minutes.`,
      type: "TASK_ASSIGNED",
      operation: "KNOWLEDGE_PACK_PUBLISH_OTP",
      entityType: "KnowledgePack",
      entityId: pack.id,
      userId: approverId,
      isRead: false,
      metadata: {
        actionUrl: `/purchase/knowledge-library/${pack.id}`,
        packId: pack.id,
      },
    },
  });

  await writePlatformAuditEvent(
    {
      actorEmployeeId: params.employeeId,
      module: "Purchase",
      entityType: "KnowledgePack",
      entityId: pack.id,
      action: "PUBLISH_OTP_REQUESTED",
    },
    params.request
  );

  return { expiresAt, approverId };
}

export async function confirmKnowledgePackPublishOtp(params: {
  packId: string;
  employeeId: string;
  code: string;
  request?: NextRequest;
}) {
  const pack = await prisma.knowledgePack.findUnique({ where: { id: params.packId } });
  if (!pack) throw new Error("Knowledge pack not found");

  const challenge = await prisma.knowledgePackApprovalChallenge.findFirst({
    where: {
      knowledgePackId: pack.id,
      action: "VENDOR_PUBLISH",
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!challenge) throw new Error("No active verification code. Request a new one.");
  if (hashOtp(params.code.trim(), pack.id) !== challenge.codeHash) {
    throw new Error("Invalid verification code");
  }

  const updated = await prisma.knowledgePack.update({
    where: { id: pack.id },
    data: {
      vendorPublished: true,
      vendorPublishedAt: new Date(),
      vendorPublishedById: params.employeeId,
      approverId: params.employeeId,
    },
    include: {
      vessel: true,
      machinery: true,
      assets: true,
      facts: true,
    },
  });

  await prisma.knowledgePackApprovalChallenge.update({
    where: { id: challenge.id },
    data: { usedAt: new Date() },
  });

  await writeEntityVersion({
    entityType: "KnowledgePack",
    entityId: pack.id,
    versionNumber: updated.versionNumber,
    changeSummary: "Published to vendors (OTP verified)",
    changedById: params.employeeId,
    snapshot: updated,
  });

  await writePlatformAuditEvent(
    {
      actorEmployeeId: params.employeeId,
      module: "Purchase",
      entityType: "KnowledgePack",
      entityId: pack.id,
      action: "VENDOR_PUBLISHED",
    },
    params.request
  );

  return updated;
}

export async function archiveKnowledgePack(params: {
  packId: string;
  employeeId: string;
  request?: NextRequest;
}) {
  const pack = await prisma.knowledgePack.findUnique({ where: { id: params.packId } });
  if (!pack) throw new Error("Knowledge pack not found");

  const updated = await prisma.knowledgePack.update({
    where: { id: pack.id },
    data: { status: "ARCHIVED", vendorPublished: false },
  });

  await writePlatformAuditEvent(
    {
      actorEmployeeId: params.employeeId,
      module: "Purchase",
      entityType: "KnowledgePack",
      entityId: pack.id,
      action: "ARCHIVED",
    },
    params.request
  );

  return updated;
}

export async function getKnowledgeLibraryStats() {
  const [total, active, vendorPublished, promotedFromClarifications, openClarifications] =
    await Promise.all([
      prisma.knowledgePack.count(),
      prisma.knowledgePack.count({ where: { status: "ACTIVE" } }),
      prisma.knowledgePack.count({ where: { vendorPublished: true } }),
      prisma.rfqClarificationRequest.count({ where: { promotedKnowledgePackId: { not: null } } }),
      prisma.rfqClarificationRequest.count({ where: { status: "OPEN" } }),
    ]);

  return { total, active, vendorPublished, promotedFromClarifications, openClarifications };
}
