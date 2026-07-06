import { NextResponse } from "next/server";
import { importV2SprintFromParsed } from "@/lib/mtil/v2/import/importSprintWorkbook";
import type { ParsedV3MasterRepository } from "@/lib/emdr/v3/parseMasterRepository";

export async function importV30MasterRepositoryFromParsed(
  data: ParsedV3MasterRepository,
): Promise<Awaited<ReturnType<typeof importV2SprintFromParsed>>> {
  return importV2SprintFromParsed(data, { mode: "merge", jobIdPrefix: "ME" });
}
