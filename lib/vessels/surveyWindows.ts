/** Class survey cycle helpers from last docking / intermediate dates. */

export type SurveyWindowRange = {
  start: string; // yyyy-MM-dd
  end: string;
  due: string;
};

export type VesselSurveyStatus = {
  inIntermediateRange: boolean;
  inDockingRange: boolean;
  /** Highest-priority active window. */
  activeWindow: "docking" | "intermediate" | "none" | "unknown";
  label: string;
  message: string;
  intermediateWindow: SurveyWindowRange | null;
  dockingWindow: SurveyWindowRange | null;
  nextIntermediateDue: string | null;
  nextDockingDue: string | null;
};

function parseDay(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  const raw = value.trim();
  if (!raw) return null;
  const iso = raw.includes("T") ? raw.slice(0, 10) : raw;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
}

function addMonths(date: Date, months: number): Date {
  const out = new Date(date.getTime());
  out.setUTCMonth(out.getUTCMonth() + months);
  return out;
}

function toIsoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function inRange(asOf: Date, start: Date, end: Date): boolean {
  const t = asOf.getTime();
  return t >= start.getTime() && t <= end.getTime();
}

/**
 * Intermediate survey: ~2.5 years after last docking (±6 months → months 24–36).
 * Docking / special survey: ~5 years after last docking (±6 months → months 54–66).
 */
export function computeVesselSurveyStatus(input: {
  lastDockingDate?: string | Date | null;
  lastIntermediateSurveyDate?: string | Date | null;
  asOf?: string | Date | null;
}): VesselSurveyStatus {
  const asOf = parseDay(input.asOf) ?? parseDay(new Date())!;
  const lastDocking = parseDay(input.lastDockingDate);
  const lastIntermediate = parseDay(input.lastIntermediateSurveyDate);

  if (!lastDocking && !lastIntermediate) {
    return {
      inIntermediateRange: false,
      inDockingRange: false,
      activeWindow: "unknown",
      label: "Survey dates needed",
      message:
        "Enter last intermediate survey and docking dates to detect survey windows automatically.",
      intermediateWindow: null,
      dockingWindow: null,
      nextIntermediateDue: null,
      nextDockingDue: null,
    };
  }

  // Anchor cycle on last docking when present; otherwise estimate from intermediate (+30m ≈ mid-cycle).
  const cycleStart = lastDocking ?? addMonths(lastIntermediate!, -30);

  const intermediateDue = addMonths(cycleStart, 30);
  const intermediateStart = addMonths(cycleStart, 24);
  const intermediateEnd = addMonths(cycleStart, 36);

  const dockingDue = addMonths(cycleStart, 60);
  const dockingStart = addMonths(cycleStart, 54);
  const dockingEnd = addMonths(cycleStart, 66);

  const intermediateWindow: SurveyWindowRange = {
    start: toIsoDay(intermediateStart),
    end: toIsoDay(intermediateEnd),
    due: toIsoDay(intermediateDue),
  };
  const dockingWindow: SurveyWindowRange = {
    start: toIsoDay(dockingStart),
    end: toIsoDay(dockingEnd),
    due: toIsoDay(dockingDue),
  };

  const inDockingRange = inRange(asOf, dockingStart, dockingEnd);
  // Intermediate window only if docking window is not already open (docking takes priority).
  const inIntermediateRange =
    !inDockingRange && inRange(asOf, intermediateStart, intermediateEnd);

  let activeWindow: VesselSurveyStatus["activeWindow"] = "none";
  let label = "Outside survey windows";
  let message = `Next intermediate due ${intermediateWindow.due}; next docking due ${dockingWindow.due}.`;

  if (inDockingRange) {
    activeWindow = "docking";
    label = "In docking survey window";
    message = `Vessel is in the docking / special survey window (${dockingWindow.start} → ${dockingWindow.end}). Due ${dockingWindow.due}.`;
  } else if (inIntermediateRange) {
    activeWindow = "intermediate";
    label = "In intermediate survey window";
    message = `Vessel is in the intermediate survey window (${intermediateWindow.start} → ${intermediateWindow.end}). Due ${intermediateWindow.due}.`;
  }

  return {
    inIntermediateRange,
    inDockingRange,
    activeWindow,
    label,
    message,
    intermediateWindow,
    dockingWindow,
    nextIntermediateDue: intermediateWindow.due,
    nextDockingDue: dockingWindow.due,
  };
}

/** Next docking due date (5 years after last docking), for persistence on vessel. */
export function deriveNextDryDockDue(
  lastDockingDate: string | Date | null | undefined,
): Date | null {
  const last = parseDay(lastDockingDate);
  if (!last) return null;
  return addMonths(last, 60);
}

export function parseOptionalDateInput(
  value: string | Date | null | undefined,
): Date | null {
  return parseDay(value);
}
