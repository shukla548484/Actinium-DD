import { NextResponse } from "next/server";
import { z } from "zod";
import { requireShipyardApiAccess } from "@/lib/auth/shipyardAccess";
import { getSessionUserId } from "@/lib/auth/session";
import {
  applyTariffScheduleToQuote,
  assertYardOwnsQuotationRequest,
  listTariffSchedulesForYard,
  resolveYardCompanyIdForSession,
  saveQuotationTerms,
  submitQuotation,
  upsertQuotationLines,
} from "@/lib/db/shipyardQuotation";
import { parseBody } from "@/lib/superintendent/validation";

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
    inviteId: z.string().optional(),
  }),
]);

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const denied = await requireShipyardApiAccess(request);
  if (denied) return denied;

  const { id } = await context.params;
  const userId = await getSessionUserId();
  const yardCompanyId = await resolveYardCompanyIdForSession(userId);
  if (!yardCompanyId) {
    return NextResponse.json({ error: "No shipyard company in scope" }, { status: 403 });
  }

  const access = await assertYardOwnsQuotationRequest(id, yardCompanyId);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const tariffs = await listTariffSchedulesForYard(yardCompanyId);
  return NextResponse.json({
    request: access.request,
    tariffs,
    yardCompanyId,
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const denied = await requireShipyardApiAccess(request);
    if (denied) return denied;

    const { id } = await context.params;
    const userId = await getSessionUserId();
    const yardCompanyId = await resolveYardCompanyIdForSession(userId);
    if (!yardCompanyId) {
      return NextResponse.json({ error: "No shipyard company in scope" }, { status: 403 });
    }

    const access = await assertYardOwnsQuotationRequest(id, yardCompanyId);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const parsed = parseBody(patchSchema, await request.json());
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    if (parsed.data.action === "save_lines") {
      const result = await upsertQuotationLines(id, parsed.data.lines);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      return NextResponse.json({ request: result.request });
    }

    if (parsed.data.action === "save_terms") {
      const result = await saveQuotationTerms(id, parsed.data.body);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      return NextResponse.json({ request: result.request });
    }

    if (parsed.data.action === "apply_tariff") {
      const { scheduleId } = parsed.data;
      const schedule = (await listTariffSchedulesForYard(yardCompanyId)).find(
        (s) => s.id === scheduleId,
      );
      if (!schedule) {
        return NextResponse.json({ error: "Tariff schedule not found" }, { status: 404 });
      }
      const result = await applyTariffScheduleToQuote(id, scheduleId);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      return NextResponse.json({ request: result.request });
    }

    const result = await submitQuotation(id, parsed.data.inviteId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ request: result.request, message: "Quote submitted" });
  } catch (err) {
    console.error("[shipyard/quotations PATCH]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Update failed" },
      { status: 500 },
    );
  }
}
