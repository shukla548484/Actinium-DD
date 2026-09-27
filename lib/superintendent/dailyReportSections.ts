/**
 * Daily progress report sections (module: daily_progress).
 *
 * Legacy mapping (flat → sections):
 * - completedWork → deck_crew.points
 * - plannedWork → appended to deck_crew as "Planned: …" when present
 *   (same section; only applied when sectionsJson has no filled points)
 *
 * Per-section payload prefers `points: DailyReportPoint[]`.
 * Legacy `points: string[]` or `workDone` strings migrate into points on load.
 */

export const DAILY_REPORT_SECTION_KEYS = [
  "deck_crew",
  "engine_crew",
  "third_party",
  "shipyard",
  "painting",
  "class_attendance",
] as const;

export type DailyReportSectionKey = (typeof DAILY_REPORT_SECTION_KEYS)[number];

/** One work-done line: text + optional report/remarks; images link via attachment.pointId. */
export type DailyReportPoint = {
  id: string;
  text: string;
  /** Optional short "report / reference" note. */
  report?: string;
  /** Optional remarks for the point. */
  remarks?: string;
};

export type DailyReportSectionPayload = {
  /** Point-wise work lines (source of truth). */
  points: DailyReportPoint[];
  /**
   * Legacy single blob — migrated into `points` on normalize.
   * Kept on serialize as a joined summary for older readers.
   */
  workDone?: string;
};

export type DailyReportSections = Record<DailyReportSectionKey, DailyReportSectionPayload>;

export const DAILY_REPORT_SECTION_LABELS: Record<DailyReportSectionKey, string> = {
  deck_crew: "Deck Crew",
  engine_crew: "Engine Crew",
  third_party: "Third Party Workshops",
  shipyard: "Shipyard",
  painting: "Hull Painting",
  class_attendance: "Class / Surveyor",
};

/** Max images stored per section (safety cap across all points). */
export const DAILY_REPORT_MAX_IMAGES_PER_SECTION = 48;

/** Max images per work point. */
export const DAILY_REPORT_MAX_IMAGES_PER_POINT = 6;

/** Max report/reference files per work point, separate from photo attachments. */
export const DAILY_REPORT_MAX_DOCUMENTS_PER_POINT = 6;

