import path from "node:path";
import fs from "node:fs";
import { emdrWorkbookPath, MTIL_V2_WORKBOOKS_DIR } from "@/lib/emdr/paths";

export type V2SprintDefinition = {
  id: string;
  release: "V2.0.1";
  sprintCode: string;
  name: string;
  systemName: string;
  filename: string;
  jobIdPrefix: string;
  jobIdPattern: string;
  /** Pre-v1.0 workbook prefix — normalized to canonical on import. */
  legacyJobIdPattern?: string;
  sampleTemplateId: string;
  legacySampleTemplateId?: string;
};

const V2_DATA_DIR = MTIL_V2_WORKBOOKS_DIR;

export const MTIL_V201_TREE_CODE = "mtil_v201_main_propulsion";
export const MTIL_V201_MTIL_PHASE = 201;

export const V2_SPRINT_REGISTRY: V2SprintDefinition[] = [
  {
    id: "v201-s1",
    release: "V2.0.1",
    sprintCode: "ME-CYU",
    name: "Main Engine Cylinder Unit",
    systemName: "Cylinder Unit",
    filename: "Actinium_SM_MTIL_V2_0_1_Sprint1_Main_Engine_Cylinder_Unit.xlsx",
    jobIdPrefix: "ME-CYU",
    jobIdPattern: "JOBS-ME-CYU-",
    legacyJobIdPattern: "JOB-ME-CYU-",
    sampleTemplateId: "TMPL-ME-CYU-001",
    legacySampleTemplateId: "TMP-ME-CYU-001",
  },
  {
    id: "v201-s2",
    release: "V2.0.1",
    sprintCode: "ME-FIS",
    name: "Main Engine Fuel Injection System",
    systemName: "Fuel Injection System",
    filename: "Actinium_SM_MTIL_V2_0_1_Sprint2_Main_Engine_Fuel_Injection_System.xlsx",
    jobIdPrefix: "ME-FIS",
    jobIdPattern: "JOBS-ME-FIS-",
    legacyJobIdPattern: "JOB-ME-FIS-",
    sampleTemplateId: "TMPL-ME-FIS-001",
    legacySampleTemplateId: "TMP-ME-FIS-001",
  },
  {
    id: "v201-s3",
    release: "V2.0.1",
    sprintCode: "ME-EVS",
    name: "Main Engine Exhaust Valve System",
    systemName: "Exhaust Valve System",
    filename: "Actinium_SM_MTIL_V2_0_1_Sprint3_Main_Engine_Exhaust_Valve_System.xlsx",
    jobIdPrefix: "ME-EVS",
    jobIdPattern: "JOBS-ME-EVS-",
    legacyJobIdPattern: "JOB-ME-EVS-",
    sampleTemplateId: "TMPL-ME-EVS-001",
    legacySampleTemplateId: "TMP-ME-EVS-001",
  },
  {
    id: "v201-s4",
    release: "V2.0.1",
    sprintCode: "ME-TCH",
    name: "Main Engine Turbocharger System",
    systemName: "Turbocharger System",
    filename: "Actinium_SM_MTIL_V2_0_1_Sprint4_Main_Engine_Turbocharger_System.xlsx",
    jobIdPrefix: "ME-TCH",
    jobIdPattern: "JOBS-ME-TCH-",
    sampleTemplateId: "TMPL-ME-TCH-0001",
  },
  {
    id: "v201-s5",
    release: "V2.0.1",
    sprintCode: "ME-CRK",
    name: "Main Engine Crankshaft & Bearings",
    systemName: "Crankshaft & Bearings",
    filename: "Actinium_SM_MTIL_V2_0_1_Sprint5_Main_Engine_Crankshaft_Bearings.xlsx",
    jobIdPrefix: "ME-CRK",
    jobIdPattern: "JOBS-ME-CRK-",
    sampleTemplateId: "TMPL-ME-CRK-0001",
  },
];

export function getV2SprintById(id: string): V2SprintDefinition | undefined {
  return V2_SPRINT_REGISTRY.find((s) => s.id === id);
}

export function sprintWorkbookPath(sprint: V2SprintDefinition): string {
  const emdrPath = emdrWorkbookPath(sprint.filename);
  if (fs.existsSync(emdrPath)) return emdrPath;
  return path.join(V2_DATA_DIR, sprint.filename);
}
