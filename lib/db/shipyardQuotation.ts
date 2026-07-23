import { randomBytes } from "node:crypto";
import type {
  ShipyardDockCycle,
  ShipyardQuotationInviteStatus,
  ShipyardQuotationRequestStatus,
  ShipyardQuoteJobCategory,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/superintendent/helpers";
import { mapJobToQuoteCategory } from "@/lib/shipyard/quotationCategories";
import { DEFAULT_SHIPYARD_TARIFF_RATES } from "@/lib/shipyard/tariffDefaults";
import { buildShipyardQuotationMailto } from "@/lib/shipyard/quotationMailto";

function newToken(): string {
  return randomBytes(24).toString("hex");
}

async function nextReferenceCode(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `SQR-${year}-`;
  const latest = await prisma.shipyardQuotationRequest.findFirst({
    where: { referenceCode: { startsWith: prefix } },
    orderBy: { referenceCode: "desc" },
    select: { referenceCode: true },
  });
  let seq = 1;
  if (latest?.referenceCode) {
    const n = Number.parseInt(latest.referenceCode.slice(prefix.length), 10);
    if (Number.isFinite(n)) seq = n + 1;
  }
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

export type QuotationLineInput = {
  requestJobId: string;
  quantity?: number;
  unit?: string;
  unitRate?: number | null;
  notes?: string | null;
};

export type CreateQuotationShareInput = {
  vesselId: string;
  jobIds: string[];
  yardCompanyId: string;
  dryDockProjectId?: string | null;
  dockCycle?: ShipyardDockCycle;
  plannedStart?: Date | null;
  plannedEnd?: Date | null;
  dryDockDays?: number | null;
  shipyardDays?: number | null;
  cprDays?: number | null;
  dueAt?: Date | null;
  notes?: string | null;
  requestedByName?: string | null;
  currency?: string;
};

const requestInclude = {
  vessel: {
    select: {
      id: true,
      name: true,
      code: true,
      imoNumber: true,
      flag: true,
      vesselType: true,
      callSign: true,
      grossTonnage: true,
      yearBuilt: true,
      classSociety: true,
      nextDryDockDue: true,
      lastDryDockDate: true,
    },
  },
  dryDockProject: {
    select: {
      id: true,
      name: true,
      referenceCode: true,
      projectType: true,
      status: true,
      plannedStart: true,
      plannedEnd: true,
      expectedSailing: true,
      dryDockDays: true,
      surveyType: true,
      dockType: true,
      portLocation: true,
      selectedYard: true,
      milestones: {
        where: { deletedAt: null },
        orderBy: { sortOrder: "asc" as const },
        select: {
          id: true,
          title: true,
          plannedDate: true,
          actualDate: true,
          status: true,
        },
      },
    },
  },
  jobs: {
    orderBy: [{ quoteCategory: "asc" as const }, { sortOrder: "asc" as const }],
    include: { quoteLine: true },
  },
  invites: {
    where: { deletedAt: null },
    include: {
      yardCompany: {
        select: {
          id: true,
          name: true,
          code: true,
          contactEmail: true,
          contactPerson: true,
        },
      },
    },
  },
  terms: true,
  tariffSnapshot: true,
} satisfies Prisma.ShipyardQuotationRequestInclude;

export type QuotationRequestDetail = Prisma.ShipyardQuotationRequestGetPayload<{
  include: typeof requestInclude;
}>;

export async function listShipyardCompanies() {
  return prisma.company.findMany({
    where: { ...notDeleted, category: "shipyard", status: "active" },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      code: true,
      contactEmail: true,
      contactPerson: true,
    },
  });
}

export async function ensureDefaultTariffSchedule(yardCompanyId: string) {
  const existing = await prisma.shipyardTariffSchedule.findFirst({
    where: { yardCompanyId, ...notDeleted, isDefault: true },
    include: { rates: { orderBy: [{ groupKey: "asc" }, { sortOrder: "asc" }] } },
  });
  if (existing) return existing;

  return prisma.shipyardTariffSchedule.create({
    data: {
      yardCompanyId,
      name: "Standard yard tariff",
      currency: "USD",
      isDefault: true,
      rates: {
        create: DEFAULT_SHIPYARD_TARIFF_RATES.map((r) => ({
          groupKey: r.groupKey,
          label: r.label,
          unit: r.unit,
          unitRate: r.unitRate,
          notes: r.notes ?? null,
          sortOrder: r.sortOrder,
        })),
      },
    },
    include: { rates: { orderBy: [{ groupKey: "asc" }, { sortOrder: "asc" }] } },
  });
}

export async function createQuotationShareFromVesselJobs(input: CreateQuotationShareInput) {
  const uniqueJobIds = [...new Set(input.jobIds.map((id) => id.trim()).filter(Boolean))];
  if (uniqueJobIds.length === 0) {
    return { ok: false as const, error: "Select at least one job", status: 400 as const };
  }

  const yard = await prisma.company.findFirst({
    where: { id: input.yardCompanyId, ...notDeleted, category: "shipyard" },
    select: {
      id: true,
      name: true,
      code: true,
      contactEmail: true,
      contactPerson: true,
    },
  });
  if (!yard) {
    return { ok: false as const, error: "Shipyard company not found", status: 404 as const };
  }

  const jobs = await prisma.ddVesselJob.findMany({
    where: {
      id: { in: uniqueJobIds },
      vesselId: input.vesselId,
      ...notDeleted,
      archivedAt: null,
    },
    include: { vessel: { select: { name: true, code: true } } },
  });

  if (jobs.length === 0) {
    return { ok: false as const, error: "No movable jobs found for this vessel", status: 400 as const };
  }

  const blocked = jobs.filter(
    (j) => j.status === "integrated" || j.status === "rejected" || j.integratedDryDockProjectId,
  );
  if (blocked.length > 0) {
    return {
      ok: false as const,
      error: `${blocked.length} job(s) cannot be shared (integrated or rejected)`,
      status: 400 as const,
    };
  }

  let projectFields: Partial<{
    dryDockProjectId: string;
    plannedStart: Date | null;
    plannedEnd: Date | null;
    dryDockDays: number | null;
  }> = {};

  if (input.dryDockProjectId) {
    const project = await prisma.dryDockProject.findFirst({
      where: { id: input.dryDockProjectId, vesselId: input.vesselId, ...notDeleted },
      select: {
        id: true,
        plannedStart: true,
        plannedEnd: true,
        dryDockDays: true,
      },
    });
    if (!project) {
      return { ok: false as const, error: "Dry dock project not found for vessel", status: 404 as const };
    }
    projectFields = {
      dryDockProjectId: project.id,
      plannedStart: input.plannedStart ?? project.plannedStart,
      plannedEnd: input.plannedEnd ?? project.plannedEnd,
      dryDockDays: input.dryDockDays ?? project.dryDockDays,
    };
  }

  const referenceCode = await nextReferenceCode();
  const token = newToken();

  const created = await prisma.$transaction(async (tx) => {
    const request = await tx.shipyardQuotationRequest.create({
      data: {
        referenceCode,
        vesselId: input.vesselId,
        dryDockProjectId: projectFields.dryDockProjectId ?? input.dryDockProjectId ?? null,
        status: "sent",
        dockCycle: input.dockCycle ?? "other",
        plannedStart: projectFields.plannedStart ?? input.plannedStart ?? null,
        plannedEnd: projectFields.plannedEnd ?? input.plannedEnd ?? null,
        dryDockDays: projectFields.dryDockDays ?? input.dryDockDays ?? null,
        shipyardDays: input.shipyardDays ?? null,
        cprDays: input.cprDays ?? null,
        dueAt: input.dueAt ?? null,
        sentAt: new Date(),
        notes: input.notes?.trim() || null,
        requestedByName: input.requestedByName?.trim() || null,
        currency: input.currency ?? "USD",
        jobs: {
          create: jobs.map((job, index) => ({
            ddVesselJobId: job.id,
            quoteCategory: mapJobToQuoteCategory({
              category: job.category,
              workshop: job.workshop,
              title: job.title,
            }),
            sortOrder: index,
            jobCode: job.jobCode,
            title: job.title,
            category: job.category,
            workshop: job.workshop,
            description: job.description,
            priority: job.priority,
          })),
        },
        invites: {
          create: {
            yardCompanyId: yard.id,
            token,
            status: "invited",
            contactEmail: yard.contactEmail,
            contactName: yard.contactPerson,
          },
        },
        terms: { create: { body: "" } },
      },
      include: requestInclude,
    });

    // Mark source jobs export-ready with assignment numbers when missing.
    for (const job of jobs) {
      if (!job.jobCode || !job.exportAssignedAt) {
        const code =
          job.jobCode?.trim() ||
          (await nextJobAssignmentNumberTx(tx, job.vesselId, jobs[0]!.vessel.code));
        await tx.ddVesselJob.update({
          where: { id: job.id },
          data: {
            jobCode: code,
            exportAssignedAt: job.exportAssignedAt ?? new Date(),
          },
        });
      }
    }

    return request;
  });

  await ensureDefaultTariffSchedule(yard.id);

  const invite = created.invites[0]!;
  const mailto = yard.contactEmail
    ? buildShipyardQuotationMailto({
        contactEmail: yard.contactEmail,
        yardName: yard.name,
        referenceCode: created.referenceCode,
        vesselName: created.vessel.name,
        vesselCode: created.vessel.code,
        dueAt: created.dueAt?.toISOString().slice(0, 10) ?? null,
        token: invite.token,
      })
    : null;

  return {
    ok: true as const,
    request: created,
    invite,
    mailto,
    portalPath: `/shipyard/quotations/t/${invite.token}`,
  };
}

async function nextJobAssignmentNumberTx(
  tx: Prisma.TransactionClient,
  vesselId: string,
  vesselCode: string,
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `${vesselCode}-JA-${year}-`;
  const rows = await tx.ddVesselJob.findMany({
    where: { vesselId, jobCode: { startsWith: prefix } },
    select: { jobCode: true },
  });
  let maxSeq = 0;
  for (const row of rows) {
    const code = row.jobCode ?? "";
    const seq = Number.parseInt(code.slice(prefix.length), 10);
    if (Number.isFinite(seq) && seq > maxSeq) maxSeq = seq;
  }
  return `${prefix}${String(maxSeq + 1).padStart(3, "0")}`;
}

export async function getQuotationRequestById(id: string) {
  return prisma.shipyardQuotationRequest.findFirst({
    where: { id, ...notDeleted },
    include: requestInclude,
  });
}

export async function getQuotationRequestByToken(token: string) {
  const invite = await prisma.shipyardQuotationInvite.findFirst({
    where: { token, ...notDeleted },
    include: {
      request: { include: requestInclude },
      yardCompany: { select: { id: true, name: true, code: true } },
    },
  });
  if (!invite) return null;

  if (invite.status === "invited") {
    await prisma.shipyardQuotationInvite.update({
      where: { id: invite.id },
      data: { status: "opened", openedAt: invite.openedAt ?? new Date() },
    });
    if (invite.request.status === "sent") {
      await prisma.shipyardQuotationRequest.update({
        where: { id: invite.requestId },
        data: { status: "in_progress" },
      });
    }
  }

  return getQuotationRequestById(invite.requestId);
}

export async function listQuotationRequestsForYard(yardCompanyId: string) {
  const invites = await prisma.shipyardQuotationInvite.findMany({
    where: { yardCompanyId, ...notDeleted },
    include: {
      request: {
        include: {
          vessel: { select: { id: true, name: true, code: true, imoNumber: true } },
          _count: { select: { jobs: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return invites
    .filter((i) => !i.request.deletedAt)
    .map((invite) => ({
      inviteId: invite.id,
      token: invite.token,
      inviteStatus: invite.status,
      contactEmail: invite.contactEmail,
      openedAt: invite.openedAt?.toISOString() ?? null,
      submittedAt: invite.submittedAt?.toISOString() ?? null,
      requestId: invite.request.id,
      referenceCode: invite.request.referenceCode,
      status: invite.request.status,
      dueAt: invite.request.dueAt?.toISOString() ?? null,
      sentAt: invite.request.sentAt?.toISOString() ?? null,
      dockCycle: invite.request.dockCycle,
      jobCount: invite.request._count.jobs,
      vessel: invite.request.vessel,
      createdAt: invite.createdAt.toISOString(),
    }));
}

export async function listQuotationRequestsForOffice(query?: {
  vesselId?: string;
  status?: ShipyardQuotationRequestStatus | "all";
}) {
  const where: Prisma.ShipyardQuotationRequestWhereInput = { ...notDeleted };
  if (query?.vesselId) where.vesselId = query.vesselId;
  if (query?.status && query.status !== "all") where.status = query.status;

  const rows = await prisma.shipyardQuotationRequest.findMany({
    where,
    include: {
      vessel: { select: { id: true, name: true, code: true } },
      invites: {
        where: { deletedAt: null },
        include: { yardCompany: { select: { id: true, name: true, code: true } } },
      },
      _count: { select: { jobs: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return rows.map((row) => ({
    id: row.id,
    referenceCode: row.referenceCode,
    status: row.status,
    dockCycle: row.dockCycle,
    dueAt: row.dueAt?.toISOString() ?? null,
    sentAt: row.sentAt?.toISOString() ?? null,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    jobCount: row._count.jobs,
    vessel: row.vessel,
    yards: row.invites.map((i) => ({
      id: i.yardCompany.id,
      name: i.yardCompany.name,
      code: i.yardCompany.code,
      inviteStatus: i.status,
    })),
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function upsertQuotationLines(
  requestId: string,
  lines: QuotationLineInput[],
) {
  const request = await prisma.shipyardQuotationRequest.findFirst({
    where: { id: requestId, ...notDeleted },
    include: { jobs: { select: { id: true } } },
  });
  if (!request) return { ok: false as const, error: "Request not found", status: 404 as const };
  if (request.status === "submitted" || request.status === "withdrawn") {
    return { ok: false as const, error: "Quote is locked", status: 400 as const };
  }

  const allowed = new Set(request.jobs.map((j) => j.id));
  await prisma.$transaction(
    lines
      .filter((line) => allowed.has(line.requestJobId))
      .map((line) => {
        const qty = line.quantity ?? 1;
        const rate = line.unitRate ?? null;
        const amount = rate == null ? null : qty * rate;
        return prisma.shipyardQuotationLine.upsert({
          where: { requestJobId: line.requestJobId },
          create: {
            requestJobId: line.requestJobId,
            quantity: qty,
            unit: line.unit?.trim() || "ls",
            unitRate: rate,
            amount,
            notes: line.notes?.trim() || null,
            currency: request.currency,
          },
          update: {
            quantity: qty,
            unit: line.unit?.trim() || "ls",
            unitRate: rate,
            amount,
            notes: line.notes?.trim() || null,
          },
        });
      }),
  );

  if (request.status === "sent") {
    await prisma.shipyardQuotationRequest.update({
      where: { id: requestId },
      data: { status: "in_progress" },
    });
  }

  return { ok: true as const, request: await getQuotationRequestById(requestId) };
}

export async function saveQuotationTerms(requestId: string, body: string) {
  const request = await prisma.shipyardQuotationRequest.findFirst({
    where: { id: requestId, ...notDeleted },
  });
  if (!request) return { ok: false as const, error: "Request not found", status: 404 as const };
  if (request.status === "submitted" || request.status === "withdrawn") {
    return { ok: false as const, error: "Quote is locked", status: 400 as const };
  }

  await prisma.shipyardQuotationTerms.upsert({
    where: { requestId },
    create: { requestId, body },
    update: { body },
  });

  return { ok: true as const, request: await getQuotationRequestById(requestId) };
}

export async function applyTariffScheduleToQuote(requestId: string, scheduleId: string) {
  const request = await prisma.shipyardQuotationRequest.findFirst({
    where: { id: requestId, ...notDeleted },
  });
  if (!request) return { ok: false as const, error: "Request not found", status: 404 as const };

  const schedule = await prisma.shipyardTariffSchedule.findFirst({
    where: { id: scheduleId, ...notDeleted },
    include: { rates: { orderBy: [{ groupKey: "asc" }, { sortOrder: "asc" }] } },
  });
  if (!schedule) return { ok: false as const, error: "Tariff schedule not found", status: 404 as const };

  const ratesJson = schedule.rates.map((r) => ({
    groupKey: r.groupKey,
    label: r.label,
    unit: r.unit,
    unitRate: r.unitRate,
    notes: r.notes,
    sortOrder: r.sortOrder,
  }));

  await prisma.shipyardQuotationTariffSnapshot.upsert({
    where: { requestId },
    create: {
      requestId,
      scheduleId: schedule.id,
      currency: schedule.currency,
      ratesJson,
    },
    update: {
      scheduleId: schedule.id,
      currency: schedule.currency,
      ratesJson,
    },
  });

  return { ok: true as const, request: await getQuotationRequestById(requestId) };
}

export async function updateTariffRates(
  scheduleId: string,
  rates: { id: string; unitRate: number; notes?: string | null }[],
) {
  await prisma.$transaction(
    rates.map((r) =>
      prisma.shipyardTariffRate.update({
        where: { id: r.id },
        data: {
          unitRate: r.unitRate,
          ...(r.notes !== undefined ? { notes: r.notes } : {}),
        },
      }),
    ),
  );
  return prisma.shipyardTariffSchedule.findFirst({
    where: { id: scheduleId },
    include: { rates: { orderBy: [{ groupKey: "asc" }, { sortOrder: "asc" }] } },
  });
}

export async function submitQuotation(requestId: string, inviteId?: string) {
  const request = await getQuotationRequestById(requestId);
  if (!request) return { ok: false as const, error: "Request not found", status: 404 as const };
  if (request.status === "submitted") {
    return { ok: false as const, error: "Already submitted", status: 400 as const };
  }

  const unpriced = request.jobs.filter(
    (j) => j.quoteLine?.unitRate == null || j.quoteLine.unitRate < 0,
  );
  if (unpriced.length > 0) {
    return {
      ok: false as const,
      error: `Price all jobs before submit (${unpriced.length} remaining)`,
      status: 400 as const,
    };
  }

  // Snapshot default tariff if missing
  const invite = inviteId
    ? request.invites.find((i) => i.id === inviteId)
    : request.invites[0];
  if (invite && !request.tariffSnapshot) {
    const schedule = await ensureDefaultTariffSchedule(invite.yardCompanyId);
    await applyTariffScheduleToQuote(requestId, schedule.id);
  }

  await prisma.$transaction([
    prisma.shipyardQuotationRequest.update({
      where: { id: requestId },
      data: { status: "submitted", submittedAt: new Date() },
    }),
    ...(invite
      ? [
          prisma.shipyardQuotationInvite.update({
            where: { id: invite.id },
            data: {
              status: "submitted" satisfies ShipyardQuotationInviteStatus,
              submittedAt: new Date(),
            },
          }),
        ]
      : []),
  ]);

  return { ok: true as const, request: await getQuotationRequestById(requestId) };
}

export function groupJobsByQuoteCategory<T extends { quoteCategory: ShipyardQuoteJobCategory }>(
  jobs: T[],
): Record<ShipyardQuoteJobCategory, T[]> {
  const groups: Record<ShipyardQuoteJobCategory, T[]> = {
    deck: [],
    machinery: [],
    hull_walls_overboard: [],
    painting: [],
    other: [],
  };
  for (const job of jobs) {
    groups[job.quoteCategory].push(job);
  }
  return groups;
}

export async function listTariffSchedulesForYard(yardCompanyId: string) {
  await ensureDefaultTariffSchedule(yardCompanyId);
  return prisma.shipyardTariffSchedule.findMany({
    where: { yardCompanyId, ...notDeleted },
    include: { rates: { orderBy: [{ groupKey: "asc" }, { sortOrder: "asc" }] } },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
}

export async function assertYardOwnsQuotationRequest(
  requestId: string,
  yardCompanyId: string,
): Promise<{ ok: true; request: QuotationRequestDetail } | { ok: false; status: number; error: string }> {
  const request = await getQuotationRequestById(requestId);
  if (!request) return { ok: false, status: 404, error: "Request not found" };
  const invite = request.invites.find((i) => i.yardCompanyId === yardCompanyId);
  if (!invite) return { ok: false, status: 403, error: "Not invited to this quotation" };
  return { ok: true, request };
}

export async function resolveYardCompanyIdForSession(userId: string | null): Promise<string | null> {
  if (!userId) {
    const first = await prisma.company.findFirst({
      where: { ...notDeleted, category: "shipyard", status: "active" },
      orderBy: { name: "asc" },
      select: { id: true },
    });
    return first?.id ?? null;
  }

  const employee = await prisma.employee.findFirst({
    where: { userId, ...notDeleted },
    select: { companyId: true, company: { select: { category: true } } },
  });
  if (employee?.company.category === "shipyard") return employee.companyId;

  const first = await prisma.company.findFirst({
    where: { ...notDeleted, category: "shipyard", status: "active" },
    orderBy: { name: "asc" },
    select: { id: true },
  });
  return first?.id ?? null;
}
