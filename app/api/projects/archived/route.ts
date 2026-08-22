import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth/session";
import { listArchivedProjectsForUser } from "@/lib/projects/archive";
import { requireProjectsApiAccess } from "@/lib/projects/projectScope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await requireProjectsApiAccess();
  if (denied) return denied;

  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized. Sign in at /login." }, { status: 401 });
  }

  const projects = await listArchivedProjectsForUser(userId);
  return NextResponse.json({ projects });
}
