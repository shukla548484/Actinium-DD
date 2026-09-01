import {
  formatPaintingInputScopePreview,
  isPaintingInputJob,
} from "@/lib/superintendent/paintingScopeJobs";
import {
  formatSeaValveInputScopePreview,
  isSeaValveInputJob,
} from "@/lib/superintendent/seaValveScopeJobs";
import {
  formatSteelRenewalSummary,
  isSteelRenewalJob,
  parseSteelRenewalScope,
} from "@/lib/superintendent/steelRenewalScope";
import {
  formatTankInspectionSummary,
  isTankInspectionJob,
  parseTankInspectionScope,
} from "@/lib/superintendent/tankInspectionScope";
import {
  formatThicknessMeasurementSummary,
  isThicknessMeasurementJob,
  parseThicknessMeasurementScope,
} from "@/lib/superintendent/thicknessMeasurementScope";

type ScopeJob = {
  title?: string | null;
  category?: string | null;
  workshop?: string | null;
  description?: string | null;
};

function stripScopeTags(description: string): string {
  return description
    .split("\n")
    .filter((line) => !line.trim().startsWith("["))
    .join("\n")
    .trim();
}

/** Compact scope summary for tables — never returns multi-paragraph boilerplate. */
export function formatJobScopePreview(job: ScopeJob): string {
  const description = job.description ?? "";

  if (isSteelRenewalJob(job)) {
    return formatSteelRenewalSummary(parseSteelRenewalScope(description));
  }
  if (isThicknessMeasurementJob(job)) {
    return formatThicknessMeasurementSummary(parseThicknessMeasurementScope(description));
  }
  if (isTankInspectionJob(job)) {
    return formatTankInspectionSummary(parseTankInspectionScope(description));
  }
  if (isPaintingInputJob(description)) {
    const preview = formatPaintingInputScopePreview(description);
    if (preview) return preview;
  }
  if (isSeaValveInputJob(job)) {
    const preview = formatSeaValveInputScopePreview(description);
    if (preview) return preview;
  }

  const stripped = stripScopeTags(description);
  if (!stripped) return "";

  const firstLine = stripped.split("\n").find((line) => line.trim())?.trim() ?? "";
  if (firstLine.length <= 120) return firstLine;
  return `${firstLine.slice(0, 117)}…`;
}

export function jobScopeIsDefined(job: ScopeJob): boolean {
  const preview = formatJobScopePreview(job);
  if (!preview) return false;
  return !/not entered yet/i.test(preview);
}
