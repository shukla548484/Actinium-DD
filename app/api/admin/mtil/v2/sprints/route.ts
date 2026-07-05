import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/adminAccess";
import { getEmdrRegistryReport } from "@/lib/emdr/registry";
import {
  getV201CombinedStats,
  isV201AllSprintsSeeded,
  isV201SprintSeeded,
  seedV201AllSprints,
  seedV201Sprint,
} from "@/lib/mtil/db/seedV201MainPropulsion";
import { V2_SPRINT_REGISTRY, getV2SprintById } from "@/lib/mtil/v2/sprints/registry";

export const runtime = "nodejs";

export async function GET() {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const stats = getV201CombinedStats();
  const emdr = getEmdrRegistryReport();
  const seeded = await Promise.all(
    V2_SPRINT_REGISTRY.map(async (sprint) => ({
      id: sprint.id,
      sprintCode: sprint.sprintCode,
      name: sprint.name,
      seeded: await isV201SprintSeeded(sprint),
    })),
  );

  return NextResponse.json({
    release: "V2.0.1",
    emdrVersion: emdr.version,
    allSeeded: await isV201AllSprintsSeeded(),
    stats,
    sprints: seeded,
    emdrSprints: emdr.sprints.map((s) => ({
      id: s.id,
      release: s.emdrRelease,
      name: s.name,
      status: s.status,
      workbookPresent: s.workbookPresent,
    })),
    pendingReleases: emdr.pendingReleases,
  });
}

export async function POST(req: Request) {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  let sprintId: string | undefined;
  try {
    const body = (await req.json()) as { sprintId?: string };
    sprintId = body.sprintId;
  } catch {
    sprintId = undefined;
  }

  try {
    if (!sprintId || sprintId === "all") {
      const result = await seedV201AllSprints();
      return NextResponse.json({ ok: true, ...result });
    }

    const sprint = getV2SprintById(sprintId);
    if (!sprint) {
      return NextResponse.json({ error: `Unknown sprint: ${sprintId}` }, { status: 400 });
    }

    const result = await seedV201Sprint(sprintId);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "V2 sprint seed failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
