import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/adminAccess";
import { seedJobCatalogPhase1, isJobCatalogPhase1Seeded, getJobCatalogPhase1Stats } from "@/lib/mtil/db/seedJobCatalogPhase1";
import { seedJobCatalogPhase2, isJobCatalogPhase2Seeded, getJobCatalogPhase2Stats } from "@/lib/mtil/db/seedJobCatalogPhase2";
import { seedJobCatalogPhase3, isJobCatalogPhase3Seeded, getJobCatalogPhase3Stats } from "@/lib/mtil/db/seedJobCatalogPhase3";
import { isPhase1WorkbookV04Seeded } from "@/lib/mtil/db/seedPhase1WorkbookV04";
import { isPhase2WorkbookV05Seeded } from "@/lib/mtil/db/seedPhase2WorkbookV05";
import { isPhase3WorkbookV06Seeded } from "@/lib/mtil/db/seedPhase3WorkbookV06";
import { isPhase4WorkbookV07Seeded } from "@/lib/mtil/db/seedPhase4WorkbookV07";
import { isPhase5WorkbookV08Seeded } from "@/lib/mtil/db/seedPhase5WorkbookV08";
import { isPhase6WorkbookV09Seeded } from "@/lib/mtil/db/seedPhase6WorkbookV09";
import { getPhase1WorkbookV04Stats } from "@/lib/mtil/phases/phase1/workbookJobLibraryTree";
import { getPhase2WorkbookV05Stats } from "@/lib/mtil/phases/phase2/workbookJobLibraryTree";
import { getPhase3WorkbookV06Stats } from "@/lib/mtil/phases/phase3/workbookJobLibraryTree";
import { getPhase4WorkbookV07Stats } from "@/lib/mtil/phases/phase4/workbookJobLibraryTree";
import { getPhase5WorkbookV08Stats } from "@/lib/mtil/phases/phase5/workbookJobLibraryTree";
import { getPhase6WorkbookV09Stats } from "@/lib/mtil/phases/phase6/workbookJobLibraryTree";
import {
  ensureMtilPhase1WorkbookV04Seeded,
  ensureMtilPhase2WorkbookV05Seeded,
  ensureMtilPhase3WorkbookV06Seeded,
  ensureMtilPhase4WorkbookV07Seeded,
  ensureMtilPhase5WorkbookV08Seeded,
  ensureMtilPhase6WorkbookV09Seeded,
} from "@/lib/vessel/jobLibrary/seed";

export const runtime = "nodejs";

export async function GET() {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const [
    seeded,
    seededPhase2,
    seededPhase3,
    workbookV04Seeded,
    workbookV05Seeded,
    workbookV06Seeded,
    workbookV07Seeded,
    workbookV08Seeded,
    workbookV09Seeded,
  ] = await Promise.all([
    isJobCatalogPhase1Seeded(),
    isJobCatalogPhase2Seeded(),
    isJobCatalogPhase3Seeded(),
    isPhase1WorkbookV04Seeded(),
    isPhase2WorkbookV05Seeded(),
    isPhase3WorkbookV06Seeded(),
    isPhase4WorkbookV07Seeded(),
    isPhase5WorkbookV08Seeded(),
    isPhase6WorkbookV09Seeded(),
  ]);

  const stats = seeded ? await getJobCatalogPhase1Stats() : null;
  const statsPhase2 = seededPhase2 ? await getJobCatalogPhase2Stats() : null;
  const statsPhase3 = seededPhase3 ? await getJobCatalogPhase3Stats() : null;

  return NextResponse.json({
    seeded,
    seededPhase2,
    seededPhase3,
    stats,
    statsPhase2,
    statsPhase3,
    workbooks: {
      phase1V04: { seeded: workbookV04Seeded, stats: getPhase1WorkbookV04Stats() },
      phase2V05: { seeded: workbookV05Seeded, stats: getPhase2WorkbookV05Stats() },
      phase3V06: { seeded: workbookV06Seeded, stats: getPhase3WorkbookV06Stats() },
      phase4V07: { seeded: workbookV07Seeded, stats: getPhase4WorkbookV07Stats() },
      phase5V08: { seeded: workbookV08Seeded, stats: getPhase5WorkbookV08Stats() },
      phase6V09: { seeded: workbookV09Seeded, stats: getPhase6WorkbookV09Stats() },
    },
  });
}

export async function POST() {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  try {
    const [
      result1,
      result2,
      result3,
      workbookV04,
      workbookV05,
      workbookV06,
      workbookV07,
      workbookV08,
      workbookV09,
    ] = await Promise.all([
      seedJobCatalogPhase1(),
      seedJobCatalogPhase2(),
      seedJobCatalogPhase3(),
      ensureMtilPhase1WorkbookV04Seeded(),
      ensureMtilPhase2WorkbookV05Seeded(),
      ensureMtilPhase3WorkbookV06Seeded(),
      ensureMtilPhase4WorkbookV07Seeded(),
      ensureMtilPhase5WorkbookV08Seeded(),
      ensureMtilPhase6WorkbookV09Seeded(),
    ]);

    const inserted =
      !result1.alreadySeeded ||
      !result2.alreadySeeded ||
      !result3.alreadySeeded ||
      workbookV04.inserted ||
      workbookV05.inserted ||
      workbookV06.inserted ||
      workbookV07.inserted ||
      workbookV08.inserted ||
      workbookV09.inserted;

    return NextResponse.json(
      {
        phase1: result1,
        phase2: result2,
        phase3: result3,
        workbooks: {
          phase1V04: workbookV04,
          phase2V05: workbookV05,
          phase3V06: workbookV06,
          phase4V07: workbookV07,
          phase5V08: workbookV08,
          phase6V09: workbookV09,
        },
      },
      { status: inserted ? 201 : 200 },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Job catalog seed failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
