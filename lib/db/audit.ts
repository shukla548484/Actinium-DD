import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionPayload, getSessionUserId } from "@/lib/auth/session";

export type AuditLogInput = {
  action: string;
  entityType: string;
  entityId?: string | null;
  summary?: string | null;
  metadata?: Record<string, unknown> | null;
  userId?: string | null;
  userLabel?: string | null;
};

export async function writeAuditLog(input: AuditLogInput) {
  let userId = input.userId ?? null;
  let userLabel = input.userLabel ?? null;

  if (!userId) {
    userId = await getSessionUserId();
  }
  if (!userLabel && userId) {
    const payload = await getSessionPayload();
    userLabel = payload?.loginId ?? userId;
  }

  return prisma.auditLog.create({
    data: {
      userId,
      userLabel,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      summary: input.summary ?? null,
      metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

export async function listAuditLogs(query: {
  page?: number;
  limit?: number;
  entityType?: string;
  userId?: string;
}) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 30));
  const skip = (page - 1) * limit;

  const where = {
    ...(query.entityType ? { entityType: query.entityType } : {}),
    ...(query.userId ? { userId: query.userId } : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    items: rows.map((r) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
