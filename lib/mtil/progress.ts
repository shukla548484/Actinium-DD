import type { MtilPhaseMeta } from "./types";
import { getPhase1Stats } from "./phases/phase1/generate";
import { getPhase1WorkbookV04Stats } from "./phases/phase1/workbookJobLibraryTree";
import { getPhase2Stats } from "./phases/phase2/generate";
import { getPhase2WorkbookV05Stats } from "./phases/phase2/workbookJobLibraryTree";
import { getPhase3Stats } from "./phases/phase3/generate";
import { getPhase3WorkbookV06Stats } from "./phases/phase3/workbookJobLibraryTree";
import { getPhase4WorkbookV07Stats } from "./phases/phase4/workbookJobLibraryTree";
import { getPhase5WorkbookV08Stats } from "./phases/phase5/workbookJobLibraryTree";
import {
  getPhase1ChecklistItemCount,
  getPhase2ChecklistItemCount,
  getPhase3ChecklistItemCount,
} from "./checklistLibrary";
import {
  getPhase1MeasurementCount,
  getPhase2MeasurementCount,
  getPhase3MeasurementCount,
} from "./measurementLibrary";
import { MTIL_ENGINE_VERSION } from "./standards";
import {
  listDynamicTemplateKeys,
  listPhase1CatalogTemplateKeys,
  listPhase2CatalogTemplateKeys,
  listPhase3CatalogTemplateKeys,
} from "./dynamicTemplateEngine";

export const MTIL_PHASE_REGISTRY: MtilPhaseMeta[] = [
  {
    id: 0,
    slug: "standards",
    name: "Standards, IDs & Workbook Schema",
    status: "completed",
    targetJobCount: { min: 0, max: 0 },
    description: "v0.2 commercial IDs, Excel workbook schema, engine architecture.",
  },
  {
    id: 1,
    slug: "main-propulsion",
    name: "Main Propulsion Systems",
    status: "completed",
    targetJobCount: { min: 400, max: 600 },
    description: "Generated matrix (620) + Engineering Repository v0.4 workbook (140 jobs, TMP-ENG-ME).",
  },
  {
    id: 2,
    slug: "auxiliary",
    name: "Auxiliary Machinery",
    status: "completed",
    targetJobCount: { min: 400, max: 600 },
    description: "Generated matrix (458) + Engineering Repository v0.5 workbook (187 jobs, TMP-ENG-AUX).",
  },
  {
    id: 3,
    slug: "pumps-valves-piping",
    name: "Pumps, Valves & Piping",
    status: "completed",
    targetJobCount: { min: 300, max: 500 },
    description: "Generated matrix (532) + Engineering Repository v0.6 workbook (215 jobs, TMP-PVP).",
  },
  { id: 4, slug: "deck-cargo", name: "Deck Machinery & Cargo Systems", status: "completed", targetJobCount: { min: 300, max: 500 }, description: "Engineering Repository v0.7 workbook (151 jobs, TMP-DECK)." },
  { id: 5, slug: "hull-steel", name: "Hull, Steel & Coatings", status: "in_progress", targetJobCount: { min: 400, max: 600 }, description: "Engineering Repository v0.8 initialized (MTIL-v0.8) — schema ready, jobs pending." },
  { id: 6, slug: "electrical", name: "Electrical, Automation & Navigation", status: "pending", targetJobCount: { min: 400, max: 600 }, description: "" },
  { id: 7, slug: "safety-accommodation", name: "Safety & Accommodation", status: "pending", targetJobCount: { min: 200, max: 400 }, description: "" },
  { id: 8, slug: "dynamic-templates", name: "Dynamic Templates (cross-cutting)", status: "in_progress", targetJobCount: { min: 250, max: 250 }, description: "Template engine live; expanding template library per phase." },
  { id: 9, slug: "rfq-cost", name: "RFQ, Cost Codes & Quote Mapping", status: "pending", targetJobCount: { min: 0, max: 0 }, description: "" },
  { id: 10, slug: "ai-knowledge", name: "AI Knowledge Base & Final Database", status: "pending", targetJobCount: { min: 5000, max: 5000 }, description: "" },
];

