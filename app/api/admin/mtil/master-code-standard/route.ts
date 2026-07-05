import { NextResponse } from "next/server";
import { requireAdminApiAccess } from "@/lib/auth/adminAccess";
import { getEmdrCodebook, getEmdrRegistryReport } from "@/lib/emdr/registry";
import {
  EXTENDED_ENTITY_CODES,
  MASTER_CODE_ENTITY_CATALOG,
  MASTER_CODE_STANDARD_VERSION,
  MASTER_EQUIPMENT_SYSTEM_CODES,
  MASTER_ENTITY_CODES,
  LEGACY_ENTITY_PREFIX_MAP,
} from "@/lib/mtil/masterCodeStandard";

export const runtime = "nodejs";

export async function GET() {
  const denied = await requireAdminApiAccess();
  if (denied) return denied;

  const emdr = getEmdrRegistryReport();
  const codebook = getEmdrCodebook();

  return NextResponse.json({
    version: MASTER_CODE_STANDARD_VERSION,
    emdrVersion: emdr.version,
    codebookSource: emdr.codebookPresent ? "Actinium_SM_EMDR_Master_Codebook_V2_0.xlsx" : "typescript-fallback",
    title: "Actinium-SM Engineering Master Code Standard",
    format: emdr.idFormat,
    example: {
      equipment: "EQPM-ME-CYU-0001",
      component: "COMP-ME-CYU-0012",
      standardJob: "JOBS-ME-CYU-0187",
      template: "TMPL-ME-CYU-0008",
      measurement: "MEAS-ME-CYU-1024",
      inspection: "INSP-ME-CYU-2056",
      scope: "SCOP-ME-CYU-0187",
      spare: "SPAR-ME-CYU-0005",
      workflow: "WORK-ME-CYU-0001",
    },
    entityCodesFromCodebook: codebook.entityCodes,
    systemCodesFromCodebook: codebook.systemCodes,
    importOrder: codebook.importOrder,
    coreEntities: MASTER_CODE_ENTITY_CATALOG,
    entityCodes: MASTER_ENTITY_CODES,
    extendedEntityCodes: EXTENDED_ENTITY_CODES,
    equipmentSystemCodes: MASTER_EQUIPMENT_SYSTEM_CODES,
    legacyPrefixMap: LEGACY_ENTITY_PREFIX_MAP,
    importBehavior:
      "Workbook imports accept legacy prefixes (JOB, TMP, EQ, CMP, etc.) and normalize to canonical 4-letter codes before PostgreSQL upsert.",
  });
}
