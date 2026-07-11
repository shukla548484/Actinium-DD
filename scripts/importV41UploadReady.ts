#!/usr/bin/env tsx
/**
 * Import V4.1 Validated Upload / RFQ / Budget Ready workbook.
 *
 * Usage:
 *   npm run emdr:import-v41                              # dry-run (default)
 *   npm run emdr:import-v41 -- --apply --limit 50        # sample apply
 *   npm run emdr:import-v41 -- --apply --rollback        # apply then rollback
 *   npm run emdr:import-v41 -- --apply                   # full production apply
 *   npm run emdr:import-v41 -- path/to/workbook.xlsx     # custom file
 */
import {
  importV41UploadReadyFromPath,
  resolveV41UploadReadyPath,
  type V41ImportResult,
} from "@/lib/emdr/v4/importV41UploadReady";

function parseArgs(argv: string[]) {
  const apply = argv.includes("--apply");
  const rollback = argv.includes("--rollback");
  const limitArg = argv.find((a) => a.startsWith("--limit"));
  const limit = limitArg ? Number(limitArg.split("=")[1] ?? argv[argv.indexOf("--limit") + 1]) : undefined;
  const filePath = argv.find((a) => a.endsWith(".xlsx"));
  return {
    mode: apply ? ("apply" as const) : ("dry-run" as const),
    rollback,
    limit: Number.isFinite(limit) ? limit : undefined,
    filePath: filePath ? resolveV41UploadReadyPath(filePath) : resolveV41UploadReadyPath(),
  };
}

function printResult(result: V41ImportResult) {
  console.log(`V4.1 import ${result.mode}${result.applied?.rolledBack ? " (rolled back)" : ""}`);
  console.log("File:", result.filePath);
  console.log("Export version:", result.exportVersion ?? "(unknown)");
  console.log("\nSheet row counts:");
  for (const [sheet, count] of Object.entries(result.parsed.sheetRowCounts)) {
    console.log(`  ${sheet}: ${count}`);
  }

  console.log("\nValidation summary:");
  console.log(JSON.stringify(result.validation.summary, null, 2));

  if (result.validation.errors.length > 0) {
    console.log(`\nValidation errors (${result.validation.errors.length}):`);
    for (const err of result.validation.errors.slice(0, 20)) {
      console.log(`  [${err.sheet}${err.row ? `:${err.row}` : ""}] ${err.message}`);
    }
    if (result.validation.errors.length > 20) {
      console.log(`  ... and ${result.validation.errors.length - 20} more`);
    }
  }

  if (result.validation.warnings.length > 0) {
    console.log(`\nValidation warnings (${result.validation.warnings.length}):`);
    for (const warn of result.validation.warnings.slice(0, 10)) {
      console.log(`  [${warn.sheet}${warn.row ? `:${warn.row}` : ""}] ${warn.message}`);
    }
    if (result.validation.warnings.length > 10) {
      console.log(`  ... and ${result.validation.warnings.length - 10} more`);
    }
  }

  if (result.dryRun) {
    console.log("\nDry-run import plan:");
    console.log(JSON.stringify(result.dryRun, null, 2));
  }

  if (result.applied) {
    console.log("\nApplied counts:");
    console.log(JSON.stringify(result.applied, null, 2));
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  console.log("Options:", options);

  const result = await importV41UploadReadyFromPath(options.filePath, {
    mode: options.mode,
    limit: options.limit,
    rollback: options.rollback,
  });

  printResult(result);

  if (!result.ok) {
    console.error("\nImport failed:", result.error);
    process.exit(1);
  }
}

void main();
