import { NextResponse } from "next/server";
import { z } from "zod";
import {
  applyTariffScheduleToQuote,
  ensureDefaultTariffSchedule,
  getQuotationRequestByToken,
  listTariffSchedulesForYard,
  saveQuotationTerms,
  submitQuotation,
  upsertQuotationLines,
} from "@/lib/db/shipyardQuotation";
import { parseBody } from "@/lib/superintendent/validation";
import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/superintendent/helpers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const patchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("save_lines"),
    lines: z.array(
      z.object({
        requestJobId: z.string().min(1),
        quantity: z.number().positive().optional(),
        unit: z.string().optional(),
        unitRate: z.number().nullable().optional(),
        notes: z.string().nullable().optional(),
      }),
    ),
  }),
  z.object({
    action: z.literal("save_terms"),
    body: z.string(),
  }),
  z.object({
    action: z.literal("apply_tariff"),
    scheduleId: z.string().min(1),
  }),
  z.object({
    action: z.literal("submit"),
  }),
]);

async function resolveInvite(token: string) {
  return prisma.shipyardQuotationInvite.findFirst({
    where: { token, ...notDeleted },
    select: { id: true, requestId: true, yardCompanyId: true },
  });
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const request = await getQuotationRequestByToken(token);
  if (!request) {
    return NextResponse.json({ error: "Invalid or expired invite link" }, { status: 404 });
  }

  const invite = request.invites.find((i) => i.token === token) ?? request.invites[0];
  const yardCompanyId = invite?.yardCompanyId;
  const tariffs = yardCompanyId
    ? await listTariffSchedulesForYard(yardCompanyId)
    : [];

  return NextResponse.json({
    request,
    tariffs,
    inviteId: invite?.id ?? null,
    tokenAccess: true,
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    const invite = await resolveInvite(token);
    if (!invite) {
      return NextResponse.json({ error: "Invalid or expired invite link" }, { status: 404 });
    }

    const parsed = parseBody(patchSchema, await request.json());
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    if (parsed.data.action === "save_lines") {
      const result = await upsertQuotationLines(invite.requestId, parsed.data.lines);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      return NextResponse.json({ request: result.request });
    }

    if (parsed.data.action === "save_terms") {
      const result = await saveQuotationTerms(invite.requestId, parsed.data.body);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      return NextResponse.json({ request: result.request });
    }

    if (parsed.data.action === "apply_tariff") {
      const { scheduleId } = parsed.data;
      await ensureDefaultTariffSchedule(invite.yardCompanyId);
      const schedules = await listTariffSchedulesForYard(invite.yardCompanyId);
      if (!schedules.some((s) => s.id === scheduleId)) {
        return NextResponse.json({ error: "Tariff schedule not found" }, { status: 404 });
      }
      const result = await applyTariffScheduleToQuote(invite.requestId, scheduleId);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      return NextResponse.json({ request: result.request });
    }

    const result = await submitQuotation(invite.requestId, invite.id);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ request: result.request, message: "Quote submitted" });
  } catch (err) {
    console.error("[shipyard/quotations/by-token PATCH]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 500 },
    );
  }
}
