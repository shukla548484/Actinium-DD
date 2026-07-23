import { NextResponse } from "next/server";
import { requireProjectsApiAccess } from "@/lib/projects/projectScope";
import { getProjectsWorkbench } from "@/lib/projects/workbench";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const denied = await requireProjectsApiAccess();
  if (denied) return denied;

  const workbench = await getProjectsWorkbench();
  return NextResponse.json(workbench);
}