function enrichPhase(p: MtilPhaseMeta) {
  if (p.id === 1) {
    const matrix = getPhase1Stats();
    const v04 = getPhase1WorkbookV04Stats();
    return {
      ...p,
      actualJobCount: matrix.jobCount + v04.jobCount,
      catalogTemplateCount: matrix.catalogTemplateCount + v04.catalogTemplateCount,
      dynamicTemplateCount: matrix.dynamicTemplateCount + v04.dynamicTemplateCount,
      systemCount: matrix.systemCount + v04.systemCount,
      componentCount: matrix.componentCount + v04.componentCount,
      measurementCount: getPhase1MeasurementCount() + v04.measurementCount,
      checklistItemCount: getPhase1ChecklistItemCount() + v04.checklistItemCount,
      workbookV04JobCount: v04.jobCount,
      workbookV04Version: v04.libraryVersion,
    };
  }
  if (p.id === 2) {
    const matrix = getPhase2Stats();
    const v05 = getPhase2WorkbookV05Stats();
    return {
      ...p,
      actualJobCount: matrix.jobCount + v05.jobCount,
      catalogTemplateCount: matrix.catalogTemplateCount + v05.catalogTemplateCount,
      dynamicTemplateCount: matrix.dynamicTemplateCount + v05.dynamicTemplateCount,
      systemCount: matrix.systemCount + v05.systemCount,
      componentCount: matrix.componentCount + v05.componentCount,
      measurementCount: getPhase2MeasurementCount() + v05.measurementCount,
      checklistItemCount: getPhase2ChecklistItemCount() + v05.checklistItemCount,
      workbookV05JobCount: v05.jobCount,
      workbookV05Version: v05.libraryVersion,
    };
  }
  if (p.id === 3) {
    const matrix = getPhase3Stats();
    const v06 = getPhase3WorkbookV06Stats();
    return {
      ...p,
      actualJobCount: matrix.jobCount + v06.jobCount,
      catalogTemplateCount: matrix.catalogTemplateCount + v06.catalogTemplateCount,
      dynamicTemplateCount: matrix.dynamicTemplateCount + v06.dynamicTemplateCount,
      systemCount: matrix.systemCount + v06.systemCount,
      componentCount: matrix.componentCount + v06.componentCount,
      measurementCount: getPhase3MeasurementCount() + v06.measurementCount,
      checklistItemCount: getPhase3ChecklistItemCount() + v06.checklistItemCount,
      workbookV06JobCount: v06.jobCount,
      workbookV06Version: v06.libraryVersion,
    };
  }
  if (p.id === 4) {
    const v07 = getPhase4WorkbookV07Stats();
    return {
      ...p,
      actualJobCount: v07.jobCount,
      catalogTemplateCount: v07.catalogTemplateCount,
      dynamicTemplateCount: v07.dynamicTemplateCount,
      systemCount: v07.systemCount,
      componentCount: v07.componentCount,
      measurementCount: v07.measurementCount,
      checklistItemCount: v07.checklistItemCount,
      workbookV07JobCount: v07.jobCount,
      workbookV07Version: v07.libraryVersion,
    };
  }
  if (p.id === 5) {
    const v08 = getPhase5WorkbookV08Stats();
    return {
      ...p,
      actualJobCount: v08.jobCount,
      catalogTemplateCount: v08.catalogTemplateCount,
      dynamicTemplateCount: v08.dynamicTemplateCount,
      systemCount: v08.systemCount,
      componentCount: v08.componentCount,
      measurementCount: v08.measurementCount,
      checklistItemCount: v08.checklistItemCount,
      workbookV08JobCount: v08.jobCount,
      workbookV08Version: v08.libraryVersion,
      initializedOnly: v08.initializedOnly,
    };
  }
  return p;
}

export function getMtilProgressReport() {
  const phase1 = getPhase1Stats();
  const phase1V04 = getPhase1WorkbookV04Stats();
  const phase2 = getPhase2Stats();
  const phase2V05 = getPhase2WorkbookV05Stats();
  const phase3 = getPhase3Stats();
  const phase3V06 = getPhase3WorkbookV06Stats();
  const phase4V07 = getPhase4WorkbookV07Stats();
  const phase5V08 = getPhase5WorkbookV08Stats();
  const workbookTemplateCount =
    phase1V04.catalogTemplateCount +
    phase2V05.catalogTemplateCount +
    phase3V06.catalogTemplateCount +
    phase4V07.catalogTemplateCount +
    phase5V08.catalogTemplateCount;

  return {
    engineVersion: MTIL_ENGINE_VERSION,
    phases: MTIL_PHASE_REGISTRY.map(enrichPhase),
    totals: {
      catalogTemplates:
        listPhase1CatalogTemplateKeys().length +
        listPhase2CatalogTemplateKeys().length +
        listPhase3CatalogTemplateKeys().length +
        workbookTemplateCount,
      dynamicTemplatesRegistered: listDynamicTemplateKeys().length,
      phase1JobsGenerated: phase1.jobCount + phase1V04.jobCount,
      phase1MatrixJobs: phase1.jobCount,
      phase1WorkbookV04Jobs: phase1V04.jobCount,
      phase2JobsGenerated: phase2.jobCount + phase2V05.jobCount,
      phase2MatrixJobs: phase2.jobCount,
      phase2WorkbookV05Jobs: phase2V05.jobCount,
      phase3JobsGenerated: phase3.jobCount + phase3V06.jobCount,
      phase3MatrixJobs: phase3.jobCount,
      phase3WorkbookV06Jobs: phase3V06.jobCount,
      phase4JobsGenerated: phase4V07.jobCount,
      phase4WorkbookV07Jobs: phase4V07.jobCount,
      phase5JobsGenerated: phase5V08.jobCount,
      phase5WorkbookV08Jobs: phase5V08.jobCount,
      phase5InitializedOnly: phase5V08.initializedOnly,
      totalJobsGenerated:
        phase1.jobCount +
        phase1V04.jobCount +
        phase2.jobCount +
        phase2V05.jobCount +
        phase3.jobCount +
        phase3V06.jobCount +
        phase4V07.jobCount +
        phase5V08.jobCount,
      phase1Measurements: getPhase1MeasurementCount() + phase1V04.measurementCount,
      phase2Measurements: getPhase2MeasurementCount() + phase2V05.measurementCount,
      phase3Measurements: getPhase3MeasurementCount() + phase3V06.measurementCount,
      phase4Measurements: phase4V07.measurementCount,
      phase5Measurements: phase5V08.measurementCount,
      phase1ChecklistItems: getPhase1ChecklistItemCount() + phase1V04.checklistItemCount,
      phase2ChecklistItems: getPhase2ChecklistItemCount() + phase2V05.checklistItemCount,
      phase3ChecklistItems: getPhase3ChecklistItemCount() + phase3V06.checklistItemCount,
      phase4ChecklistItems: phase4V07.checklistItemCount,
      phase5ChecklistItems: phase5V08.checklistItemCount,
    },
  };
}
