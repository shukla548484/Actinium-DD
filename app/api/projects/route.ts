import { NextResponse } from "next/server";
import { createProject } from "@/lib/db/index";
import { getSessionUserId } from "@/lib/auth/session";
import {
  assertVesselInUserScope,
  buildUserScope,
} from "@/lib/rbac/scopeRules";
import { nextTenderProjectCode } from "@/lib/projects/createContext";
import {
  listScopedProjects,
  requireProjectsApiAccess,
} from "@/lib/projects/projectScope";
import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/superintendent/helpers";

export const runtime = "nodejs";

export async function GET() {
  const denied = await requireProjectsApiAccess();
  if (denied) return denied;

  const projects = await listScopedProjects();
  return NextResponse.json({ projects });
}

export async function POST(request: Request) {
  const denied = await requireProjectsApiAccess("page.office.projects.new");
  if (denied) return denied;

  const body = (await request.json()) as {
    name?: string;
    vesselName?: string;
    vesselId?: string;
    referenceCode?: string;
    currency?: string;
    shipyardDays?: number;
    dryDockDays?: number;
    cprDays?: number;
    notes?: string;
    preferredShipyards?: string[];
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Project name is required." }, { status: 400 });
  }

  const vesselId = body.vesselId?.trim() || undefined;
  if (!vesselId) {
    return NextResponse.json({ error: "Select an assigned vessel." }, { status: 400 });
  }

  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scope = await buildUserScope(userId);
  const access = await assertVesselInUserScope(vesselId, scope);
  if (!access.ok) return access.response;

  const vessel = await prisma.vessel.findFirst({
    where: { id: vesselId, ...notDeleted, status: "active" },
    select: { id: true, name: true, code: true },
  });
  if (!vessel) {
    return NextResponse.json({ error: "Vessel not found." }, { status: 404 });
  }

  const preferredShipyards = (body.preferredShipyards ?? [])
    .map((s) => String(s).trim())
    .filter(Boolean)
    .slice(0, 3);

  const referenceCode =
    body.referenceCode?.trim() || (await nextTenderProjectCode(vesselId));

  try {
    const project = await createProject({
      name: body.name.trim(),
      vesselName: body.vesselName?.trim() || vessel.name,
      vesselId: vessel.id,
      referenceCode,
      currency: body.currency ?? "USD",
      shipyardDays: body.shipyardDays,
      dryDockDays: body.dryDockDays,
      cprDays: body.cprDays,
      notes: body.notes?.trim(),
      preferredShipyards,
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/projects]", err);
    const message =
      err instanceof Error ? err.message : "Failed to create project.";
    const status = /already exists/i.test(message) ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
