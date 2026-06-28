import { NextResponse } from "next/server";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { findVessel, notDeleted } from "@/lib/superintendent/helpers";
import { parseBody, vesselSuperintendentPatchSchema } from "@/lib/superintendent/validation";
import { assertVesselInScope } from "@/lib/superintendent/scope";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const access = await assertVesselInScope(id);
  if (!access.ok) return access.response;

  const vessel = await prisma.vessel.findFirst({
    where: { id, ...notDeleted },
    include: {
      company: { select: { id: true, name: true, code: true } },
      technicalProfile: true,
      dryDockProjects: {
        where: notDeleted,
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: {
          id: true,
          name: true,
          status: true,
          plannedStart: true,
          plannedEnd: true,
          progressPct: true,
        },
      },
    },
  });

  if (!vessel) return NextResponse.json({ error: "Vessel not found" }, { status: 404 });
  return NextResponse.json({ vessel });
}

export async function PATCH(request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const parsed = parseBody(vesselSuperintendentPatchSchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const existing = await findVessel(id);
  if (!existing) return NextResponse.json({ error: "Vessel not found" }, { status: 404 });

  const access = await assertVesselInScope(id);
  if (!access.ok) return access.response;

  const { technicalProfile, ...vesselFields } = parsed.data;

  const vessel = await prisma.$transaction(async (tx) => {
    const updated = await tx.vessel.update({
      where: { id },
      data: vesselFields,
      include: {
        company: { select: { id: true, name: true, code: true } },
        technicalProfile: true,
      },
    });

    if (technicalProfile) {
      await tx.vesselTechnicalProfile.upsert({
        where: { vesselId: id },
        create: { vesselId: id, ...technicalProfile },
        update: technicalProfile,
      });
    }

    if (technicalProfile) {
      return tx.vessel.findFirstOrThrow({
        where: { id },
        include: {
          company: { select: { id: true, name: true, code: true } },
          technicalProfile: true,
        },
      });
    }

    return updated;
  });

  return NextResponse.json({ vessel });
}

export async function DELETE(_request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const existing = await findVessel(id);
  if (!existing) return NextResponse.json({ error: "Vessel not found" }, { status: 404 });

  const access = await assertVesselInScope(id);
  if (!access.ok) return access.response;

  await prisma.vessel.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
