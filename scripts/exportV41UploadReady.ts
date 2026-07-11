#!/usr/bin/env tsx
/**
 * Export V4.1 Validated Upload / RFQ / Budget Ready workbook.
 *
 * Usage:
 *   npx tsx scripts/exportV41UploadReady.ts [--overlay path-to-v4.xlsx] [--out path]
 */
import path from "node:path";
import { buildV41UploadReadyWorkbook } from "@/lib/emdr/v4/buildV41UploadReadyWorkbook";
import {
  EMDR_V41_EXPORT_DOWNLOADS_PATH,
  EMDR_V41_EXPORT_REPO_PATH,
} from "@/lib/emdr/paths";

function parseArgs(argv: string[]) {
  let overlayPath: string | undefined;
  const outputPaths: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--overlay" && argv[i + 1]) {
      overlayPath = path.resolve(argv[++i]!);
      continue;
    }
    if (arg === "--out" && argv[i + 1]) {
      outputPaths.push(path.resolve(argv[++i]!));
      continue;
    }
  }

  if (outputPaths.length === 0) {
    outputPaths.push(EMDR_V41_EXPORT_REPO_PATH, EMDR_V41_EXPORT_DOWNLOADS_PATH);
  }

  return { overlayPath, outputPaths };
}

function main() {
  const { overlayPath, outputPaths } = parseArgs(process.argv.slice(2));

  const result = buildV41UploadReadyWorkbook({
    v40OverlayPath: overlayPath,
    outputPaths,
  });

  console.log("V4.1 export complete");
  console.log("Repo release:", result.repoRelease);
  console.log("V4 overlay:", result.overlayPath ?? "(none)");
  console.log("Output files:");
  for (const file of result.outputPaths) {
    console.log(" -", file);
  }
  console.log("\nSheet row counts:");
  for (const [sheet, count] of Object.entries(result.sheetRowCounts)) {
    console.log(`  ${sheet}: ${count}`);
  }
  console.log("\nValidation stats:");
  console.log(JSON.stringify(result.validationStats, null, 2));
}

main();
