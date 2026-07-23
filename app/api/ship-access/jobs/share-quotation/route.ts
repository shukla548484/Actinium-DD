import { NextResponse } from "next/server";
import { z } from "zod";
import { requireShipAccessApiAccess } from "@/lib/auth/shipAccess";
import {
  createQuotationShareFromVesselJobs,
  listShipyardCompanies,
} from "@/lib/db/shipyardQuotation";
import { parseBody } from "@/lib/superintendent/validation";
import { assertShipVesselInScope, getSelectedShipVesselId } from "@/lib/shipAccess/scope";
import { getCrewSessionContext } from "@/lib/shipAccess/crewContext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const shareSchema = z.object({
  jobIds: z.array(z.string().min(1)).min(1),
  yardCompanyId: z.string().min(1),
  vesselId: z.string().min(1).optional(),
  dryDockProjectId: z.string().nullable().optional(),
  dockCycle: z
    .enum(["first_special", "second_special", "third_special", "intermediate", "other"])
    .optional(),
  plannedStart: z.string().nullable().optional(),
  plannedEnd: z.string().nullable().optional(),
  dryDockDays: z.number().int().nullable().optional(),
  shipyardDays: z.number().int().nullable().optional(),
  cprDays: z.number().int().nullable().optional(),
  dueAt: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function GET(request: Request) {
  const denied = await requireShipAccessApiAccess(request);
  if (denied) return denied;

  const yards = await listShipyardCompanies();
  return NextResponse.json({ yards });
}

export async function POST(request: Request) {
  try {
    const denied = await requireShipAccessApiAccess(request);
    if (denied) return denied;

    const parsed = parseBody(shareSchema, await request.json());
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const vesselId =
      parsed.data.vesselId ?? (await getSelectedShipVesselId()) ?? undefined;
    if (!vesselId) {
      return NextResponse.json({ error: "Select a vessel first" }, { status: 400 });
    }

    const access = await assertShipVesselInScope(vesselId);
    if (!access.ok) return access.response;

    const crew = await getCrewSessionContext();
    const result = await createQuotationShareFromVesselJobs({
      vesselId,
      jobIds: parsed.data.jobIds,
      yardCompanyId: parsed.data.yardCompanyId,
      dryDockProjectId: parsed.data.dryDockProjectId,
      dockCycle: parsed.data.dockCycle,
      plannedStart: parsed.data.plannedStart ? new Date(parsed.data.plannedStart) : null,
      plannedEnd: parsed.data.plannedEnd ? new Date(parsed.data.plannedEnd) : null,
      dryDockDays: parsed.data.dryDockDays,
      shipyardDays: parsed.data.shipyardDays,
      cprDays: parsed.data.cprDays,
      dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
      notes: parsed.data.notes,
      requestedByName: crew?.designation ?? crew?.roleName ?? null,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const { trySendShipyardQuotationInviteEmail } = await import(
      "@/lib/mail/sendShipyardQuotationInvite"
    );
    const emailResult = await trySendShipyardQuotationInviteEmail({
      contactEmail: result.invite.contactEmail,
      yardName: result.invite.yardCompany?.name ?? "Shipyard",
      referenceCode: result.request.referenceCode,
      vesselName: result.request.vessel.name,
      vesselCode: result.request.vessel.code,
      dueAt: result.request.dueAt?.toISOString().slice(0, 10) ?? null,
      token: result.invite.token,
      jobTitles: result.request.jobs.map((j) => j.title),
      notes: result.request.notes,
    });

    return NextResponse.json({
      request: {
        id: result.request.id,
        referenceCode: result.request.referenceCode,
        status: result.request.status,
        jobCount: result.request.jobs.length,
      },
      invite: {
        id: result.invite.id,
        token: result.invite.token,
        contactEmail: result.invite.contactEmail,
      },
      mailto: result.mailto,
      portalPath: result.portalPath,
      email: emailResult,
      message: `Quotation request ${result.request.referenceCode} sent to yard`,
    });
  } catch (err) {
    console.error("[share-quotation]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to share quotation" },
      { status: 500 },
    );
  }
}
