import * as XLSX from "xlsx";
import { JOB_CATEGORIES } from "@/lib/superintendent/constants";

export type ParsedJobRow = {
  title: string;
  category: string;
  jobCode: string | null;
  description: string | null;
  priority: "low" | "medium" | "high" | "critical";
  status: "planned" | "in_progress" | "pending_approval" | "completed" | "closed";
  budgetAmount: number | null;
};

function cellStr(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function pickField(row: Record<string, unknown>, keys: string[]): string {
  for (const key of Object.keys(row)) {
    const lower = key.toLowerCase();
    if (keys.some((k) => lower.includes(k))) return cellStr(row[key]);
  }
  return "";
}

function normalizeCategory(raw: string): string {
  const lower = raw.toLowerCase();
  const hit = JOB_CATEGORIES.find((c) => lower.includes(c.toLowerCase()));
  if (hit) return hit;
  if (lower.includes("dock")) return "docking";
  if (lower.includes("paint") || lower.includes("hull")) return "painting";
  if (lower.includes("steel")) return "steel";
  if (lower.includes("main engine") || lower === "me") return "ME";
  if (lower.includes("aux") || lower === "ae") return "AE";
  return raw.slice(0, 48) || "miscellaneous";
}

function normalizePriority(raw: string): ParsedJobRow["priority"] {
  const lower = raw.toLowerCase();
  if (lower.includes("crit")) return "critical";
  if (lower.includes("high")) return "high";
  if (lower.includes("low")) return "low";
  return "medium";
}

export function parseJobImportRows(rows: Record<string, unknown>[]): ParsedJobRow[] {
  const parsed: ParsedJobRow[] = [];

  for (const row of rows) {
    const title =
      pickField(row, ["title", "job", "description", "item", "work"]) ||
      cellStr(Object.values(row)[0]);
    if (!title) continue;

    const categoryRaw = pickField(row, ["category", "cat", "trade", "discipline"]);
    const jobCode = pickField(row, ["code", "job no", "job_no", "ref"]) || null;
    const description = pickField(row, ["detail", "scope", "remarks", "note"]) || null;
    const priorityRaw = pickField(row, ["priority", "prio"]);
    const budgetRaw = pickField(row, ["budget", "amount", "cost"]);

    let budgetAmount: number | null = null;
    if (budgetRaw) {
      const n = Number(budgetRaw.replace(/[,$\s]/g, ""));
      if (Number.isFinite(n)) budgetAmount = n;
    }

    parsed.push({
      title,
      category: normalizeCategory(categoryRaw || title),
      jobCode,
      description: description !== title ? description : null,
      priority: normalizePriority(priorityRaw),
      status: "planned",
      budgetAmount,
    });
  }

  return parsed;
}

export function readJobImportWorkbook(buffer: ArrayBuffer): ParsedJobRow[] {
  const workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  return parseJobImportRows(rows);
}
