#!/usr/bin/env tsx
/**
 * Import Phase 1 MTIL workbook into job catalog tables.
 *
 * Usage:
 *   npx tsx scripts/import-mtil-phase1.ts [path-to-xlsx] [--merge]
 */
import path from "node:path";
import { importJobCatalogFromPath } from "@/lib/mtil/import/importJobCatalogWorkbook";

const defaultWorkbook = path.join(
  process.env.HOME ?? "",
  "Downloads",
  "Actinium_SM_MTIL_Engineering_Repository_R0_1",
  "300_Master_Libraries",
  "310_Main_Propulsion",
  "Actinium_SM_MTIL_Phase_1_Main_Propulsion_v0.4.xlsx",
);

const args = process.argv.slice(2).filter((a) => a !== "--merge");
const merge = process.argv.includes("--merge");
const workbookPath = path.resolve(args[0] ?? defaultWorkbook);

async function main() {
  const result = await importJobCatalogFromPath(workbookPath, { mode: merge ? "merge" : "replace" });

  if (!result.ok) {
    console.error("Import failed:", result.error);
    for (const err of result.validation.errors.slice(0, 20)) {
      console.error(`  [${err.sheet}${err.row ? `:${err.row}` : ""}] ${err.message}`);
    }
    process.exit(1);
  }

  console.log(JSON.stringify(result, null, 2));
}

void main();
