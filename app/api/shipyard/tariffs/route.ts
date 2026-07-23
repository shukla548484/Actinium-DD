import { NextResponse } from "next/server";
import { z } from "zod";
import { requireShipyardApiAccess } from "@/lib/auth/shipyardAccess";
import { getSessionUserId } from "@/lib/auth/session";
import {
  listTariffSchedulesForYard,
  resolveYardCompanyIdForSession,
  updateTariffRates,
} from "@/lib/db/shipyardQuotation";
import { parseBody } from "@/lib/superintendent/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const patchSchema = z.object({
  scheduleId: z.string().min(1),
  rates: z.array(
    z.object({
      id: z.string().min(1),
      unitRate: z.number(),
      notes: z.string().nullable().optional(),
    }),
  ),
});

export async function GET(request: Request) {
  const denied = await requireShipyardApiAccess(request);
  if (denied) return denied;

  const userId = await getSessionUserId();
  const yardCompanyId = await resolveYardCompanyIdForSession(userId);
  if (!yardCompanyId) {
    return NextResponse.json({ error: "No shipyard company in scope" }, { status: 403 });
  }

  const schedules = await listTariffSchedulesForYard(yardCompanyId);
  return NextResponse.json({ schedules, yardCompanyId });
}

export async function PATCH(request: Request) {
  const denied = await requireShipyardApiAccess(request);
  if (denied) return denied;

  const userId = await getSessionUserId();
  const yardCompanyId = await resolveYardCompanyIdForSession(userId);
  if (!yardCompanyId) {
    return NextResponse.json({ error: "No shipyard company in scope" }, { status: 403 });
  }

  const parsed = parseBody(patchSchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const schedules = await listTariffSchedulesForYard(yardCompanyId);
  const owned = schedules.find((s) => s.id === parsed.data.scheduleId);
  if (!owned) {
    return NextResponse.json({ error: "Tariff schedule not found" }, { status: 404 });
  }

  const schedule = await updateTariffRates(parsed.data.scheduleId, parsed.data.rates);
  return NextResponse.json({ schedule });
}