export function newDailyReportPointId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `pt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function emptyDailyReportPoint(text = "", report = "", remarks = ""): DailyReportPoint {
  return {
    id: newDailyReportPointId(),
    text,
    ...(report.trim() ? { report: report.trim() } : {}),
    ...(remarks.trim() ? { remarks: remarks.trim() } : {}),
  };
}

export function emptySectionPayload(): DailyReportSectionPayload {
  return { points: [], workDone: "" };
}

export function emptyDailyReportSections(): DailyReportSections {
  return {
    deck_crew: emptySectionPayload(),
    engine_crew: emptySectionPayload(),
    third_party: emptySectionPayload(),
    shipyard: emptySectionPayload(),
    painting: emptySectionPayload(),
    class_attendance: emptySectionPayload(),
  };
}

export function isDailyReportSectionKey(value: string): value is DailyReportSectionKey {
  return (DAILY_REPORT_SECTION_KEYS as readonly string[]).includes(value);
}

/** Non-empty trimmed points for a section (keeps id/report). */
export function sectionPoints(section: DailyReportSectionPayload): DailyReportPoint[] {
  return (section.points ?? []).filter((p) => p.text.trim().length > 0);
}

/** Plain text lines for brief overviews / search summaries. */
export function sectionPointTexts(section: DailyReportSectionPayload): string[] {
  return sectionPoints(section).map((p) => p.text.trim());
}

export function sectionHasWork(section: DailyReportSectionPayload): boolean {
  return sectionPoints(section).length > 0;
}

/** Compact joined text (legacy workDone / brief lines). */
export function pointsToWorkDone(points: DailyReportPoint[]): string {
  return points
    .map((p) => p.text.trim())
    .filter((p) => p.length > 0)
    .join("\n");
}

/** Split a legacy workDone blob into points (newline-separated, or one point). */
export function workDoneToPoints(workDone: string): DailyReportPoint[] {
  const trimmed = workDone.trim();
  if (!trimmed) return [];
  const lines = trimmed
    .split(/\n+/)
    .map((l) => l.replace(/^\s*[-•*]\s*/, "").trim())
    .filter((l) => l.length > 0);
  const texts = lines.length > 0 ? lines : [trimmed];
  return texts.map((text) => emptyDailyReportPoint(text));
}

function coercePoint(item: unknown, keepEmpty: boolean): DailyReportPoint | null {
  if (typeof item === "string") {
    const text = item.trim();
    if (!text && !keepEmpty) return null;
    return emptyDailyReportPoint(text);
  }
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const obj = item as { id?: unknown; text?: unknown; report?: unknown; remarks?: unknown };
  const text = typeof obj.text === "string" ? obj.text : "";
  const trimmed = text.trim();
  if (!trimmed && !keepEmpty) return null;
  const id =
    typeof obj.id === "string" && obj.id.trim() ? obj.id.trim() : newDailyReportPointId();
  const report = typeof obj.report === "string" ? obj.report.trim() : "";
  const remarks = typeof obj.remarks === "string" ? obj.remarks.trim() : "";
  return {
    id,
    text: keepEmpty ? text : trimmed,
    ...(report ? { report } : {}),
    ...(remarks ? { remarks } : {}),
  };
}

function asPointArray(value: unknown, keepEmpty: boolean): DailyReportPoint[] | null {
  if (!Array.isArray(value)) return null;
  const out: DailyReportPoint[] = [];
  for (const item of value) {
    const point = coercePoint(item, keepEmpty);
    if (point) out.push(point);
  }
  return out;
}

function normalizeSectionPayload(raw: unknown): DailyReportSectionPayload {
  if (typeof raw === "string") {
    const points = workDoneToPoints(raw);
    return { points, workDone: pointsToWorkDone(points) };
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return emptySectionPayload();
  }
  const obj = raw as { points?: unknown; workDone?: unknown };
  const filled = asPointArray(obj.points, false);
  if (filled && filled.length > 0) {
    return { points: filled, workDone: pointsToWorkDone(filled) };
  }
  if (typeof obj.workDone === "string" && obj.workDone.trim()) {
    const points = workDoneToPoints(obj.workDone);
    return { points, workDone: pointsToWorkDone(points) };
  }
  // Preserve empty point rows from UI drafts only when explicitly empty array.
  const draft = asPointArray(obj.points, true);
  if (draft) {
    return { points: draft, workDone: "" };
  }
  return emptySectionPayload();
}

/** Normalize unknown JSON into the six-section shape (points + legacy workDone). */
export function normalizeDailyReportSections(raw: unknown): DailyReportSections {
  const base = emptyDailyReportSections();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const obj = raw as Record<string, unknown>;
  for (const key of DAILY_REPORT_SECTION_KEYS) {
    if (key in obj) {
      base[key] = normalizeSectionPayload(obj[key]);
    }
  }
  return base;
}

export function sectionsHaveAnyWork(sections: DailyReportSections): boolean {
  return DAILY_REPORT_SECTION_KEYS.some((k) => sectionHasWork(sections[k]));
}

/**
 * Resolve sections for UI/API responses.
 * Prefer sectionsJson; if empty, map legacy completedWork/plannedWork into deck_crew.
 */
export function resolveDailyReportSections(input: {
  sectionsJson: unknown;
  completedWork?: string | null;
  plannedWork?: string | null;
}): DailyReportSections {
  const fromJson = normalizeDailyReportSections(input.sectionsJson);
  if (sectionsHaveAnyWork(fromJson)) return fromJson;

  const completed = input.completedWork?.trim() || "";
  const planned = input.plannedWork?.trim() || "";
  if (!completed && !planned) return fromJson;

  // Legacy → deck_crew (prefer completedWork; append plannedWork as a short note).
  const parts: DailyReportPoint[] = [];
  if (completed) parts.push(...workDoneToPoints(completed));
  if (planned) parts.push(emptyDailyReportPoint(`Planned: ${planned}`));
  return {
    ...fromJson,
    deck_crew: { points: parts, workDone: pointsToWorkDone(parts) },
  };
}

export function countFilledSections(sections: DailyReportSections): number {
  return DAILY_REPORT_SECTION_KEYS.filter((k) => sectionHasWork(sections[k])).length;
}

export function sectionsCompletenessLabel(sections: DailyReportSections): string {
  return `${countFilledSections(sections)}/${DAILY_REPORT_SECTION_KEYS.length}`;
}

/** Calendar-day Date at UTC midnight for uniqueness. */
export function normalizeReportDate(value: string | Date): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  const s = String(value).trim();
  const day = s.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return new Date(`${day}T00:00:00.000Z`);
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    throw new Error("Invalid report date");
  }
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Days elapsed from dock entry (actualStart, else plannedStart) to report date. */
export function daysElapsedSinceDockEntry(
  dockEntry: string | Date | null | undefined,
  reportDate: string | Date,
): number | null {
  if (!dockEntry) return null;
  const entry = normalizeReportDate(dockEntry);
  const report = normalizeReportDate(reportDate);
  const ms = report.getTime() - entry.getTime();
  return Math.max(0, Math.round(ms / (24 * 60 * 60 * 1000)));
}
