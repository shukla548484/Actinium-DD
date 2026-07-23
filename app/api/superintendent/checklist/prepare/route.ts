import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperintendentApiAccess } from "@/lib/auth/superintendentAccess";
import { findDryDockProject } from "@/lib/superintendent/helpers";
import { assertDryDockProjectInScope } from "@/lib/superintendent/scope";
import { ensureProjectChecklistFromTemplate } from "@/lib/superintendent/engine/ensureChecklist";
import { parseBody } from "@/lib/superintendent/validation";

export const dynamic = "force-dynamic";

const prepareSchema = z.object({
  dryDockProjectId: z.string().min(1),
});

/** Backfill missing template pre-dock checklist items for a project. */
export async function POST(request: Request) {
  const denied = await requireSuperintendentApiAccess();
  if (denied) return denied;

  const parsed = parseBody(prepareSchema, await request.json());
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const project = await findDryDockProject(parsed.data.dryDockProjectId);
  if (!project) return NextResponse.json({ error: "Dry dock project not found" }, { status: 404 });

  const access = await assertDryDockProjectInScope(parsed.data.dryDockProjectId);
  if (!access.ok) return access.response;

  const result = await ensureProjectChecklistFromTemplate({
    dryDockProjectId: project.id,
    projectType: project.projectType,
  });

  return NextResponse.json({
    ok: true,
    added: result.added,
    titles: result.titles,
  });
}
