import prisma from "@/lib/prisma";
import type { NextRequest } from "next/server";

export type PlatformAuditInput = {
  actorEmployeeId?: string | null;
  actorVendorId?: string | null;
  actorRole?: string | null;
  vesselId?: string | null;
  companyId?: string | null;
  module: string;
  screen?: string | null;
  entityType: string;
  entityId?: string | null;
  action: string;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string | null;
  remarks?: string | null;
  metadata?: Record<string, unknown>;
  syncTransactionId?: string | null;
  syncSource?: string | null;
};

export function auditContextFromRequest(request: NextRequest) {
  return {
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null,
    userAgent: request.headers.get("user-agent"),
    sessionId: request.cookies.get("session")?.value || null,
  };
}

export async function writePlatformAuditEvent(
  input: PlatformAuditInput,
  request?: NextRequest
) {
  const ctx = request ? auditContextFromRequest(request) : {};
  try {
    await prisma.platformAuditEvent.create({
      data: {
        actorEmployeeId: input.actorEmployeeId ?? null,
        actorVendorId: input.actorVendorId ?? null,
        actorRole: input.actorRole ?? null,
        vesselId: input.vesselId ?? null,
        companyId: input.companyId ?? null,
        module: input.module,
        screen: input.screen ?? null,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        action: input.action,
        oldValue: input.oldValue as object | undefined,
        newValue: input.newValue as object | undefined,
        ipAddress: ctx.ipAddress ?? null,
        userAgent: ctx.userAgent ?? null,
        sessionId: ctx.sessionId ?? null,
        syncTransactionId: input.syncTransactionId ?? null,
        syncSource: input.syncSource ?? null,
        reason: input.reason ?? null,
        remarks: input.remarks ?? null,
        metadata: input.metadata as object | undefined,
      },
    });
  } catch (error) {
    console.error("[platform-audit] Failed to write audit event:", error);
  }
}

export async function writeEntityVersion(params: {
  entityType: string;
  entityId: string;
  versionNumber: number;
  changeSummary?: string;
  changedById?: string | null;
  snapshot: unknown;
}) {
  try {
    await prisma.entityVersion.create({
      data: {
        entityType: params.entityType,
        entityId: params.entityId,
        versionNumber: params.versionNumber,
        changeSummary: params.changeSummary ?? null,
        changedById: params.changedById ?? null,
        snapshot: params.snapshot as object,
      },
    });
  } catch (error) {
    console.error("[entity-version] Failed to write version:", error);
  }
}

export async function listEntityAuditTimeline(entityType: string, entityId: string) {
  const [events, versions] = await Promise.all([
    prisma.platformAuditEvent.findMany({
      where: { entityType, entityId },
      orderBy: { occurredAt: "desc" },
      take: 100,
      include: {
        actorEmployee: {
          select: { id: true, firstName: true, lastName: true, designation: true },
        },
      },
    }),
    prisma.entityVersion.findMany({
      where: { entityType, entityId },
      orderBy: { versionNumber: "desc" },
      take: 20,
      include: {
        changedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    }),
  ]);
  return { events, versions };
}
