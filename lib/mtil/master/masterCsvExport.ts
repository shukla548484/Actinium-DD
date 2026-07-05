import type { ParsedMasterRepository } from "./parseMasterRepository";

const CSV_SHEETS = [
  "dashboard",
  "repository",
  "projectTemplates",
  "engineeringDomains",
  "masterLibraries",
  "technicalData",
] as const;

export type MasterRepositoryCsvSheet = (typeof CSV_SHEETS)[number];

export function masterRepositoryCsvResponse(
  data: ParsedMasterRepository,
  sheet: string,
): { body: string; filename: string } {
  const normalized = sheet === "projects" ? "projectTemplates" : sheet === "domains" ? "engineeringDomains" : sheet === "libraries" ? "masterLibraries" : sheet === "technical" ? "technicalData" : sheet;

  if (normalized === "dashboard") {
    const lines = [
      "Metric,Value",
      `Release,${data.release ?? ""}`,
      `Library Version,${data.libraryVersion ?? ""}`,
      `Status,${data.status ?? ""}`,
      `Objective,${data.objective ?? ""}`,
      `Target Jobs,${data.targetJobs ?? ""}`,
      `Target Templates,${data.targetTemplates ?? ""}`,
      `Framework Areas,${data.frameworkAreaCount}`,
      `Engineering Domains,${data.engineeringDomainCount}`,
    ];
    return { body: lines.join("\n"), filename: "mtil-master-repo-v12-dashboard.csv" };
  }

  const areaKey = normalized as keyof ParsedMasterRepository["areas"];
  const areas = data.areas[areaKey];
  if (!areas) {
    throw new Error(`Unknown master repository sheet: ${sheet}`);
  }

  const lines = [
    "Repository Area,Status,Sheet",
    ...areas.map((a) => `"${a.area.replace(/"/g, '""')}","${a.status.replace(/"/g, '""')}",${a.sheet}`),
  ];
  return {
    body: lines.join("\n"),
    filename: `mtil-master-repo-v12-${normalized}.csv`,
  };
}

export { CSV_SHEETS as MASTER_REPOSITORY_CSV_SHEETS };
