import { NextResponse } from "next/server";
import { createProject, listProjects } from "@/lib/db/index";

export const runtime = "nodejs";

export async function GET() {
  const projects = await listProjects();
  return NextResponse.json({ projects });
}

export async function POST(request: Request) {
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
