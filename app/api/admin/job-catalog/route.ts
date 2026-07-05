import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/adminAccess";
import {
  getJobCatalogStats,
  listJobCatalogTemplates,
  listMasterJobLibraryRows,
} from "@/lib/db/jobCatalogStats";
import { isJobCatalogPhase1Seeded, seedJobCatalogPhase1 } from "@/lib/mtil/db/seedJobCatalogPhase1";

export const runtime = "nodejs";

export async function GET() {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const [stats, templates, masterJobs, seeded] = await Promise.all([
    getJobCatalogStats(),
    listJobCatalogTemplates(30),
    listMasterJobLibraryRows(30),
    isJobCatalogPhase1Seeded(),
  ]);

  return NextResponse.json({ stats, templates, masterJobs, seeded });
}

export async function POST() {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  try {
    const result = await seedJobCatalogPhase1();
    const stats = await getJobCatalogStats();
    return NextResponse.json({ ...result, stats }, { status: result.alreadySeeded ? 200 : 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Job catalog sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
