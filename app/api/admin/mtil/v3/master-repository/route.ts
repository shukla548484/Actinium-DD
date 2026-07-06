import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/adminAccess";
import { isEmdrMasterRepositoryPresent } from "@/lib/emdr/paths";
import { getEmdrMasterRepositoryWorkbookStats } from "@/lib/emdr/v3/v30JobLibraryTree";
import {
  getV30MasterRepositoryStats,
  isEmdrMasterRepositorySeeded,
  seedEmdrMasterRepository,
} from "@/lib/mtil/db/seedV30MainEngine";
import { validateEmdrSprintWorkbook } from "@/lib/emdr/validateSprintWorkbook";
import { validateMtilWorkbook } from "@/lib/mtil/import/validateWorkbook";

export const runtime = "nodejs";

export async function GET() {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const stats = getEmdrMasterRepositoryWorkbookStats();
  const parsed = getV30MasterRepositoryStats();
  const seeded = await isEmdrMasterRepositorySeeded();

  return NextResponse.json({
    kind: stats.kind,
    release: stats.release,
    workbookPresent: isEmdrMasterRepositoryPresent(),
    seeded,
    stats,
    systems: parsed?.repositoryIndex ?? [],
    validation: parsed
      ? {
          mtil: validateMtilWorkbook(parsed),
          emdr: validateEmdrSprintWorkbook(parsed),
        }
      : null,
  });
}

export async function POST() {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  try {
    const result = await seedEmdrMasterRepository();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "EMDR master repository seed failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
