import { NextResponse } from "next/server";
import { createProject } from "@/lib/db/index";
import {
  assertScopedProjectAccess,
  listScopedProjects,
  requireProjectsApiAccess,
} from "@/lib/projects/projectScope";

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
  };

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Project name is required." }, { status: 400 });
  }

  const project = await createProject({
    name: body.name.trim(),
    vesselName: body.vesselName?.trim(),
    vesselId: body.vesselId?.trim(),
    referenceCode: body.referenceCode?.trim(),
    currency: body.currency ?? "USD",
    shipyardDays: body.shipyardDays,
    dryDockDays: body.dryDockDays,
    cprDays: body.cprDays,
    notes: body.notes?.trim(),
  });

  return NextResponse.json({ project }, { status: 201 });
}
