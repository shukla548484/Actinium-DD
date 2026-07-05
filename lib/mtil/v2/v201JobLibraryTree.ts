import fs from "node:fs";
import type { JobLibrarySeedNode } from "@/lib/vessel/jobLibrary/catalog";
import { buildV201CombinedJobLibraryTree } from "@/lib/mtil/v2/import/buildV2SprintJobLibraryTree";
import { parseV2SprintWorkbookFileIfExists } from "@/lib/mtil/v2/import/parseSprintWorkbook";
import { V2_SPRINT_REGISTRY, sprintWorkbookPath } from "@/lib/mtil/v2/sprints/registry";

export function generateV201CombinedJobLibraryTree(): JobLibrarySeedNode | null {
  const entries = V2_SPRINT_REGISTRY.map((sprint) => ({
    sprint,
    data: parseV2SprintWorkbookFileIfExists(sprintWorkbookPath(sprint)),
  })).filter((e) => e.data.masterJobs.length > 0);

  if (entries.length === 0) return null;
  return buildV201CombinedJobLibraryTree(entries);
}

export function getV201CombinedWorkbookStats() {
  const entries = V2_SPRINT_REGISTRY.map((sprint) => ({
    sprint,
    data: parseV2SprintWorkbookFileIfExists(sprintWorkbookPath(sprint)),
  })).filter((e) => e.data.masterJobs.length > 0);

  return {
    release: "V2.0.1",
    sprintCount: entries.length,
    jobCount: entries.reduce((sum, e) => sum + e.data.masterJobs.length, 0),
    catalogTemplateCount: entries.reduce((sum, e) => sum + e.data.templates.length, 0),
    measurementCount: entries.reduce((sum, e) => sum + e.data.measurements.length, 0),
    checklistItemCount: entries.reduce((sum, e) => sum + e.data.checklistItems.length, 0),
    workbookPresent: entries.some((e) => fs.existsSync(sprintWorkbookPath(e.sprint))),
  };
}
