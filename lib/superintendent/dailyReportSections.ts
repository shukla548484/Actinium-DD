/**
 * Daily progress report sections (module: daily_progress).
 *
 * Legacy mapping (flat → sections):
 * - completedWork → deck_crew.workDone
 * - plannedWork → appended to deck_crew as "Planned: …" when present
 *   (same section; only applied when sectionsJson has no filled workDone)
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

export type DailyReportSectionPayload = {
  workDone: string;
};

export type DailyReportSections = Record<DailyReportSectionKey, DailyReportSectionPayload>;

export const DAILY_REPORT_SECTION_LABELS: Record<DailyReportSectionKey, string> = {
  deck_crew: "Deck crew",
  engine_crew: "Engine crew",
  third_party: "Third party",
  shipyard: "Shipyard",
  painting: "Painting",
  class_attendance: "Class attendance",
};

/** Max images stored per section. */
export const DAILY_REPORT_MAX_IMAGES_PER_SECTION = 8;

export function emptyDailyReportSections(): DailyReportSections {
  return {
    deck_crew: { workDone: "" },
    engine_crew: { workDone: "" },
    third_party: { workDone: "" },
    shipyard: { workDone: "" },
    painting: { workDone: "" },
    class_attendance: { workDone: "" },
  };
}

export function isDailyReportSectionKey(value: string): value is DailyReportSectionKey {
  return (DAILY_REPORT_SECTION_KEYS as readonly string[]).includes(value);
}

function asWorkDone(value: unknown): string {
  if (typeof value !== "string") return "";
  return value;
}

/** Normalize unknown JSON into the six-section shape. */
export function normalizeDailyReportSections(raw: unknown): DailyReportSections {
  const base = emptyDailyReportSections();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const obj = raw as Record<string, unknown>;
  for (const key of DAILY_REPORT_SECTION_KEYS) {
    const section = obj[key];
    if (section && typeof section === "object" && !Array.isArray(section)) {
      const workDone = asWorkDone((section as { workDone?: unknown }).workDone);
      base[key] = { workDone };
    } else if (typeof section === "string") {
      base[key] = { workDone: section };
    }
  }
  return base;
}

export function sectionsHaveAnyWork(sections: DailyReportSections): boolean {
  return DAILY_REPORT_SECTION_KEYS.some((k) => sections[k].workDone.trim().length > 0);
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
  const parts: string[] = [];
  if (completed) parts.push(completed);
  if (planned) parts.push(`Planned: ${planned}`);
  return {
    ...fromJson,
    deck_crew: { workDone: parts.join("\n\n") },
  };
}

export function countFilledSections(sections: DailyReportSections): number {
  return DAILY_REPORT_SECTION_KEYS.filter((k) => sections[k].workDone.trim().length > 0).length;
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
