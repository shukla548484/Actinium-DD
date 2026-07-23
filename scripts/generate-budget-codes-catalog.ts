/**
 * Generate data/budget-codes.json from data/all-budget-codes.xlsx (master).
 *
 * Usage: npx tsx scripts/generate-budget-codes-catalog.ts
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as XLSX from "xlsx";

type BudgetCodeRow = {
  scope: "NORMAL" | "DRY_DOCK";
  level: 1 | 2;
  code: string;
  name: string;
  parentCode: string | null;
  parentName: string | null;
  fundType: string | null;
  displayOrder: number;
  active: boolean;
};

const ROOT = path.resolve(__dirname, "..");
const XLSX_PATH = path.join(ROOT, "data", "all-budget-codes.xlsx");
const OUT_PATH = path.join(ROOT, "data", "budget-codes.json");

function cellStr(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function isActive(v: unknown): boolean {
  const s = cellStr(v).toUpperCase();
  return s === "" || s === "Y" || s === "YES" || s === "TRUE" || s === "1";
}

function loadAllCodes(wb: XLSX.WorkBook): BudgetCodeRow[] {
  const sheet = wb.Sheets["All Codes"];
  if (!sheet) throw new Error('Missing sheet "All Codes"');
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const out: BudgetCodeRow[] = [];
  for (const r of rows) {
    const code = cellStr(r["Code"]);
    if (!code) continue;
    const levelRaw = Number(r["Level"]);
    const level = levelRaw === 1 ? 1 : 2;
    const scopeRaw = cellStr(r["Budget Scope"]).toUpperCase();
    const scope = scopeRaw === "DRY_DOCK" ? "DRY_DOCK" : "NORMAL";
    out.push({
      scope,
      level,
      code,
      name: cellStr(r["Name"]) || code,
      parentCode: cellStr(r["Parent Code"]) || null,
      parentName: cellStr(r["Parent Name"]) || null,
      fundType: cellStr(r["Fund Type"]) || null,
      displayOrder: Number(r["Display Order"]) || Number(code.replace(/\D/g, "")) || 0,
      active: isActive(r["Active"]),
    });
  }
  return out;
}

/** Dry Dock sheet is L1/L2 pairs only (not in All Codes). */
function loadDryDockPairs(wb: XLSX.WorkBook): BudgetCodeRow[] {
  const sheet = wb.Sheets["Dry Dock"];
  if (!sheet) return [];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const byCode = new Map<string, BudgetCodeRow>();

  for (const r of rows) {
    const l1 = cellStr(r["Level 1 Code"]);
    const l1Name = cellStr(r["Level 1 Category"]);
    const l2 = cellStr(r["Level 2 Code"]);
    const l2Name = cellStr(r["Level 2 Category"]);
    const active = isActive(r["Active (Y/N)"]);
    if (!l1 || !l2) continue;

    if (!byCode.has(l1)) {
      byCode.set(l1, {
        scope: "DRY_DOCK",
        level: 1,
        code: l1,
        name: l1Name || l1,
        parentCode: null,
        parentName: null,
        fundType: "CAPEX",
        displayOrder: Number(l1.replace(/\D/g, "")) || 0,
        active: true,
      });
    }
    byCode.set(l2, {
      scope: "DRY_DOCK",
      level: 2,
      code: l2,
      name: l2Name || l2,
      parentCode: l1,
      parentName: l1Name || l1,
      fundType: "CAPEX",
      displayOrder: Number(l2.replace(/\D/g, "")) || 0,
      active,
    });
  }

  return [...byCode.values()];
}

function main() {
  if (!fs.existsSync(XLSX_PATH)) {
    throw new Error(`Missing Excel master at ${XLSX_PATH}`);
  }
  const wb = XLSX.read(fs.readFileSync(XLSX_PATH), { type: "buffer" });
  const normal = loadAllCodes(wb);
  const dryDock = loadDryDockPairs(wb);

  const byKey = new Map<string, BudgetCodeRow>();
  for (const row of [...normal, ...dryDock]) {
    byKey.set(`${row.scope}::${row.code}`, row);
  }
  const codes = [...byKey.values()].sort((a, b) => {
    if (a.scope !== b.scope) return a.scope.localeCompare(b.scope);
    if (a.level !== b.level) return a.level - b.level;
    return a.displayOrder - b.displayOrder || a.code.localeCompare(b.code);
  });

  const payload = {
    source: "data/all-budget-codes.xlsx",
    generatedAt: new Date().toISOString(),
    counts: {
      total: codes.length,
      normal: codes.filter((c) => c.scope === "NORMAL").length,
      dryDock: codes.filter((c) => c.scope === "DRY_DOCK").length,
      level1: codes.filter((c) => c.level === 1).length,
      level2: codes.filter((c) => c.level === 2).length,
      active: codes.filter((c) => c.active).length,
    },
    codes,
  };

  fs.writeFileSync(OUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(
    `Wrote ${OUT_PATH} — ${payload.counts.total} codes ` +
      `(NORMAL ${payload.counts.normal}, DRY_DOCK ${payload.counts.dryDock}; ` +
      `L1 ${payload.counts.level1}, L2 ${payload.counts.level2})`,
  );
}

main();
