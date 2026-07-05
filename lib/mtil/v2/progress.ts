import { getPhase1Stats } from "@/lib/mtil/phases/phase1/generate";
import { getPhase1WorkbookV04Stats } from "@/lib/mtil/phases/phase1/workbookJobLibraryTree";
import { getPhase2Stats } from "@/lib/mtil/phases/phase2/generate";
import { getPhase2WorkbookV05Stats } from "@/lib/mtil/phases/phase2/workbookJobLibraryTree";
import { getPhase3Stats } from "@/lib/mtil/phases/phase3/generate";
import { getPhase3WorkbookV06Stats } from "@/lib/mtil/phases/phase3/workbookJobLibraryTree";
import { getPhase4WorkbookV07Stats } from "@/lib/mtil/phases/phase4/workbookJobLibraryTree";
import { getPhase5WorkbookV08Stats } from "@/lib/mtil/phases/phase5/workbookJobLibraryTree";
import { getPhase6WorkbookV09Stats } from "@/lib/mtil/phases/phase6/workbookJobLibraryTree";
import { getPhase7WorkbookV10Stats } from "@/lib/mtil/phases/phase7/workbookJobLibraryTree";
import { getPhase8WorkbookV11Stats } from "@/lib/mtil/phases/phase8/workbookJobLibraryTree";
import {
  getPhase1ChecklistItemCount,
  getPhase2ChecklistItemCount,
  getPhase3ChecklistItemCount,
} from "@/lib/mtil/checklistLibrary";
import {
  getPhase1MeasurementCount,
  getPhase2MeasurementCount,
  getPhase3MeasurementCount,
} from "@/lib/mtil/measurementLibrary";
import { MTIL_V2_RELEASE_DELIVERABLES } from "./deliverables";
import { MTIL_V2_DOMAIN_REGISTRY } from "./registry";
import {
  MTIL_R0_FRAMEWORK_COMPLETE,
  MTIL_V2_DATABASE_TARGETS,
  MTIL_V2_ENGINE_VERSION,
  MTIL_V2_LIBRARY_VERSION,
} from "./standards";
import type { MtilV2DomainProgress, MtilV2ProgressReport } from "./types";

type R0DomainStats = {
  jobCount: number;
  templateCount: number;
  measurementCount: number;
  checklistItemCount: number;
};

function getR0StatsForPhase(legacyPhaseId: number): R0DomainStats {
  switch (legacyPhaseId) {
    case 1: {
      const matrix = getPhase1Stats();
      const wb = getPhase1WorkbookV04Stats();
      return {
        jobCount: matrix.jobCount + wb.jobCount,
        templateCount: matrix.catalogTemplateCount + wb.catalogTemplateCount,
        measurementCount: getPhase1MeasurementCount() + wb.measurementCount,
        checklistItemCount: getPhase1ChecklistItemCount() + wb.checklistItemCount,
      };
    }
    case 2: {
      const matrix = getPhase2Stats();
      const wb = getPhase2WorkbookV05Stats();
      return {
        jobCount: matrix.jobCount + wb.jobCount,
        templateCount: matrix.catalogTemplateCount + wb.catalogTemplateCount,
        measurementCount: getPhase2MeasurementCount() + wb.measurementCount,
        checklistItemCount: getPhase2ChecklistItemCount() + wb.checklistItemCount,
      };
    }
    case 3: {
      const matrix = getPhase3Stats();
      const wb = getPhase3WorkbookV06Stats();
      return {
        jobCount: matrix.jobCount + wb.jobCount,
        templateCount: matrix.catalogTemplateCount + wb.catalogTemplateCount,
        measurementCount: getPhase3MeasurementCount() + wb.measurementCount,
        checklistItemCount: getPhase3ChecklistItemCount() + wb.checklistItemCount,
      };
    }
    case 4: {
      const wb = getPhase4WorkbookV07Stats();
      return {
        jobCount: wb.jobCount,
        templateCount: wb.catalogTemplateCount,
        measurementCount: wb.measurementCount,
        checklistItemCount: wb.checklistItemCount,
      };
    }
    case 5: {
      const wb = getPhase5WorkbookV08Stats();
      return { jobCount: wb.jobCount, templateCount: wb.catalogTemplateCount, measurementCount: wb.measurementCount, checklistItemCount: wb.checklistItemCount };
    }
    case 6: {
      const wb = getPhase6WorkbookV09Stats();
      return { jobCount: wb.jobCount, templateCount: wb.catalogTemplateCount, measurementCount: wb.measurementCount, checklistItemCount: wb.checklistItemCount };
    }
    case 7: {
      const wb = getPhase7WorkbookV10Stats();
      return { jobCount: wb.jobCount, templateCount: wb.catalogTemplateCount, measurementCount: wb.measurementCount, checklistItemCount: wb.checklistItemCount };
    }
    case 8: {
      const wb = getPhase8WorkbookV11Stats();
      return { jobCount: wb.jobCount, templateCount: wb.catalogTemplateCount, measurementCount: wb.measurementCount, checklistItemCount: wb.checklistItemCount };
    }
    default:
      return { jobCount: 0, templateCount: 0, measurementCount: 0, checklistItemCount: 0 };
  }
}

function pct(actual: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((actual / target) * 100));
}

export function getMtilV2ProgressReport(): MtilV2ProgressReport {
  const domains: MtilV2DomainProgress[] = MTIL_V2_DOMAIN_REGISTRY.map((domain) => {
    const r0 = getR0StatsForPhase(domain.legacyPhaseId);
    return {
      ...domain,
      actualJobCount: r0.jobCount,
      actualTemplateCount: r0.templateCount,
      actualMeasurementCount: r0.measurementCount,
      actualChecklistItemCount: r0.checklistItemCount,
      actualSpareMappingCount: 0,
      actualRfqMappingCount: 0,
      percentJobsComplete: pct(r0.jobCount, domain.targetJobCount.min),
      r0BaselineJobCount: r0.jobCount,
    };
  });

  const actualJobs = domains.reduce((sum, d) => sum + d.actualJobCount, 0);
  const actualTemplates = domains.reduce((sum, d) => sum + d.actualTemplateCount, 0);
  const actualMeasurements = domains.reduce((sum, d) => sum + d.actualMeasurementCount, 0);
  const actualChecklistItems = domains.reduce((sum, d) => sum + d.actualChecklistItemCount, 0);

  return {
    engineVersion: MTIL_V2_ENGINE_VERSION,
    libraryVersion: MTIL_V2_LIBRARY_VERSION,
    r0FrameworkComplete: MTIL_R0_FRAMEWORK_COMPLETE,
    databaseTargets: MTIL_V2_DATABASE_TARGETS,
    deliverables: [...MTIL_V2_RELEASE_DELIVERABLES],
    domains,
    totals: {
      targetJobsMin: MTIL_V2_DATABASE_TARGETS.jobs.min,
      targetJobsMax: MTIL_V2_DATABASE_TARGETS.jobs.max,
      actualJobs,
      actualTemplates,
      actualMeasurements,
      actualChecklistItems,
      actualSpareMappings: 0,
      actualRfqMappings: 0,
      percentJobsToTargetMin: pct(actualJobs, MTIL_V2_DATABASE_TARGETS.jobs.min),
    },
  };
}
