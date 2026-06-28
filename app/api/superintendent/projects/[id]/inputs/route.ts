import { NextResponse } from "next/server";
import type { DryDockProjectType } from "@prisma/client";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import {
  buildInputReadiness,
  listActiveInputSubmissions,
  upsertInputSubmission,
} from "@/lib/db/superintendent/inputs";
import { findDryDockProject } from "@/lib/superintendent/helpers";
import { assertDryDockProjectInScope } from "@/lib/superintendent/scope";
import { getSectionsForProjectType } from "@/lib/superintendent/inputCatalog";
import type { InputPageKey } from "@/lib/superintendent/inputCatalog/types";
import { ddInputUpsertSchema, parseBody } from "@/lib/superintendent/validation";
import { prisma } from "@/lib/prisma";
import { notDeleted } from "@/lib/db/superintendent/pagination";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

async function loadProject(id: string) {
  const project = await prisma.dryDockProject.findFirst({
    where: { id, ...notDeleted },
    select: { id: true, projectType: true },
  });
  return project;
}

export async function GET(request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const access = await assertDryDockProjectInScope(id);
  if (!access.ok) return access.response;

  const project = await loadProject(id);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const pageKey = (searchParams.get("pageKey") as InputPageKey | null) ?? undefined;

  const [submissions, catalog, readiness] = await Promise.all([
    listActiveInputSubmissions(id, pageKey),
    Promise.resolve(getSectionsForProjectType(project.projectType, pageKey)),
    buildInputReadiness(id, project.projectType, pageKey ?? "vessel"),
  ]);

  return NextResponse.json({
    projectType: project.projectType,
    catalog,
    submissions,
    readiness,
  });
}

export async function POST(request: Request, ctx: RouteCtx) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const { id } = await ctx.params;
  const access = await assertDryDockProjectInScope(id);
  if (!access.ok) return access.response;

  const project = await findDryDockProject(id);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const parsed = parseBody(ddInputUpsertSchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const submission = await upsertInputSubmission({
      dryDockProjectId: id,
      ...parsed.data,
    });
    const readiness = await buildInputReadiness(
      id,
      project.projectType as DryDockProjectType,
      "vessel",
    );
    return NextResponse.json({ submission, readiness }, { status: 201 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save input";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
