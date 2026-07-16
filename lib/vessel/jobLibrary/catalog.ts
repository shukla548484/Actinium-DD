import type { DdJobPriority } from "@prisma/client";
import fs from "node:fs";
import { generatePhase1JobLibraryTree } from "@/lib/mtil/phases/phase1/generate";
import { generatePhase1WorkbookJobLibraryTree } from "@/lib/mtil/phases/phase1/workbookJobLibraryTree";
import { PHASE1_WORKBOOK_V04_PATH } from "@/lib/mtil/phases/phase1/workbookV04";
import { generatePhase2JobLibraryTree } from "@/lib/mtil/phases/phase2/generate";
import { generatePhase2WorkbookJobLibraryTree } from "@/lib/mtil/phases/phase2/workbookJobLibraryTree";
import { PHASE2_WORKBOOK_V05_PATH } from "@/lib/mtil/phases/phase2/workbookV05";
import { generatePhase3JobLibraryTree } from "@/lib/mtil/phases/phase3/generate";
import { generatePhase3WorkbookJobLibraryTree } from "@/lib/mtil/phases/phase3/workbookJobLibraryTree";
import { PHASE3_WORKBOOK_V06_PATH } from "@/lib/mtil/phases/phase3/workbookV06";
import { generatePhase4WorkbookJobLibraryTree } from "@/lib/mtil/phases/phase4/workbookJobLibraryTree";
import { PHASE4_WORKBOOK_V07_PATH } from "@/lib/mtil/phases/phase4/workbookV07";
import { generatePhase5WorkbookJobLibraryTree } from "@/lib/mtil/phases/phase5/workbookJobLibraryTree";
import { PHASE5_WORKBOOK_V08_PATH } from "@/lib/mtil/phases/phase5/workbookV08";
import { generatePhase6WorkbookJobLibraryTree } from "@/lib/mtil/phases/phase6/workbookJobLibraryTree";
import { PHASE6_WORKBOOK_V09_PATH } from "@/lib/mtil/phases/phase6/workbookV09";
import { generatePhase7WorkbookJobLibraryTree } from "@/lib/mtil/phases/phase7/workbookJobLibraryTree";
import { PHASE7_WORKBOOK_V10_PATH } from "@/lib/mtil/phases/phase7/workbookV10";
import { generatePhase8WorkbookJobLibraryTree } from "@/lib/mtil/phases/phase8/workbookJobLibraryTree";
import { PHASE8_WORKBOOK_V11_PATH } from "@/lib/mtil/phases/phase8/workbookV11";
import { generateMasterRepositoryJobLibraryTree } from "@/lib/mtil/master/repositoryJobLibraryTree";
import { MASTER_REPOSITORY_V12_PATH } from "@/lib/mtil/master/repositoryV12";
import path from "node:path";
import { generateV201CombinedJobLibraryTree } from "@/lib/mtil/v2/v201JobLibraryTree";
import { EMDR_V201_WORKBOOKS_DIR, MTIL_V2_WORKBOOKS_DIR, isEmdrMasterRepositoryPresent } from "@/lib/emdr/paths";
import { generateEmdrMasterRepositoryTree } from "@/lib/emdr/v3/v30JobLibraryTree";
import { V2_SPRINT_REGISTRY } from "@/lib/mtil/v2/sprints/registry";
import {
  STANDARD_JOB_INPUT_TEMPLATE,
  type JobInputFieldDef,
  type JobInputFieldType,
} from "./inputTemplate";

export type { JobInputFieldDef, JobInputFieldType };
export { STANDARD_JOB_INPUT_TEMPLATE };

export type JobLibraryNodeType =
  | "department"
  | "category"
  | "system"
  | "machinery"
  | "component"
  | "standard_job";

export type JobLibrarySeedNode = {
  code: string;
  name: string;
  nodeType: JobLibraryNodeType;
  description?: string;
  department?: string;
  workshop?: string;
  referenceCode?: string;
  defaultPriority?: DdJobPriority;
  estimatedManhours?: number;
  inputTemplate?: JobInputFieldDef[];
  children?: JobLibrarySeedNode[];
  /** MTIL Phase 1+ metadata — stored in DB, drives dynamic template engine. */
  mtilPhase?: number;
  mtilJobCode?: string;
  dynamicTemplateKey?: string;
  mtilMeta?: Record<string, unknown>;
};

export type JobLibraryNodeDto = {
  id: string;
  parentId: string | null;
  nodeType: JobLibraryNodeType;
  code: string;
  name: string;
  description: string | null;
  department: string | null;
  workshop: string | null;
  referenceCode: string | null;
  defaultPriority: DdJobPriority | null;
  estimatedManhours: number | null;
  inputTemplate: JobInputFieldDef[] | null;
  dynamicTemplateKey?: string | null;
  mtilJobCode?: string | null;
  hasChildren: boolean;
};

function stdJob(
  code: string,
  name: string,
  opts: Partial<JobLibrarySeedNode> = {},
): JobLibrarySeedNode {
  return {
    code,
    name,
    nodeType: "standard_job",
    inputTemplate: STANDARD_JOB_INPUT_TEMPLATE,
    defaultPriority: "medium",
    estimatedManhours: 8,
    ...opts,
  };
}

function component(code: string, name: string, jobs: JobLibrarySeedNode[]): JobLibrarySeedNode {
  return { code, name, nodeType: "component", children: jobs };
}

function machinery(code: string, name: string, children: JobLibrarySeedNode[]): JobLibrarySeedNode {
  return { code, name, nodeType: "machinery", children };
}

function system(code: string, name: string, workshop: string, children: JobLibrarySeedNode[]): JobLibrarySeedNode {
  return { code, name, nodeType: "system", workshop, children };
}

function category(code: string, name: string, department: string, children: JobLibrarySeedNode[]): JobLibrarySeedNode {
  return { code, name, nodeType: "category", department, children };
}

function workbookCatalogEntry(
  workbookPath: string,
  build: () => JobLibrarySeedNode,
): JobLibrarySeedNode[] {
  return fs.existsSync(workbookPath) ? [build()] : [];
}

const commonJobInfoFields: JobInputFieldDef[] = [
  { key: "vesselName", label: "Vessel name", type: "text", section: "condition" },
  { key: "imoNumber", label: "IMO no.", type: "text", section: "condition" },
  { key: "equipmentTag", label: "Equipment / item no.", type: "text", section: "condition" },
  { key: "jobDate", label: "Date", type: "date", section: "condition" },
  { key: "runningHours", label: "Running hours", type: "number", section: "condition" },
  { key: "lastOverhaul", label: "Last overhaul date", type: "date", section: "condition" },
  { key: "photosNote", label: "Photos, reports and attachments", type: "photos_note", section: "condition" },
];

const commonRiskFields: JobInputFieldDef[] = [
  { key: "operationalRisk", label: "Operational risk", type: "select", section: "risk", options: [
    { value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" },
  ]},
  { key: "safetyRisk", label: "Safety risk", type: "select", section: "risk", options: [
    { value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" },
  ]},
  { key: "environmentalRisk", label: "Environmental risk", type: "select", section: "risk", options: [
    { value: "low", label: "Low" }, { value: "medium", label: "Medium" }, { value: "high", label: "High" },
  ]},
  { key: "criticality", label: "Criticality", type: "select", section: "risk", options: [
    { value: "routine", label: "Routine" }, { value: "important", label: "Important" }, { value: "critical", label: "Critical" },
  ]},
  { key: "classAttendance", label: "Class attendance required", type: "boolean", section: "risk" },
  { key: "makerAttendance", label: "Maker attendance required", type: "boolean", section: "risk" },
];

const commonApprovalFields: JobInputFieldDef[] = [
  { key: "completedBy", label: "Completed by", type: "text", section: "approval" },
  { key: "checkedBy", label: "Checked by", type: "text", section: "approval" },
  { key: "approvedBy", label: "Approved by", type: "text", section: "approval" },
  { key: "completionDate", label: "Completion date", type: "date", section: "approval" },
];

function scopeChecklist(items: string[]): JobInputFieldDef {
  return {
    key: "scopeChecklist",
    label: `Scope of work checklist (${items.join("; ")})`,
    type: "textarea",
    required: true,
    section: "repair",
  };
}

export const TURBOCHARGER_OVERHAUL_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "department", label: "Department", type: "text", section: "condition" },
  { key: "engineOrGenSet", label: "Engine / Gen set", type: "text", section: "condition" },
  { key: "turbochargerMake", label: "Turbocharger make", type: "text", section: "condition" },
  { key: "turbochargerModel", label: "Turbocharger model", type: "text", section: "condition" },
  scopeChecklist(["Complete dismantling", "Cleaning and inspection of all parts", "Replacement of worn out parts", "Reassembly and balancing", "Performance test and trial run"]),
  { key: "partsInspectionReport", label: "Parts inspection report - compressor wheel, turbine wheel, nozzle ring, shaft, journal bearing, thrust bearing, seal ring, O-rings/gaskets", type: "textarea", section: "repair" },
  { key: "balancingReport", label: "Balancing report - before overhaul, after overhaul, permissible limit and result", type: "textarea", section: "repair" },
  { key: "performanceTest", label: "Performance test - boost pressure, exhaust gas temp, RPM and result", type: "textarea", section: "repair" },
  { key: "result", label: "Result", type: "select", section: "approval", options: [{ value: "satisfactory", label: "Satisfactory" }, { value: "not_satisfactory", label: "Not satisfactory" }] },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const MAIN_ENGINE_OVERHAUL_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "engineMake", label: "Engine make", type: "text", section: "condition" },
  { key: "engineModel", label: "Engine model", type: "text", section: "condition" },
  { key: "engineCylinderNo", label: "Engine no. / cylinder no.", type: "text", section: "condition" },
  scopeChecklist(["Opening of engine and inspection", "Cleaning of components", "Inspection and measurement", "Replacement of worn parts", "Reassembly and alignment", "Performance test"]),
  { key: "cylinderOverhaulReport", label: "Cylinder overhaul report - liner OD, piston crown, piston skirt, piston ring groove, piston pin OD, crosshead bearing, big end bearing, connecting rod bolt", type: "textarea", section: "repair" },
  { key: "crankshaftBearingInspection", label: "Crankshaft and bearing inspection - main journal, crank pin journal, thrust bearing, crankshaft deflection", type: "textarea", section: "repair" },
  { key: "performanceTest", label: "Performance test - compression pressure, exhaust gas temp, scavenging air temp, engine RPM and load test result", type: "textarea", section: "repair" },
  { key: "result", label: "Result", type: "select", section: "approval", options: [{ value: "satisfactory", label: "Satisfactory" }, { value: "not_satisfactory", label: "Not satisfactory" }] },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const GENERATOR_OVERHAUL_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "generatorNo", label: "Generator no.", type: "text", section: "condition" },
  { key: "makeModel", label: "Make / model", type: "text", section: "condition" },
  scopeChecklist(["Dismantling and cleaning", "Inspection of all parts", "Winding insulation test", "Bearing replacement", "Reassembly and alignment", "Load test"]),
  { key: "inspectionTestReport", label: "Inspection and test report - stator winding megger, rotor winding megger, bearing condition, exciter inspection, AVR test, diode/rectifier test, cooling fan/ventilation, coupling alignment", type: "textarea", section: "repair" },
  { key: "loadTest", label: "Load test - no load, 50 percent load and 100 percent load readings for kW, voltage, frequency, current and power factor", type: "textarea", section: "repair" },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const PUMP_OVERHAUL_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "pumpName", label: "Pump name", type: "text", section: "condition" },
  { key: "pumpType", label: "Type", type: "text", section: "condition" },
  { key: "makeModel", label: "Make / model", type: "text", section: "condition" },
  scopeChecklist(["Dismantling", "Cleaning", "Inspection and measurement", "Replacement of worn parts", "Reassembly", "Performance test"]),
  { key: "inspectionReport", label: "Inspection report - pump casing, impeller, shaft, shaft sleeve, bearings, mechanical seal, wear ring, O-rings/gaskets", type: "textarea", section: "repair" },
  { key: "performanceTest", label: "Performance test - discharge pressure, flow rate, vibration, noise and result", type: "textarea", section: "repair" },
  { key: "result", label: "Result", type: "select", section: "approval", options: [{ value: "satisfactory", label: "Satisfactory" }, { value: "not_satisfactory", label: "Not satisfactory" }] },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const ELECTRICAL_MOTOR_OVERHAUL_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "motorNameNo", label: "Motor name / no.", type: "text", section: "condition" },
  { key: "makeModel", label: "Make / model", type: "text", section: "condition" },
  { key: "powerKw", label: "Power", type: "number", unit: "kW", section: "condition" },
  scopeChecklist(["Dismantling", "Cleaning", "Winding inspection", "Bearing replacement", "Reassembly and alignment", "Insulation test and run test"]),
  { key: "inspectionTestReport", label: "Inspection and test report - stator insulation megger, rotor insulation megger, winding resistance, bearing condition, shaft condition, cooling fan, terminal box, earth continuity", type: "textarea", section: "repair" },
  { key: "runTest", label: "Run test - voltage, current, RPM, vibration and temperature rise", type: "textarea", section: "repair" },
  { key: "result", label: "Result", type: "select", section: "approval", options: [{ value: "satisfactory", label: "Satisfactory" }, { value: "not_satisfactory", label: "Not satisfactory" }] },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const PIPELINE_PRESSURE_TEST_REPAIR_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "systemLine", label: "System / line", type: "text", section: "condition" },
  { key: "location", label: "Location", type: "text", section: "condition" },
  { key: "pipeSize", label: "Pipe size", type: "text", section: "condition" },
  { key: "material", label: "Material", type: "text", section: "condition" },
  { key: "testMedium", label: "Test medium", type: "text", section: "condition" },
  { key: "testType", label: "Test type", type: "select", section: "repair", options: [{ value: "hydro", label: "Hydro test" }, { value: "pneumatic", label: "Pneumatic test" }] },
  { key: "pressureTesting", label: "Pressure testing - test pressure, holding time, start time, end time, temperature and pass/fail result", type: "textarea", required: true, section: "repair" },
  { key: "repairDetails", label: "Repair details - leak/defect location, description, repair method and material used", type: "textarea", section: "repair" },
  { key: "remarks", label: "Remarks", type: "textarea", section: "approval" },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const CRANE_LOAD_TEST_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "craneNameNo", label: "Crane name / no.", type: "text", section: "condition" },
  { key: "type", label: "Type", type: "text", section: "condition" },
  { key: "swl", label: "SWL", type: "number", unit: "ton", section: "condition" },
  { key: "loadTestDetails", label: "Load test details - load applied, boom/radius, hoist test and brake test for 25, 50, 75, 100, 110 proof and 125 ultimate percent loads", type: "textarea", required: true, section: "repair" },
  { key: "inspectionChecklist", label: "Inspection checklist - wire rope condition, hook condition, brake condition, limit switch, safety device and structural condition", type: "textarea", section: "repair" },
  { key: "overallResult", label: "Overall result", type: "select", section: "approval", options: [{ value: "pass", label: "Pass" }, { value: "fail", label: "Fail" }] },
  ...commonRiskFields,
  { key: "testedBy", label: "Tested by", type: "text", section: "approval" },
  { key: "witnessedBy", label: "Witnessed by", type: "text", section: "approval" },
  { key: "approvedBy", label: "Approved by", type: "text", section: "approval" },
];

export const PAINTING_JOB_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "areaLocation", label: "Area / location", type: "text", section: "condition" },
  { key: "paintSystem", label: "Paint system", type: "text", section: "condition" },
  { key: "paintMaker", label: "Paint maker", type: "text", section: "condition" },
  { key: "surfacePreparation", label: "Surface preparation - preparation standard, hand tooling, power tooling, abrasive blasting and surface cleanliness", type: "textarea", required: true, section: "repair" },
  { key: "environmentalConditions", label: "Environmental conditions - temperature, humidity and dew point", type: "textarea", section: "repair" },
  { key: "paintApplicationRecord", label: "Paint application record - coat, product, no. of coats, DFT microns, application method and date/time", type: "textarea", required: true, section: "repair" },
  { key: "inspectionResults", label: "Inspection results - DFT achieved, holiday test and adhesion test", type: "textarea", section: "approval" },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const PIPELINE_REPAIR_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "systemLine", label: "System / line", type: "text", section: "condition" },
  { key: "location", label: "Location", type: "text", section: "condition" },
  { key: "pipeSize", label: "Pipe size", type: "text", section: "condition" },
  { key: "material", label: "Material", type: "text", section: "condition" },
  { key: "defectDetails", label: "Defect details - leak, corrosion, crack, wall thinning, others, description, leak rate and pressure in line", type: "textarea", required: true, section: "condition" },
  { key: "repairDetails", label: "Repair details - description, repair method and material used", type: "textarea", required: true, section: "repair" },
  { key: "pressureFunctionTestAfterRepair", label: "Pressure / function test after repair - test pressure, holding time and pass/fail result", type: "textarea", section: "approval" },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const VALVE_OVERHAUL_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "valveTag", label: "Valve tag / no.", type: "text", section: "condition" },
  { key: "valveType", label: "Valve type", type: "text", section: "condition" },
  { key: "sizeRating", label: "Size / rating", type: "text", section: "condition" },
  { key: "systemLine", label: "System / line", type: "text", section: "condition" },
  scopeChecklist(["Remove valve", "Dismantle and clean", "Inspect body, seat, disc and spindle", "Renew packing/gaskets", "Lap seat", "Reassemble", "Pressure test"]),
  { key: "inspectionReport", label: "Inspection report - body, bonnet, seat, disc, spindle, gland, handwheel/actuator and fasteners", type: "textarea", section: "repair" },
  { key: "pressureTest", label: "Pressure test - shell test, seat test, back seat test, holding time, medium and result", type: "textarea", section: "repair" },
  { key: "result", label: "Result", type: "select", section: "approval", options: [{ value: "satisfactory", label: "Satisfactory" }, { value: "not_satisfactory", label: "Not satisfactory" }] },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const SEA_CHEST_CLEANING_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "seaChestLocation", label: "Sea chest location", type: "text", section: "condition" },
  { key: "gridType", label: "Grid / strainer type", type: "text", section: "condition" },
  scopeChecklist(["Open sea chest", "Remove gratings/strainers", "Clean marine growth", "Inspect coating and structure", "Inspect valves", "Renew anodes if required", "Close and leak check"]),
  { key: "inspectionReport", label: "Inspection report - gratings, strainers, coating condition, corrosion, wastage, valve condition and anodes", type: "textarea", section: "repair" },
  { key: "repairsCarriedOut", label: "Repairs carried out / materials used", type: "textarea", section: "repair" },
  { key: "finalCondition", label: "Final condition and remarks", type: "textarea", section: "approval" },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const HEAT_EXCHANGER_CLEAN_PRESSURE_TEST_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "coolerName", label: "Cooler / heat exchanger name", type: "text", section: "condition" },
  { key: "coolerType", label: "Type", type: "text", section: "condition" },
  { key: "makeModel", label: "Make / model", type: "text", section: "condition" },
  scopeChecklist(["Isolate and drain", "Open covers", "Clean tubes/plates", "Inspect tube stack/plates", "Renew gaskets", "Box up", "Pressure test"]),
  { key: "inspectionReport", label: "Inspection report - covers, tubes/plates, baffles, gaskets, corrosion, erosion and leakage evidence", type: "textarea", section: "repair" },
  { key: "pressureTest", label: "Pressure test - side tested, test pressure, holding time, medium and result", type: "textarea", section: "repair" },
  { key: "performanceCheck", label: "Performance check - inlet/outlet temperatures, pressure drop and remarks", type: "textarea", section: "approval" },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const AIR_COMPRESSOR_OVERHAUL_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "compressorNo", label: "Compressor no.", type: "text", section: "condition" },
  { key: "makeModel", label: "Make / model", type: "text", section: "condition" },
  scopeChecklist(["Dismantle compressor", "Clean all parts", "Inspect crankcase and bearings", "Inspect piston/rings", "Overhaul suction/discharge valves", "Renew filters/gaskets", "Run test"]),
  { key: "inspectionReport", label: "Inspection report - crankshaft, bearings, connecting rod, piston, rings, cylinder liner, valves, cooler and safety valve", type: "textarea", section: "repair" },
  { key: "runTest", label: "Run test - discharge pressure, stage temperatures, oil pressure, vibration, unloading operation and safety valve lift", type: "textarea", section: "repair" },
  { key: "result", label: "Result", type: "select", section: "approval", options: [{ value: "satisfactory", label: "Satisfactory" }, { value: "not_satisfactory", label: "Not satisfactory" }] },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const PURIFIER_OVERHAUL_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "purifierNo", label: "Purifier no.", type: "text", section: "condition" },
  { key: "service", label: "Service", type: "text", section: "condition" },
  { key: "makeModel", label: "Make / model", type: "text", section: "condition" },
  scopeChecklist(["Dismantle bowl", "Clean bowl and discs", "Inspect spindle and bearings", "Renew seals/O-rings", "Check clutch/brake", "Reassemble", "Operational test"]),
  { key: "inspectionReport", label: "Inspection report - bowl body, disc stack, distributor, sliding bowl, spindle, bearings, seals, water chamber and frame", type: "textarea", section: "repair" },
  { key: "operationalTest", label: "Operational test - vibration, amperage, sealing water, discharge cycle, leakage and alarms", type: "textarea", section: "repair" },
  { key: "result", label: "Result", type: "select", section: "approval", options: [{ value: "satisfactory", label: "Satisfactory" }, { value: "not_satisfactory", label: "Not satisfactory" }] },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const BOILER_TUBE_SURVEY_REPAIR_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "boilerNo", label: "Boiler no.", type: "text", section: "condition" },
  { key: "surveyScope", label: "Survey scope", type: "text", section: "condition" },
  scopeChecklist(["Open boiler", "Clean fire/water side", "Inspect tubes and drums", "Thickness gauging", "Plug/renew defective tubes", "Hydro test", "Close and raise steam"]),
  { key: "inspectionReport", label: "Inspection report - furnace, tubes, tube plates, drums, refractory, mountings, soot deposits and corrosion", type: "textarea", section: "repair" },
  { key: "repairDetails", label: "Repair details - tube location, defect, plugging/renewal method, welding/NDT and materials", type: "textarea", section: "repair" },
  { key: "hydroSteamTest", label: "Hydro/steam test - test pressure, holding time, safety valves, burner trial and result", type: "textarea", section: "approval" },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const STEERING_GEAR_OVERHAUL_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "steeringGearType", label: "Steering gear type", type: "text", section: "condition" },
  { key: "ramActuatorNo", label: "Ram / actuator no.", type: "text", section: "condition" },
  scopeChecklist(["Isolate hydraulics", "Dismantle ram/actuator", "Inspect rods and seals", "Renew seal kit", "Flush system", "Reassemble", "Function test"]),
  { key: "inspectionReport", label: "Inspection report - ram rods, cylinder bore, seals, bearings, hydraulic lines, pumps, valves and relief settings", type: "textarea", section: "repair" },
  { key: "functionTest", label: "Function test - port/starboard hard-over time, leakage, pressure, alarms and emergency steering", type: "textarea", section: "approval" },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const BOW_THRUSTER_INSPECTION_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "thrusterMakeModel", label: "Thruster make / model", type: "text", section: "condition" },
  { key: "powerKw", label: "Power", type: "number", unit: "kW", section: "condition" },
  scopeChecklist(["Inspect tunnel", "Inspect propeller blades", "Check seals", "Inspect gear box oil", "Check motor insulation", "Check controls", "Operational test"]),
  { key: "inspectionReport", label: "Inspection report - tunnel, grids, blades, hub, seals, gearbox, oil condition, motor, cabling and controls", type: "textarea", section: "repair" },
  { key: "operationalTest", label: "Operational test - pitch/thrust response, amperage, vibration, leakage, alarms and remote control", type: "textarea", section: "approval" },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const TAILSHAFT_WITHDRAWAL_SURVEY_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "shaftNo", label: "Shaft no.", type: "text", section: "condition" },
  { key: "sealType", label: "Seal type", type: "text", section: "condition" },
  scopeChecklist(["Remove propeller", "Withdraw shaft", "Inspect liner and journals", "Measure bearing clearances", "Inspect seals", "NDT as required", "Reinstall and align"]),
  { key: "inspectionReport", label: "Inspection report - shaft liner, journal, keyway, taper, propeller fit, stern tube bearings, seals and rope guard", type: "textarea", section: "repair" },
  { key: "measurementReport", label: "Measurement report - bearing clearances, shaft runout, wear readings, seal liner readings and alignment", type: "textarea", section: "repair" },
  { key: "classSurveyRemarks", label: "Class/survey remarks and final result", type: "textarea", section: "approval" },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const RUDDER_CLEARANCE_SURVEY_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "rudderType", label: "Rudder type", type: "text", section: "condition" },
  scopeChecklist(["Inspect rudder plating", "Measure pintle clearances", "Measure bearing clearances", "Inspect stock and palm", "NDT as required", "Check movement", "Record final readings"]),
  { key: "measurementReport", label: "Measurement report - upper/lower pintle clearance, jumping clearance, bearing wear, stock/palm readings and steering movement", type: "textarea", section: "repair" },
  { key: "inspectionReport", label: "Inspection report - plating, welds, drain plugs, stock, palm bolts, pintles, bearings and coating", type: "textarea", section: "repair" },
  { key: "classSurveyRemarks", label: "Class/survey remarks and final result", type: "textarea", section: "approval" },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const PROPELLER_REPAIR_POLISH_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "propellerType", label: "Propeller type", type: "text", section: "condition" },
  { key: "bladeCount", label: "No. of blades", type: "number", section: "condition" },
  scopeChecklist(["Clean propeller", "Inspect blades", "Measure damage", "Polish blades", "Repair edges/tips if required", "NDT as required", "Final inspection"]),
  { key: "damageReport", label: "Damage report - blade number, location, bend/crack/cavitation, dimensions and photographs", type: "textarea", section: "condition" },
  { key: "repairDetails", label: "Repair details - grinding, fairing, welding, heat treatment, polishing grade and material used", type: "textarea", section: "repair" },
  { key: "finalInspection", label: "Final inspection - NDT result, surface finish, class remarks and acceptance", type: "textarea", section: "approval" },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const HATCH_COVER_SEAL_TEST_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "hatchNo", label: "Hatch no.", type: "text", section: "condition" },
  { key: "coverType", label: "Cover type", type: "text", section: "condition" },
  scopeChecklist(["Inspect panels", "Inspect rubber packing", "Inspect compression bars", "Renew seals", "Adjust cleats", "Test tightness", "Record result"]),
  { key: "inspectionReport", label: "Inspection report - panels, cross joints, rubber packing, compression bars, drains, cleats, wheels and hydraulic system", type: "textarea", section: "repair" },
  { key: "tightnessTest", label: "Tightness test - hose test/ultrasonic test readings, leak locations, repairs and final result", type: "textarea", section: "approval" },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const TANK_INSPECTION_COATING_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "tankName", label: "Tank name", type: "text", section: "condition" },
  { key: "tankService", label: "Tank service", type: "text", section: "condition" },
  scopeChecklist(["Gas free and ventilate", "Clean tank", "Inspect structure", "Thickness gauge as required", "Prepare surface", "Repair coating", "Final inspection"]),
  { key: "inspectionReport", label: "Inspection report - coating breakdown, corrosion, pitting, cracks, stiffeners, ladders, suction wells and anodes", type: "textarea", section: "condition" },
  { key: "coatingRepairRecord", label: "Coating repair record - surface preparation, product, DFT, holiday test, stripe coat and final coat", type: "textarea", section: "repair" },
  { key: "entryPermitRefs", label: "Gas-free / enclosed-space permit and inspection references", type: "photos_note", section: "approval" },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const ANODE_RENEWAL_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "anodeLocation", label: "Anode location", type: "text", section: "condition" },
  { key: "anodeType", label: "Anode type", type: "text", section: "condition" },
  scopeChecklist(["Inspect existing anodes", "Record wastage", "Remove wasted anodes", "Prepare surface", "Fit/weld new anodes", "Touch up coating", "Final count"]),
  { key: "renewalRecord", label: "Renewal record - location, old quantity, renewed quantity, type/weight, welding method and coating touch-up", type: "textarea", section: "repair" },
  { key: "finalCount", label: "Final anode count and remarks", type: "textarea", section: "approval" },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const LIFEBOAT_DAVIT_LOAD_TEST_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "lifeboatNo", label: "Lifeboat / davit no.", type: "text", section: "condition" },
  { key: "swl", label: "SWL", type: "number", unit: "kg", section: "condition" },
  scopeChecklist(["Inspect davit structure", "Inspect wire falls", "Inspect winch/brake", "Inspect hooks", "Dynamic/static load test", "Operational lowering/recovery", "Record certificates"]),
  { key: "inspectionReport", label: "Inspection report - davit arms, winch, brake, wire falls, sheaves, hooks, limit switches, gripes and boat structure", type: "textarea", section: "repair" },
  { key: "loadTest", label: "Load test - test load, duration, brake holding, lowering/recovery, hook release and result", type: "textarea", section: "approval" },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const WINDLASS_WINCH_BRAKE_TEST_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "equipmentName", label: "Windlass / winch name", type: "text", section: "condition" },
  { key: "ratedPull", label: "Rated pull", type: "text", section: "condition" },
  scopeChecklist(["Inspect foundation", "Inspect gearbox", "Inspect brake lining", "Check hydraulic/electrical drive", "Grease bearings", "Brake test", "Operational test"]),
  { key: "inspectionReport", label: "Inspection report - foundation, gears, bearings, clutch, brake, gypsy/drum, motor/pump, controls and guards", type: "textarea", section: "repair" },
  { key: "brakeTest", label: "Brake test - test load/pull, holding result, slippage, adjustment and final operational test", type: "textarea", section: "approval" },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const SWITCHBOARD_INSPECTION_TEST_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "switchboardName", label: "Switchboard / panel name", type: "text", section: "condition" },
  { key: "voltage", label: "Voltage", type: "number", unit: "V", section: "condition" },
  scopeChecklist(["Isolate panel", "Clean busbars and cubicles", "Inspect breakers", "Megger test", "Functional test trips/alarms", "Tightness check", "Energize and monitor"]),
  { key: "inspectionTestReport", label: "Inspection and test report - busbar condition, breaker operation, insulation resistance, protection trips, alarms, meters and earthing", type: "textarea", section: "repair" },
  { key: "testResults", label: "Test results - megger readings, contact resistance if applicable, trip test and final energization result", type: "textarea", section: "approval" },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const FUEL_INJECTOR_OVERHAUL_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "engineNo", label: "Engine no.", type: "text", section: "condition" },
  { key: "injectorNos", label: "Injector nos.", type: "text", section: "condition" },
  scopeChecklist(["Remove injectors", "Dismantle and clean", "Inspect nozzle and spindle", "Renew nozzle/seals if required", "Pressure test", "Set opening pressure", "Refit and leak check"]),
  { key: "inspectionReport", label: "Inspection report - nozzle, needle/spindle, body, spring, holder, sealing faces and carbon deposits", type: "textarea", section: "repair" },
  { key: "testReport", label: "Test report - opening pressure, spray pattern, leakage/dribbling, chatter and final set pressure", type: "textarea", section: "approval" },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const EXHAUST_VALVE_OVERHAUL_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "engineCylinderNo", label: "Engine / cylinder no.", type: "text", section: "condition" },
  { key: "valveMakeModel", label: "Valve make / model", type: "text", section: "condition" },
  scopeChecklist(["Remove exhaust valve", "Dismantle and clean", "Inspect spindle and seat", "Grind/lap seat", "Renew seals/O-rings", "Pressure test actuator", "Refit and function test"]),
  { key: "inspectionReport", label: "Inspection report - spindle, seat, cage, spring, rotator, actuator, cooling passages and burn marks", type: "textarea", section: "repair" },
  { key: "measurementReport", label: "Measurement report - spindle stem, seat width, guide clearance, lift and sealing test", type: "textarea", section: "repair" },
  { key: "result", label: "Result", type: "select", section: "approval", options: [{ value: "satisfactory", label: "Satisfactory" }, { value: "not_satisfactory", label: "Not satisfactory" }] },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const FUEL_PUMP_OVERHAUL_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "engineNo", label: "Engine no.", type: "text", section: "condition" },
  { key: "pumpNo", label: "Fuel pump no.", type: "text", section: "condition" },
  scopeChecklist(["Remove fuel pump", "Dismantle and clean", "Inspect plunger/barrel", "Inspect delivery valve", "Renew seals", "Calibrate/timing check", "Refit and leak test"]),
  { key: "inspectionReport", label: "Inspection report - plunger, barrel, delivery valve, tappet, roller, spring, rack movement and leakage", type: "textarea", section: "repair" },
  { key: "calibrationReport", label: "Calibration/timing report - rack position, delivery quantity, timing, leak-off and final adjustment", type: "textarea", section: "approval" },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const STARTING_AIR_VALVE_OVERHAUL_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "engineCylinderNo", label: "Engine / cylinder no.", type: "text", section: "condition" },
  { key: "valveNo", label: "Starting air valve no.", type: "text", section: "condition" },
  scopeChecklist(["Remove valve", "Dismantle and clean", "Inspect seat and spindle", "Renew O-rings/seals", "Lap seat", "Bench test", "Refit and test starting sequence"]),
  { key: "inspectionReport", label: "Inspection report - valve body, seat, spindle, spring, guide, actuator piston, control air passages and carbon deposits", type: "textarea", section: "repair" },
  { key: "benchTest", label: "Bench/function test - opening pressure, leakage, response and final result", type: "textarea", section: "approval" },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const FWG_CLEAN_DESCALE_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "fwgNo", label: "FWG no.", type: "text", section: "condition" },
  { key: "makeModel", label: "Make / model", type: "text", section: "condition" },
  scopeChecklist(["Isolate and drain", "Open evaporator/condenser", "Clean/descale plates or tubes", "Inspect ejector/nozzles", "Renew gaskets", "Pressure/leak test", "Operational test"]),
  { key: "inspectionReport", label: "Inspection report - plates/tubes, condenser, evaporator, demister, ejector, salinometer, pumps and scale condition", type: "textarea", section: "repair" },
  { key: "operationalTest", label: "Operational test - vacuum, jacket water temperature, distillate output, salinity, pump pressure and alarms", type: "textarea", section: "approval" },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const OWS_OVERHAUL_TEST_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "owsNo", label: "OWS no.", type: "text", section: "condition" },
  { key: "makeModel", label: "Make / model", type: "text", section: "condition" },
  scopeChecklist(["Open and clean unit", "Renew filters/coalescer", "Inspect valves and piping", "Check 15 ppm monitor", "Test auto stop/diverter", "Operational test", "Record calibration/certificates"]),
  { key: "inspectionReport", label: "Inspection report - separator chamber, coalescer, filters, pumps, valves, 15 ppm monitor, sample lines and alarms", type: "textarea", section: "repair" },
  { key: "testReport", label: "Test report - ppm readings, auto-stop, three-way valve/diverter, alarms and overboard lockout", type: "textarea", section: "approval" },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const HVAC_CHILLER_SERVICE_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "unitName", label: "HVAC / chiller unit", type: "text", section: "condition" },
  { key: "refrigerant", label: "Refrigerant", type: "text", section: "condition" },
  scopeChecklist(["Inspect compressor", "Clean condenser/evaporator", "Check refrigerant charge", "Inspect belts/coupling", "Check controls and safeties", "Leak test", "Run test"]),
  { key: "inspectionReport", label: "Inspection report - compressor, condenser, evaporator, filters, fans, pumps, valves, insulation and electrical controls", type: "textarea", section: "repair" },
  { key: "runTest", label: "Run test - suction/discharge pressure, temperatures, amperage, refrigerant condition, leak check and alarms", type: "textarea", section: "approval" },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const CARGO_PUMP_OVERHAUL_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "cargoPumpNo", label: "Cargo pump no.", type: "text", section: "condition" },
  { key: "pumpType", label: "Pump type", type: "text", section: "condition" },
  scopeChecklist(["Gas free/flush", "Dismantle pump", "Inspect impeller/rotor", "Inspect shaft and bearings", "Renew seals", "Reassemble", "Performance test"]),
  { key: "inspectionReport", label: "Inspection report - casing, impeller/rotor, shaft, bearings, mechanical seal, wear rings, coupling and foundation", type: "textarea", section: "repair" },
  { key: "performanceTest", label: "Performance test - suction/discharge pressure, flow, vibration, seal leakage and motor load", type: "textarea", section: "approval" },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const CARGO_LINE_PRESSURE_TEST_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "cargoLine", label: "Cargo line", type: "text", section: "condition" },
  { key: "lineSize", label: "Line size", type: "text", section: "condition" },
  { key: "testMedium", label: "Test medium", type: "text", section: "condition" },
  scopeChecklist(["Isolate cargo line", "Blank/secure ends", "Fill or pressurize", "Hold pressure", "Inspect joints/flanges", "Repair leaks", "Record final result"]),
  { key: "pressureTest", label: "Pressure test - test pressure, holding time, pressure drop, leak locations and result", type: "textarea", required: true, section: "repair" },
  { key: "repairDetails", label: "Repair details - gasket/pipe/flange/valve work, materials and retest result", type: "textarea", section: "approval" },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const CARGO_TANK_COATING_REPAIR_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "cargoTank", label: "Cargo tank", type: "text", section: "condition" },
  { key: "coatingSystem", label: "Coating system", type: "text", section: "condition" },
  scopeChecklist(["Gas free and clean", "Inspect coating", "Mark breakdown areas", "Surface preparation", "Stripe coat", "Apply coats", "DFT/holiday test"]),
  { key: "inspectionReport", label: "Inspection report - coating breakdown, blistering, cracking, corrosion, pitting and structural condition", type: "textarea", section: "condition" },
  { key: "coatingRecord", label: "Coating record - prep standard, products, batch nos., DFT, humidity/dew point, holiday test and cure", type: "textarea", section: "repair" },
  { key: "finalAcceptance", label: "Final acceptance - inspector remarks, punch list and attachments", type: "photos_note", section: "approval" },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const NAVIGATION_EQUIPMENT_SERVICE_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "equipmentName", label: "Navigation equipment", type: "text", section: "condition" },
  { key: "makeModel", label: "Make / model", type: "text", section: "condition" },
  scopeChecklist(["Visual inspection", "Check power supply", "Check antenna/sensor", "Software/configuration check", "Functional test", "Alarm/interface test", "Record service report"]),
  { key: "inspectionReport", label: "Inspection report - equipment condition, cabling, antenna/sensor, display, interfaces, alarms and backup supply", type: "textarea", section: "repair" },
  { key: "testReport", label: "Test report - functional checks, interface checks, calibration offsets and service engineer remarks", type: "textarea", section: "approval" },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const VDR_APT_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "vdrMakeModel", label: "VDR make / model", type: "text", section: "condition" },
  { key: "certificateExpiry", label: "Certificate expiry", type: "date", section: "condition" },
  scopeChecklist(["Inspect VDR/S-VDR", "Check microphones", "Check sensors/interfaces", "Download test data", "Replay verification", "Backup configuration", "Issue APT report"]),
  { key: "interfaceChecks", label: "Interface checks - GPS, gyro, AIS, radar, ECDIS, audio, bridge alarms and power failure backup", type: "textarea", section: "repair" },
  { key: "aptResult", label: "Annual performance test result, deficiencies and certificate/report reference", type: "textarea", section: "approval" },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const INSTRUMENT_CALIBRATION_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "instrumentList", label: "Instrument list", type: "textarea", section: "condition" },
  { key: "calibrationStandard", label: "Calibration standard / reference", type: "text", section: "condition" },
  scopeChecklist(["Identify instruments", "Check range and tag", "Calibrate against standard", "Adjust as required", "Record before/after values", "Apply calibration labels", "Attach certificates"]),
  { key: "calibrationRecord", label: "Calibration record - tag, range, before reading, after reading, error, adjustment and certificate no.", type: "textarea", section: "repair" },
  { key: "certificateRefs", label: "Calibration certificate references / attachments", type: "photos_note", section: "approval" },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const ALARM_MONITORING_TEST_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "systemName", label: "Alarm / monitoring system", type: "text", section: "condition" },
  scopeChecklist(["Prepare test list", "Test alarms", "Test shutdowns/trips", "Check annunciation", "Check history/logging", "Rectify defects", "Record final status"]),
  { key: "testRecord", label: "Test record - alarm point, set point, simulated value, response, delay, display and reset", type: "textarea", section: "repair" },
  { key: "defectsRectified", label: "Defects found/rectified and remaining punch list", type: "textarea", section: "approval" },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const GALLEY_EQUIPMENT_SERVICE_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "equipmentName", label: "Galley equipment", type: "text", section: "condition" },
  { key: "powerSource", label: "Power / fuel source", type: "text", section: "condition" },
  scopeChecklist(["Isolate equipment", "Clean and inspect", "Check burners/elements", "Check thermostats/controls", "Check safety devices", "Renew worn parts", "Operational test"]),
  { key: "inspectionReport", label: "Inspection report - body, doors, seals, burners/elements, wiring, gas lines, thermostats, guards and safety cutouts", type: "textarea", section: "repair" },
  { key: "operationalTest", label: "Operational test - temperature control, safety trips, leakage, current/gas pressure and user acceptance", type: "textarea", section: "approval" },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const SANITARY_PUMP_LINE_OVERHAUL_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "systemLine", label: "Sanitary system / line", type: "text", section: "condition" },
  { key: "pumpName", label: "Pump name", type: "text", section: "condition" },
  scopeChecklist(["Isolate and drain", "Clean line/pump", "Dismantle pump", "Inspect impeller/cutter/seal", "Repair leaks/blockages", "Reassemble", "Function test"]),
  { key: "inspectionReport", label: "Inspection report - pump casing, impeller/cutter, shaft, seal, valves, lines, blockage/corrosion and supports", type: "textarea", section: "repair" },
  { key: "functionTest", label: "Function test - flow, discharge pressure, auto start/stop, leaks and alarms", type: "textarea", section: "approval" },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const BWTS_INSTALL_COMMISSION_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "bwtsMakeModel", label: "BWTS make / model", type: "text", section: "condition" },
  { key: "capacity", label: "Capacity", type: "text", section: "condition" },
  scopeChecklist(["Verify drawings", "Install equipment/foundation", "Install piping/valves", "Install electrical/control cabling", "Flush and leak test", "Commission system", "Class/flag documentation"]),
  { key: "installationRecord", label: "Installation record - equipment, piping, valves, electrical, controls, foundations, coating and modifications", type: "textarea", section: "repair" },
  { key: "commissioningRecord", label: "Commissioning record - flow, alarms, bypass/interlocks, sampling, crew familiarization and certificates", type: "textarea", section: "approval" },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const SCRUBBER_INSTALL_COMMISSION_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "scrubberMakeModel", label: "Scrubber make / model", type: "text", section: "condition" },
  { key: "systemType", label: "System type", type: "text", section: "condition" },
  scopeChecklist(["Verify drawings", "Install tower/ducting", "Install pumps/piping", "Install washwater treatment", "Install electrical/automation", "Commission system", "Emission/compliance test"]),
  { key: "installationRecord", label: "Installation record - tower, ducting, foundations, piping, pumps, tanks, electrical, controls and insulation", type: "textarea", section: "repair" },
  { key: "commissioningRecord", label: "Commissioning record - washwater, pH/turbidity/PAH, back pressure, alarms, bypass, emissions and class/flag documents", type: "textarea", section: "approval" },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const FIRE_MAIN_FIRE_PUMP_TEST_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "pumpName", label: "Fire pump / emergency fire pump", type: "text", section: "condition" },
  { key: "fireMainSection", label: "Fire main section", type: "text", section: "condition" },
  scopeChecklist(["Inspect fire pump", "Inspect hydrants/hoses", "Pressure test fire main", "Run pump", "Test relief/isolating valves", "Check emergency start", "Record result"]),
  { key: "inspectionReport", label: "Inspection report - pump, valves, hydrants, hoses, nozzles, pressure gauges, relief valves and leaks", type: "textarea", section: "repair" },
  { key: "testReport", label: "Test report - suction/discharge pressure, flow/jet test, pressure holding, emergency start and alarms", type: "textarea", section: "approval" },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const CO2_FIXED_FIRE_SYSTEM_SURVEY_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "systemArea", label: "Protected area", type: "text", section: "condition" },
  { key: "cylinderCount", label: "Cylinder count", type: "number", section: "condition" },
  scopeChecklist(["Inspect cylinders", "Weigh/check pressure", "Inspect release cabinet", "Inspect piping/nozzles", "Test alarms and delays", "Test ventilation shutdowns", "Update certificates"]),
  { key: "inspectionReport", label: "Inspection report - cylinders, flexible hoses, manifold, valves, release controls, alarms, nozzles, signage and room ventilation", type: "textarea", section: "repair" },
  { key: "testCertificateRefs", label: "Test/certificate references - weight/pressure, hose test, alarm test, release simulation and service report", type: "photos_note", section: "approval" },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const LIFEBOAT_LAUNCH_RECOVERY_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "lifeboatNo", label: "Lifeboat / rescue boat no.", type: "text", section: "condition" },
  scopeChecklist(["Inspect boat", "Inspect engine/battery", "Inspect release gear", "Lower to water if required", "Run engine", "Recover boat", "Record defects"]),
  { key: "inspectionReport", label: "Inspection report - hull, hooks, release gear, painter, engine, fuel, battery, bilge pump, equipment and davit interface", type: "textarea", section: "repair" },
  { key: "launchRecoveryTest", label: "Launch/recovery test - brake operation, lowering/recovery, engine run, steering, communications and final result", type: "textarea", section: "approval" },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const FIRE_DETECTION_ALARM_TEST_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "systemName", label: "Fire detection system", type: "text", section: "condition" },
  scopeChecklist(["Inspect panel", "Test detectors", "Test manual call points", "Test sounders/beacons", "Check fault alarms", "Check battery backup", "Record test sheet"]),
  { key: "testRecord", label: "Test record - detector/call point location, method, response, panel indication, sounder/beacon and reset", type: "textarea", section: "repair" },
  { key: "defectsRectified", label: "Defects found, rectified items and remaining punch list", type: "textarea", section: "approval" },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const EMERGENCY_GENERATOR_TEST_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "generatorNo", label: "Emergency generator no.", type: "text", section: "condition" },
  { key: "makeModel", label: "Make / model", type: "text", section: "condition" },
  scopeChecklist(["Inspect engine", "Check fuel/oil/cooling", "Check batteries/charger", "Start locally/remotely", "Load test", "Blackout simulation if required", "Record alarms"]),
  { key: "inspectionReport", label: "Inspection report - engine, alternator, batteries, charger, fuel system, cooling, exhaust, switchboard and ventilation", type: "textarea", section: "repair" },
  { key: "loadTest", label: "Load test - voltage, frequency, current, kW, temperature, oil pressure, alarms and auto start/changeover", type: "textarea", section: "approval" },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const EMERGENCY_AIR_COMPRESSOR_TEST_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "compressorNo", label: "Emergency air compressor no.", type: "text", section: "condition" },
  scopeChecklist(["Inspect compressor", "Check oil/cooling", "Check drive motor/engine", "Drain receiver", "Run compressor", "Check safety valve", "Record charging time"]),
  { key: "inspectionReport", label: "Inspection report - compressor, drive, belts/coupling, valves, cooler, receiver, drains, gauges and safety valve", type: "textarea", section: "repair" },
  { key: "runTest", label: "Run test - start method, charging time, final pressure, safety valve, temperature, vibration and leaks", type: "textarea", section: "approval" },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const ANCHOR_CHAIN_CABLE_SURVEY_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "chainSide", label: "Port / starboard chain", type: "text", section: "condition" },
  { key: "cableLength", label: "Cable length", type: "text", section: "condition" },
  scopeChecklist(["Range cable", "Clean chain", "Measure links", "Inspect shackles/swivels", "Inspect bitter end", "Mark cable", "Record class readings"]),
  { key: "measurementReport", label: "Measurement report - link diameter, wastage percent, shots measured, shackles, swivel and anchor condition", type: "textarea", section: "repair" },
  { key: "repairRenewalRecord", label: "Repair/renewal record - links/shackles renewed, markings, certificates and class remarks", type: "textarea", section: "approval" },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const MOORING_ROPE_WINCH_INSPECTION_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "station", label: "Mooring station", type: "text", section: "condition" },
  scopeChecklist(["Inspect ropes/wires", "Inspect winch drums", "Inspect fairleads/rollers", "Check brakes/clutches", "Lubricate", "Brake/render test", "Record defects"]),
  { key: "inspectionReport", label: "Inspection report - ropes/wires, drums, fairleads, rollers, brakes, clutches, guards, foundations and controls", type: "textarea", section: "repair" },
  { key: "testReport", label: "Test report - brake holding/rendering, control operation, emergency stop and final result", type: "textarea", section: "approval" },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const ACCOMMODATION_HVAC_DUCT_CLEAN_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "areaLocation", label: "Accommodation area / duct section", type: "text", section: "condition" },
  scopeChecklist(["Inspect ducts and filters", "Clean grills/diffusers", "Clean duct section", "Check fire dampers", "Check airflow", "Replace filters", "Record hygiene findings"]),
  { key: "inspectionReport", label: "Inspection report - duct cleanliness, filters, dampers, grills, insulation, corrosion and access panels", type: "textarea", section: "repair" },
  { key: "completionRecord", label: "Completion record - areas cleaned, filters renewed, airflow remarks and photographs", type: "photos_note", section: "approval" },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const WASTE_INCINERATOR_SERVICE_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "incineratorNo", label: "Incinerator no.", type: "text", section: "condition" },
  { key: "makeModel", label: "Make / model", type: "text", section: "condition" },
  scopeChecklist(["Inspect refractory", "Clean chamber/flue", "Inspect burners", "Check fans/dampers", "Check safeties", "Operational burn test", "Record alarms"]),
  { key: "inspectionReport", label: "Inspection report - refractory, burner, atomizer, fans, dampers, door seals, flue, controls and safeties", type: "textarea", section: "repair" },
  { key: "burnTest", label: "Burn test - ignition, flame, chamber temperature, smoke, trips/alarms and final result", type: "textarea", section: "approval" },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const SEWAGE_TREATMENT_PLANT_SERVICE_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "stpNo", label: "STP no.", type: "text", section: "condition" },
  { key: "makeModel", label: "Make / model", type: "text", section: "condition" },
  scopeChecklist(["Clean tanks/screens", "Inspect blowers/pumps", "Check aeration", "Check chlorination/UV", "Inspect valves/pipework", "Operational test", "Record effluent checks"]),
  { key: "inspectionReport", label: "Inspection report - tank condition, blowers, pumps, diffusers, screens, valves, dosing/UV and alarms", type: "textarea", section: "repair" },
  { key: "testReport", label: "Test report - flow, aeration, pump operation, chlorine/UV, alarms, odor/leakage and effluent remarks", type: "textarea", section: "approval" },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const QUICK_CLOSING_VALVE_TEST_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "valveGroup", label: "Quick closing valve group", type: "text", section: "condition" },
  scopeChecklist(["Inspect valve list", "Check remote release", "Test individual valves", "Reset valves", "Rectify stiff/leaking valves", "Verify labels", "Record result"]),
  { key: "testRecord", label: "Test record - valve tag, location, service, remote release response, local reset, leakage and remarks", type: "textarea", section: "repair" },
  { key: "defectsRectified", label: "Defects found/rectified and final acceptance", type: "textarea", section: "approval" },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const REMOTE_VALVE_CONTROL_TEST_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "systemName", label: "Remote valve control system", type: "text", section: "condition" },
  scopeChecklist(["Inspect hydraulic/pneumatic power pack", "Check controls", "Operate valves remotely", "Check position feedback", "Inspect leaks", "Test emergency operation", "Record valve status"]),
  { key: "testRecord", label: "Test record - valve tag, command, actual operation, feedback indication, time to operate, leakage and faults", type: "textarea", section: "repair" },
  { key: "repairDetails", label: "Repair details and final operational result", type: "textarea", section: "approval" },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const TANK_LEVEL_GAUGE_SERVICE_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "tankGaugeList", label: "Tank gauge list", type: "textarea", section: "condition" },
  scopeChecklist(["Inspect sensors/transmitters", "Clean still pipes/floats", "Check local/remote readings", "Calibrate", "Test high/high-high alarms", "Record offsets", "Attach certificates"]),
  { key: "calibrationRecord", label: "Calibration record - tank, sensor, actual reading, remote reading, adjustment, alarm setpoints and result", type: "textarea", section: "repair" },
  { key: "certificateRefs", label: "Certificate/report references and attachments", type: "photos_note", section: "approval" },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const GAS_DETECTION_SYSTEM_TEST_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "systemArea", label: "Gas detection area", type: "text", section: "condition" },
  scopeChecklist(["Inspect detectors", "Check sample lines", "Apply test gas", "Check alarms/trips", "Calibrate sensors", "Check logger", "Attach calibration certificates"]),
  { key: "testRecord", label: "Test record - detector tag, gas type, calibration gas, reading, alarm level, trip response and result", type: "textarea", section: "repair" },
  { key: "certificateRefs", label: "Calibration certificate references and attachments", type: "photos_note", section: "approval" },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const LOAD_LINE_MARK_DRAFT_MARK_PAINT_TEMPLATE: JobInputFieldDef[] = [
  ...commonJobInfoFields,
  { key: "hullSide", label: "Hull side / location", type: "text", section: "condition" },
  scopeChecklist(["Inspect existing marks", "Verify dimensions", "Prepare surface", "Paint draft marks", "Paint load line marks", "Photograph completed marks", "Surveyor verification"]),
  { key: "measurementRecord", label: "Measurement/verification record - mark position, dimensions, side, color and surveyor comments", type: "textarea", section: "repair" },
  { key: "photoRefs", label: "Final photographs / survey report attachments", type: "photos_note", section: "approval" },
  ...commonRiskFields,
  ...commonApprovalFields,
];

export const DRY_DOCK_SHIPYARD_TEMPLATE_CATALOG: JobLibrarySeedNode = {
  code: "dry_dock_shipyard_templates",
  name: "Dry Dock / Shipyard Templates",
  nodeType: "department",
  department: "Dry Dock",
  description: "Vessel job templates matching dry dock and shipyard work packs.",
  children: [
    category("dd_shipyard_templates", "Job Templates", "Dry Dock", [
      system("dd_turbocharger", "Turbocharger", "Machinery", [
        stdJob("dd_tpl_turbocharger_overhaul", "Turbocharger overhauling template", { referenceCode: "DD-TPL-01", estimatedManhours: 24, defaultPriority: "high", inputTemplate: TURBOCHARGER_OVERHAUL_TEMPLATE }),
      ]),
      system("dd_main_engine", "Main Engine", "Machinery", [
        stdJob("dd_tpl_main_engine_overhaul", "Main engine overhauling template", { referenceCode: "DD-TPL-02", estimatedManhours: 120, defaultPriority: "critical", inputTemplate: MAIN_ENGINE_OVERHAUL_TEMPLATE }),
      ]),
      system("dd_generator", "Generator", "Electrical", [
        stdJob("dd_tpl_generator_overhaul", "Generator overhauling template", { referenceCode: "DD-TPL-03", estimatedManhours: 32, defaultPriority: "high", inputTemplate: GENERATOR_OVERHAUL_TEMPLATE }),
      ]),
      system("dd_pump", "Pump", "Machinery", [
        stdJob("dd_tpl_pump_overhaul", "Pump overhauling template", { referenceCode: "DD-TPL-04", estimatedManhours: 24, inputTemplate: PUMP_OVERHAUL_TEMPLATE }),
      ]),
      system("dd_electrical_motor", "Electrical Motor", "Electrical", [
        stdJob("dd_tpl_electrical_motor_overhaul", "Electrical motor overhauling template", { referenceCode: "DD-TPL-05", estimatedManhours: 16, inputTemplate: ELECTRICAL_MOTOR_OVERHAUL_TEMPLATE }),
      ]),
      system("dd_pipeline_pressure", "Pipeline Pressure Testing", "Piping", [
        stdJob("dd_tpl_pipeline_pressure_test_repair", "Pipeline pressure testing and repair template", { referenceCode: "DD-TPL-06", estimatedManhours: 12, defaultPriority: "high", inputTemplate: PIPELINE_PRESSURE_TEST_REPAIR_TEMPLATE }),
      ]),
      system("dd_crane_load_test", "Crane Load Testing", "Deck", [
        stdJob("dd_tpl_crane_load_test", "Crane load testing template", { referenceCode: "DD-TPL-07", estimatedManhours: 12, defaultPriority: "high", inputTemplate: CRANE_LOAD_TEST_TEMPLATE }),
      ]),
      system("dd_painting", "Painting", "Painting", [
        stdJob("dd_tpl_painting_job", "Painting job template", { referenceCode: "DD-TPL-08", estimatedManhours: 40, inputTemplate: PAINTING_JOB_TEMPLATE }),
      ]),
      system("dd_pipeline_repair", "Pipeline Repair", "Piping", [
        stdJob("dd_tpl_pipeline_repair", "Pipeline repair template", { referenceCode: "DD-TPL-09", estimatedManhours: 16, defaultPriority: "high", inputTemplate: PIPELINE_REPAIR_TEMPLATE }),
      ]),
      system("dd_valves", "Valves", "Valves", [
        stdJob("dd_tpl_valve_overhaul", "Valve overhaul and pressure test template", { referenceCode: "DD-TPL-10", estimatedManhours: 16, defaultPriority: "high", inputTemplate: VALVE_OVERHAUL_TEMPLATE }),
      ]),
      system("dd_sea_chest", "Sea Chest", "Hull", [
        stdJob("dd_tpl_sea_chest_cleaning", "Sea chest cleaning and inspection template", { referenceCode: "DD-TPL-11", estimatedManhours: 12, defaultPriority: "high", inputTemplate: SEA_CHEST_CLEANING_TEMPLATE }),
      ]),
      system("dd_heat_exchanger", "Heat Exchanger", "Machinery", [
        stdJob("dd_tpl_heat_exchanger_clean_pressure_test", "Heat exchanger cleaning and pressure test template", { referenceCode: "DD-TPL-12", estimatedManhours: 12, inputTemplate: HEAT_EXCHANGER_CLEAN_PRESSURE_TEST_TEMPLATE }),
      ]),
      system("dd_air_compressor", "Air Compressor", "Machinery", [
        stdJob("dd_tpl_air_compressor_overhaul", "Air compressor overhauling template", { referenceCode: "DD-TPL-13", estimatedManhours: 16, inputTemplate: AIR_COMPRESSOR_OVERHAUL_TEMPLATE }),
      ]),
      system("dd_purifier", "Purifier", "Machinery", [
        stdJob("dd_tpl_purifier_overhaul", "Purifier overhauling template", { referenceCode: "DD-TPL-14", estimatedManhours: 8, inputTemplate: PURIFIER_OVERHAUL_TEMPLATE }),
      ]),
      system("dd_boiler", "Boiler", "Machinery", [
        stdJob("dd_tpl_boiler_tube_survey_repair", "Boiler tube survey and repair template", { referenceCode: "DD-TPL-15", estimatedManhours: 40, defaultPriority: "high", inputTemplate: BOILER_TUBE_SURVEY_REPAIR_TEMPLATE }),
      ]),
      system("dd_steering_gear", "Steering Gear", "Machinery", [
        stdJob("dd_tpl_steering_gear_overhaul", "Steering gear ram and seal overhaul template", { referenceCode: "DD-TPL-16", estimatedManhours: 24, defaultPriority: "high", inputTemplate: STEERING_GEAR_OVERHAUL_TEMPLATE }),
      ]),
      system("dd_bow_thruster", "Bow Thruster", "Machinery", [
        stdJob("dd_tpl_bow_thruster_inspection", "Bow thruster inspection template", { referenceCode: "DD-TPL-17", estimatedManhours: 16, defaultPriority: "high", inputTemplate: BOW_THRUSTER_INSPECTION_TEMPLATE }),
      ]),
      system("dd_tailshaft", "Tailshaft", "Hull", [
        stdJob("dd_tpl_tailshaft_withdrawal_survey", "Tailshaft withdrawal and survey template", { referenceCode: "DD-TPL-18", estimatedManhours: 80, defaultPriority: "critical", inputTemplate: TAILSHAFT_WITHDRAWAL_SURVEY_TEMPLATE }),
      ]),
      system("dd_rudder", "Rudder", "Hull", [
        stdJob("dd_tpl_rudder_clearance_survey", "Rudder clearance survey template", { referenceCode: "DD-TPL-19", estimatedManhours: 24, defaultPriority: "high", inputTemplate: RUDDER_CLEARANCE_SURVEY_TEMPLATE }),
      ]),
      system("dd_propeller", "Propeller", "Hull", [
        stdJob("dd_tpl_propeller_repair_polish", "Propeller repair and polishing template", { referenceCode: "DD-TPL-20", estimatedManhours: 24, defaultPriority: "high", inputTemplate: PROPELLER_REPAIR_POLISH_TEMPLATE }),
      ]),
      system("dd_hatch_cover", "Hatch Cover", "Deck", [
        stdJob("dd_tpl_hatch_cover_seal_test", "Hatch cover seal renewal and tightness test template", { referenceCode: "DD-TPL-21", estimatedManhours: 16, inputTemplate: HATCH_COVER_SEAL_TEST_TEMPLATE }),
      ]),
      system("dd_tank", "Tank", "Tanks", [
        stdJob("dd_tpl_tank_inspection_coating", "Tank inspection and coating template", { referenceCode: "DD-TPL-22", estimatedManhours: 32, defaultPriority: "high", inputTemplate: TANK_INSPECTION_COATING_TEMPLATE }),
      ]),
      system("dd_anodes", "Anodes", "Hull", [
        stdJob("dd_tpl_anode_renewal", "Anode renewal template", { referenceCode: "DD-TPL-23", estimatedManhours: 8, inputTemplate: ANODE_RENEWAL_TEMPLATE }),
      ]),
      system("dd_lifeboat_davit", "Lifeboat / Davit", "Safety", [
        stdJob("dd_tpl_lifeboat_davit_load_test", "Lifeboat and davit load test template", { referenceCode: "DD-TPL-24", estimatedManhours: 8, defaultPriority: "high", inputTemplate: LIFEBOAT_DAVIT_LOAD_TEST_TEMPLATE }),
      ]),
      system("dd_windlass_winch", "Windlass / Winch", "Deck", [
        stdJob("dd_tpl_windlass_winch_brake_test", "Windlass and winch brake test template", { referenceCode: "DD-TPL-25", estimatedManhours: 16, inputTemplate: WINDLASS_WINCH_BRAKE_TEST_TEMPLATE }),
      ]),
      system("dd_switchboard", "Switchboard", "Electrical", [
        stdJob("dd_tpl_switchboard_inspection_test", "Switchboard inspection and test template", { referenceCode: "DD-TPL-26", estimatedManhours: 8, defaultPriority: "high", inputTemplate: SWITCHBOARD_INSPECTION_TEST_TEMPLATE }),
      ]),
      system("dd_fuel_injector", "Fuel Injector", "Machinery", [
        stdJob("dd_tpl_fuel_injector_overhaul", "Fuel injector testing and overhaul template", { referenceCode: "DD-TPL-27", estimatedManhours: 24, inputTemplate: FUEL_INJECTOR_OVERHAUL_TEMPLATE }),
      ]),
      system("dd_exhaust_valve", "Exhaust Valve", "Machinery", [
        stdJob("dd_tpl_exhaust_valve_overhaul", "Main engine exhaust valve overhaul template", { referenceCode: "DD-TPL-28", estimatedManhours: 24, defaultPriority: "high", inputTemplate: EXHAUST_VALVE_OVERHAUL_TEMPLATE }),
      ]),
      system("dd_fuel_pump", "Fuel Pump", "Machinery", [
        stdJob("dd_tpl_fuel_pump_overhaul", "Main engine fuel pump overhaul template", { referenceCode: "DD-TPL-29", estimatedManhours: 24, defaultPriority: "high", inputTemplate: FUEL_PUMP_OVERHAUL_TEMPLATE }),
      ]),
      system("dd_starting_air_valve", "Starting Air Valve", "Machinery", [
        stdJob("dd_tpl_starting_air_valve_overhaul", "Starting air valve overhaul template", { referenceCode: "DD-TPL-30", estimatedManhours: 12, defaultPriority: "high", inputTemplate: STARTING_AIR_VALVE_OVERHAUL_TEMPLATE }),
      ]),
      system("dd_fwg", "Fresh Water Generator", "Machinery", [
        stdJob("dd_tpl_fwg_clean_descale", "FWG cleaning and descaling template", { referenceCode: "DD-TPL-31", estimatedManhours: 16, inputTemplate: FWG_CLEAN_DESCALE_TEMPLATE }),
      ]),
      system("dd_ows", "Oily Water Separator", "Machinery", [
        stdJob("dd_tpl_ows_overhaul_test", "OWS overhaul and test template", { referenceCode: "DD-TPL-32", estimatedManhours: 12, defaultPriority: "high", inputTemplate: OWS_OVERHAUL_TEST_TEMPLATE }),
      ]),
      system("dd_hvac_chiller", "HVAC / Chiller", "Machinery", [
        stdJob("dd_tpl_hvac_chiller_service", "HVAC and chiller compressor service template", { referenceCode: "DD-TPL-33", estimatedManhours: 16, inputTemplate: HVAC_CHILLER_SERVICE_TEMPLATE }),
      ]),
      system("dd_cargo_pump", "Cargo Pump", "Cargo", [
        stdJob("dd_tpl_cargo_pump_overhaul", "Cargo pump overhaul template", { referenceCode: "DD-TPL-34", estimatedManhours: 24, defaultPriority: "high", inputTemplate: CARGO_PUMP_OVERHAUL_TEMPLATE }),
      ]),
      system("dd_cargo_line", "Cargo Line", "Cargo", [
        stdJob("dd_tpl_cargo_line_pressure_test", "Cargo line pressure test template", { referenceCode: "DD-TPL-35", estimatedManhours: 16, defaultPriority: "high", inputTemplate: CARGO_LINE_PRESSURE_TEST_TEMPLATE }),
      ]),
      system("dd_cargo_tank_coating", "Cargo Tank Coating", "Cargo", [
        stdJob("dd_tpl_cargo_tank_coating_repair", "Cargo tank coating repair template", { referenceCode: "DD-TPL-36", estimatedManhours: 48, defaultPriority: "high", inputTemplate: CARGO_TANK_COATING_REPAIR_TEMPLATE }),
      ]),
      system("dd_navigation_equipment", "Navigation Equipment", "Navigation", [
        stdJob("dd_tpl_navigation_equipment_service", "Navigation equipment annual service template", { referenceCode: "DD-TPL-37", estimatedManhours: 8, inputTemplate: NAVIGATION_EQUIPMENT_SERVICE_TEMPLATE }),
      ]),
      system("dd_vdr", "VDR", "Navigation", [
        stdJob("dd_tpl_vdr_apt", "VDR annual performance test template", { referenceCode: "DD-TPL-38", estimatedManhours: 4, defaultPriority: "high", inputTemplate: VDR_APT_TEMPLATE }),
      ]),
      system("dd_instrument_calibration", "Instrument Calibration", "Instrumentation", [
        stdJob("dd_tpl_instrument_calibration", "Calibration of pressure, temperature and level instruments template", { referenceCode: "DD-TPL-39", estimatedManhours: 8, inputTemplate: INSTRUMENT_CALIBRATION_TEMPLATE }),
      ]),
      system("dd_alarm_monitoring", "Alarm Monitoring", "Instrumentation", [
        stdJob("dd_tpl_alarm_monitoring_test", "Alarm monitoring system test template", { referenceCode: "DD-TPL-40", estimatedManhours: 6, defaultPriority: "high", inputTemplate: ALARM_MONITORING_TEST_TEMPLATE }),
      ]),
      system("dd_galley", "Galley Equipment", "Accommodation", [
        stdJob("dd_tpl_galley_equipment_service", "Galley equipment service template", { referenceCode: "DD-TPL-41", estimatedManhours: 8, inputTemplate: GALLEY_EQUIPMENT_SERVICE_TEMPLATE }),
      ]),
      system("dd_sanitary", "Sanitary System", "Accommodation", [
        stdJob("dd_tpl_sanitary_pump_line_overhaul", "Sanitary pump and line overhaul template", { referenceCode: "DD-TPL-42", estimatedManhours: 12, inputTemplate: SANITARY_PUMP_LINE_OVERHAUL_TEMPLATE }),
      ]),
      system("dd_bwts", "BWTS", "Projects", [
        stdJob("dd_tpl_bwts_install_commission", "BWTS installation and commissioning template", { referenceCode: "DD-TPL-43", estimatedManhours: 200, defaultPriority: "critical", inputTemplate: BWTS_INSTALL_COMMISSION_TEMPLATE }),
      ]),
      system("dd_scrubber", "Scrubber", "Projects", [
        stdJob("dd_tpl_scrubber_install_commission", "Scrubber installation and commissioning template", { referenceCode: "DD-TPL-44", estimatedManhours: 240, defaultPriority: "critical", inputTemplate: SCRUBBER_INSTALL_COMMISSION_TEMPLATE }),
      ]),
      system("dd_fire_main_pump", "Fire Main / Fire Pump", "Safety", [
        stdJob("dd_tpl_fire_main_fire_pump_test", "Fire main and fire pump test template", { referenceCode: "DD-TPL-45", estimatedManhours: 8, defaultPriority: "high", inputTemplate: FIRE_MAIN_FIRE_PUMP_TEST_TEMPLATE }),
      ]),
      system("dd_co2_fixed_fire", "CO2 Fixed Fire System", "Safety", [
        stdJob("dd_tpl_co2_fixed_fire_system_survey", "CO2 fixed fire system survey template", { referenceCode: "DD-TPL-46", estimatedManhours: 6, defaultPriority: "high", inputTemplate: CO2_FIXED_FIRE_SYSTEM_SURVEY_TEMPLATE }),
      ]),
      system("dd_lifeboat_launch", "Lifeboat Launch / Recovery", "Safety", [
        stdJob("dd_tpl_lifeboat_launch_recovery", "Lifeboat launch and recovery test template", { referenceCode: "DD-TPL-47", estimatedManhours: 8, defaultPriority: "high", inputTemplate: LIFEBOAT_LAUNCH_RECOVERY_TEMPLATE }),
      ]),
      system("dd_fire_detection", "Fire Detection", "Safety", [
        stdJob("dd_tpl_fire_detection_alarm_test", "Fire detection alarm test template", { referenceCode: "DD-TPL-48", estimatedManhours: 8, defaultPriority: "high", inputTemplate: FIRE_DETECTION_ALARM_TEST_TEMPLATE }),
      ]),
      system("dd_emergency_generator", "Emergency Generator", "Electrical", [
        stdJob("dd_tpl_emergency_generator_test", "Emergency generator test template", { referenceCode: "DD-TPL-49", estimatedManhours: 8, defaultPriority: "high", inputTemplate: EMERGENCY_GENERATOR_TEST_TEMPLATE }),
      ]),
      system("dd_emergency_air_compressor", "Emergency Air Compressor", "Machinery", [
        stdJob("dd_tpl_emergency_air_compressor_test", "Emergency air compressor test template", { referenceCode: "DD-TPL-50", estimatedManhours: 6, defaultPriority: "high", inputTemplate: EMERGENCY_AIR_COMPRESSOR_TEST_TEMPLATE }),
      ]),
      system("dd_anchor_chain", "Anchor Chain / Cable", "Deck", [
        stdJob("dd_tpl_anchor_chain_cable_survey", "Anchor chain and cable survey template", { referenceCode: "DD-TPL-51", estimatedManhours: 16, defaultPriority: "high", inputTemplate: ANCHOR_CHAIN_CABLE_SURVEY_TEMPLATE }),
      ]),
      system("dd_mooring_rope_winch", "Mooring Rope / Winch", "Deck", [
        stdJob("dd_tpl_mooring_rope_winch_inspection", "Mooring rope and winch inspection template", { referenceCode: "DD-TPL-52", estimatedManhours: 8, inputTemplate: MOORING_ROPE_WINCH_INSPECTION_TEMPLATE }),
      ]),
      system("dd_accommodation_hvac_duct", "Accommodation HVAC Duct", "Accommodation", [
        stdJob("dd_tpl_accommodation_hvac_duct_clean", "Accommodation HVAC duct cleaning template", { referenceCode: "DD-TPL-53", estimatedManhours: 16, inputTemplate: ACCOMMODATION_HVAC_DUCT_CLEAN_TEMPLATE }),
      ]),
      system("dd_waste_incinerator", "Waste Incinerator", "Machinery", [
        stdJob("dd_tpl_waste_incinerator_service", "Waste incinerator service template", { referenceCode: "DD-TPL-54", estimatedManhours: 8, inputTemplate: WASTE_INCINERATOR_SERVICE_TEMPLATE }),
      ]),
      system("dd_sewage_treatment", "Sewage Treatment Plant", "Machinery", [
        stdJob("dd_tpl_sewage_treatment_plant_service", "Sewage treatment plant service template", { referenceCode: "DD-TPL-55", estimatedManhours: 12, inputTemplate: SEWAGE_TREATMENT_PLANT_SERVICE_TEMPLATE }),
      ]),
      system("dd_quick_closing_valves", "Quick Closing Valves", "Safety", [
        stdJob("dd_tpl_quick_closing_valve_test", "Quick closing valve test template", { referenceCode: "DD-TPL-56", estimatedManhours: 6, defaultPriority: "high", inputTemplate: QUICK_CLOSING_VALVE_TEST_TEMPLATE }),
      ]),
      system("dd_remote_valve_control", "Remote Valve Control", "Valves", [
        stdJob("dd_tpl_remote_valve_control_test", "Remote valve control test template", { referenceCode: "DD-TPL-57", estimatedManhours: 8, defaultPriority: "high", inputTemplate: REMOTE_VALVE_CONTROL_TEST_TEMPLATE }),
      ]),
      system("dd_tank_level_gauge", "Tank Level Gauge", "Instrumentation", [
        stdJob("dd_tpl_tank_level_gauge_service", "Tank level gauge service template", { referenceCode: "DD-TPL-58", estimatedManhours: 8, inputTemplate: TANK_LEVEL_GAUGE_SERVICE_TEMPLATE }),
      ]),
      system("dd_gas_detection", "Gas Detection", "Instrumentation", [
        stdJob("dd_tpl_gas_detection_system_test", "Gas detection system test template", { referenceCode: "DD-TPL-59", estimatedManhours: 8, defaultPriority: "high", inputTemplate: GAS_DETECTION_SYSTEM_TEST_TEMPLATE }),
      ]),
      system("dd_load_line_draft_marks", "Load Line / Draft Marks", "Hull", [
        stdJob("dd_tpl_load_line_mark_draft_mark_paint", "Load line and draft mark painting template", { referenceCode: "DD-TPL-60", estimatedManhours: 8, defaultPriority: "high", inputTemplate: LOAD_LINE_MARK_DRAFT_MARK_PAINT_TEMPLATE }),
      ]),
    ]),
  ],
};

/** Master job library seed — MTIL-generated phases + legacy departments until migrated. */
export const JOB_LIBRARY_CATALOG: JobLibrarySeedNode[] = [
  DRY_DOCK_SHIPYARD_TEMPLATE_CATALOG,
  generatePhase1JobLibraryTree(),
  ...workbookCatalogEntry(PHASE1_WORKBOOK_V04_PATH, generatePhase1WorkbookJobLibraryTree),
  generatePhase2JobLibraryTree(),
  ...workbookCatalogEntry(PHASE2_WORKBOOK_V05_PATH, generatePhase2WorkbookJobLibraryTree),
  generatePhase3JobLibraryTree(),
  ...workbookCatalogEntry(PHASE3_WORKBOOK_V06_PATH, generatePhase3WorkbookJobLibraryTree),
  ...workbookCatalogEntry(PHASE4_WORKBOOK_V07_PATH, generatePhase4WorkbookJobLibraryTree),
  ...workbookCatalogEntry(PHASE5_WORKBOOK_V08_PATH, generatePhase5WorkbookJobLibraryTree),
  ...workbookCatalogEntry(PHASE6_WORKBOOK_V09_PATH, generatePhase6WorkbookJobLibraryTree),
  ...workbookCatalogEntry(PHASE7_WORKBOOK_V10_PATH, generatePhase7WorkbookJobLibraryTree),
  ...workbookCatalogEntry(PHASE8_WORKBOOK_V11_PATH, generatePhase8WorkbookJobLibraryTree),
  ...workbookCatalogEntry(MASTER_REPOSITORY_V12_PATH, generateMasterRepositoryJobLibraryTree),
  ...(isEmdrMasterRepositoryPresent()
    ? (() => {
        const tree = generateEmdrMasterRepositoryTree();
        return tree ? [tree] : [];
      })()
    : []),
  ...(!isEmdrMasterRepositoryPresent() &&
  V2_SPRINT_REGISTRY.some((s) => {
    const emdr = path.join(EMDR_V201_WORKBOOKS_DIR, s.filename);
    const legacy = path.join(MTIL_V2_WORKBOOKS_DIR, s.filename);
    return fs.existsSync(emdr) || fs.existsSync(legacy);
  })
    ? (() => {
        const tree = generateV201CombinedJobLibraryTree();
        return tree ? [tree] : [];
      })()
    : []),
  {
    code: "machinery_jobs",
    name: "Machinery Jobs",
    nodeType: "department",
    department: "Machinery",
    children: [
      category("machinery", "Machinery", "Machinery", [
        system("main_engine", "Main Engine", "Machinery", [
          machinery("me_cylinders", "Cylinders", [
            component("me_cyl_liner", "Cylinder Liner", [
              stdJob("me_liner_inspect", "Inspect cylinder liner wear", { estimatedManhours: 16, defaultPriority: "high" }),
              stdJob("me_liner_renew", "Renew cylinder liner", { estimatedManhours: 48, defaultPriority: "critical" }),
            ]),
            component("me_piston", "Piston & Rings", [
              stdJob("me_piston_inspect", "Inspect piston crown and rings", { estimatedManhours: 12 }),
              stdJob("me_piston_overhaul", "Overhaul piston assembly", { estimatedManhours: 40 }),
            ]),
          ]),
          machinery("me_fuel", "Fuel System", [
            component("me_injectors", "Fuel Injectors", [
              stdJob("me_injector_test", "Test and overhaul fuel injectors", { estimatedManhours: 24 }),
            ]),
          ]),
        ]),
        system("aux_engine", "Auxiliary Engine", "Machinery", [
          machinery("ae_general", "General", [
            component("ae_overhaul", "Overhaul", [
              stdJob("ae_top_overhaul", "Top overhaul auxiliary engine", { estimatedManhours: 32 }),
              stdJob("ae_full_overhaul", "Full overhaul auxiliary engine", { estimatedManhours: 120 }),
            ]),
          ]),
        ]),
        system("boiler", "Boiler", "Machinery", [
          machinery("boiler_pressure", "Pressure Parts", [
            component("boiler_tubes", "Tubes", [
              stdJob("boiler_tube_survey", "Boiler tube survey and plugging", { estimatedManhours: 40 }),
            ]),
          ]),
        ]),
        system("fwg", "FWG", "Machinery", [
          machinery("fwg_plant", "Fresh Water Generator", [
            component("fwg_condenser", "Condenser", [
              stdJob("fwg_clean", "Clean FWG condenser and plates", { estimatedManhours: 16 }),
            ]),
          ]),
        ]),
        system("ows", "OWS", "Machinery", [
          machinery("ows_unit", "Oily Water Separator", [
            component("ows_filter", "Filter", [
              stdJob("ows_overhaul", "Overhaul OWS unit", { estimatedManhours: 12 }),
            ]),
          ]),
        ]),
        system("purifier", "Purifier", "Machinery", [
          machinery("purifier_unit", "Purifier", [
            component("purifier_bowl", "Bowl", [
              stdJob("purifier_overhaul", "Overhaul fuel/lube oil purifier", { estimatedManhours: 8 }),
            ]),
          ]),
        ]),
        system("pump", "Pump", "Machinery", [
          machinery("pump_general", "Pumps", [
            component("pump_seal", "Mechanical Seal", [
              stdJob("pump_seal_renew", "Renew pump mechanical seal", { estimatedManhours: 6 }),
            ]),
          ]),
        ]),
        system("compressor", "Compressor", "Machinery", [
          machinery("air_compressor", "Air Compressor", [
            component("compressor_valves", "Valves", [
              stdJob("compressor_overhaul", "Overhaul starting air compressor", { estimatedManhours: 16 }),
            ]),
          ]),
        ]),
        system("heat_exchanger", "Heat Exchanger", "Machinery", [
          machinery("he_cooler", "Coolers", [
            component("he_plates", "Plates", [
              stdJob("he_clean", "Clean and pressure test heat exchanger", { estimatedManhours: 12 }),
            ]),
          ]),
        ]),
        system("hvac", "HVAC", "Machinery", [
          machinery("hvac_plant", "HVAC Plant", [
            component("hvac_coil", "Coils", [
              stdJob("hvac_service", "Service HVAC plant and coils", { estimatedManhours: 8 }),
            ]),
          ]),
        ]),
        system("steering_gear", "Steering Gear", "Machinery", [
          machinery("steering_rams", "Rams", [
            component("steering_seals", "Seals", [
              stdJob("steering_overhaul", "Overhaul steering gear rams and seals", { estimatedManhours: 24 }),
            ]),
          ]),
        ]),
        system("thrusters", "Thrusters", "Machinery", [
          machinery("bow_thruster", "Bow Thruster", [
            component("thruster_motor", "Motor", [
              stdJob("thruster_inspect", "Inspect bow thruster and seals", { estimatedManhours: 16 }),
            ]),
          ]),
        ]),
      ]),
    ],
  },
  {
    code: "pipe_jobs",
    name: "Pipe Jobs",
    nodeType: "department",
    department: "Piping",
    children: [
      category("piping", "Piping", "Piping", [
        system("sea_water", "Sea Water", "Piping", [
          stdJob("sw_line_survey", "Survey sea water lines", { estimatedManhours: 8 }),
        ]),
        system("fresh_water", "Fresh Water", "Piping", [
          stdJob("fw_line_survey", "Survey fresh water lines", { estimatedManhours: 6 }),
        ]),
        system("fire_main", "Fire Main", "Piping", [
          stdJob("fire_main_test", "Pressure test fire main", { estimatedManhours: 8 }),
        ]),
        system("ballast", "Ballast", "Piping", [
          stdJob("ballast_survey", "Survey ballast piping", { estimatedManhours: 12 }),
        ]),
        system("fuel_oil", "Fuel Oil", "Piping", [
          stdJob("fo_line_survey", "Survey fuel oil lines", { estimatedManhours: 10 }),
        ]),
      ]),
    ],
  },
  {
    code: "valve_jobs",
    name: "Valve Jobs",
    nodeType: "department",
    department: "Valves",
    children: [
      category("valves", "Valves", "Valves", [
        system("sea_valves", "Sea Valves", "Valves", [
          stdJob("sea_valve_overhaul", "Overhaul sea chest valves", { estimatedManhours: 16, defaultPriority: "high" }),
        ]),
        system("cargo_valves", "Cargo Valves", "Valves", [
          stdJob("cargo_valve_survey", "Survey cargo system valves", { estimatedManhours: 12 }),
        ]),
      ]),
    ],
  },
  {
    code: "electrical_jobs",
    name: "Electrical Jobs",
    nodeType: "department",
    department: "Electrical",
    children: [
      category("electrical", "Electrical", "Electrical", [
        system("generators", "Generators", "Electrical", [
          stdJob("gen_overhaul", "Overhaul auxiliary generator", { estimatedManhours: 32 }),
        ]),
        system("switchboard", "Switchboard", "Electrical", [
          stdJob("swbd_survey", "Survey main switchboard", { estimatedManhours: 8 }),
        ]),
        system("motors", "Motors", "Electrical", [
          stdJob("motor_insulate_test", "Insulation test critical motors", { estimatedManhours: 12 }),
        ]),
        system("navigation_elec", "Navigation", "Electrical", [
          stdJob("nav_equip_survey", "Survey navigation equipment", { estimatedManhours: 8 }),
        ]),
        system("automation", "Automation", "Electrical", [
          stdJob("plc_backup", "Backup and test PLC systems", { estimatedManhours: 6 }),
        ]),
      ]),
    ],
  },
  {
    code: "hull_jobs",
    name: "Hull Jobs",
    nodeType: "department",
    department: "Hull",
    children: [
      category("hull", "Hull", "Hull", [
        system("hull_cleaning", "Hull Cleaning", "Hull", [
          stdJob("hull_hp_clean", "High pressure hull cleaning", { estimatedManhours: 24 }),
        ]),
        system("sea_chest", "Sea Chest", "Hull", [
          stdJob("sea_chest_clean", "Clean and inspect sea chests", { estimatedManhours: 12, defaultPriority: "high" }),
        ]),
        system("anodes", "Anodes", "Hull", [
          stdJob("anode_renew", "Renew hull anodes", { estimatedManhours: 8 }),
        ]),
        system("propeller", "Propeller", "Hull", [
          machinery("prop", "Propeller", [
            component("prop_blades", "Blades", [
              stdJob("prop_polish", "Propeller polishing", { estimatedManhours: 8 }),
              stdJob("prop_repair", "Propeller blade repair", { estimatedManhours: 24, defaultPriority: "high" }),
            ]),
          ]),
        ]),
        system("tailshaft", "Tailshaft", "Hull", [
          stdJob("tailshaft_withdrawal", "Tailshaft withdrawal and survey", { estimatedManhours: 80, defaultPriority: "critical" }),
        ]),
        system("rudder", "Rudder", "Hull", [
          stdJob("rudder_clearance", "Rudder pintle clearance and survey", { estimatedManhours: 24 }),
        ]),
        system("painting", "Painting", "Painting", [
          stdJob("fb_paint", "Flat bottom painting", { estimatedManhours: 40 }),
          stdJob("boottop_paint", "Boot top painting", { estimatedManhours: 32 }),
        ]),
        system("steel", "Steel Renewal", "Steel", [
          stdJob("shell_renewal", "Shell plate renewal", { estimatedManhours: 48 }),
        ]),
      ]),
    ],
  },
  {
    code: "tank_jobs",
    name: "Tank Jobs",
    nodeType: "department",
    department: "Tanks",
    children: [
      category("tanks", "Tanks", "Tanks", [
        system("ballast_tanks", "Ballast Tanks", "Tanks", [
          stdJob("bt_inspect", "Ballast tank inspection and coating", { estimatedManhours: 32 }),
        ]),
        system("cargo_tanks", "Cargo Tanks", "Tanks", [
          stdJob("ct_inspect", "Cargo tank inspection", { estimatedManhours: 40 }),
        ]),
        system("fuel_tanks", "Fuel Tanks", "Tanks", [
          stdJob("ft_clean", "Fuel tank cleaning", { estimatedManhours: 24 }),
        ]),
      ]),
    ],
  },
  {
    code: "deck_machinery",
    name: "Deck Machinery",
    nodeType: "department",
    department: "Deck",
    children: [
      category("deck_mach", "Deck Machinery", "Deck", [
        system("windlass", "Windlass", "Deck", [
          stdJob("windlass_overhaul", "Overhaul windlass", { estimatedManhours: 16 }),
        ]),
        system("crane", "Crane", "Deck", [
          stdJob("crane_survey", "Crane load test and survey", { estimatedManhours: 12 }),
        ]),
        system("hatch_cover", "Hatch Cover", "Deck", [
          stdJob("hatch_seal_renew", "Renew hatch cover seals", { estimatedManhours: 16 }),
        ]),
      ]),
    ],
  },
  {
    code: "safety_jobs",
    name: "Safety",
    nodeType: "department",
    department: "Safety",
    children: [
      category("safety", "Safety Equipment", "Safety", [
        system("lifeboat", "Lifeboat", "Safety", [
          stdJob("lb_davit_test", "Lifeboat and davit annual service", { estimatedManhours: 8, defaultPriority: "high" }),
        ]),
        system("co2", "CO₂ System", "Safety", [
          stdJob("co2_survey", "CO₂ fixed fire system survey", { estimatedManhours: 6 }),
        ]),
      ]),
    ],
  },
  {
    code: "navigation_jobs",
    name: "Navigation",
    nodeType: "department",
    department: "Navigation",
    children: [
      category("navigation", "Navigation", "Navigation", [
        system("radar", "Radar", "Navigation", [
          stdJob("radar_service", "Radar annual service", { estimatedManhours: 4 }),
        ]),
        system("vdr", "VDR", "Navigation", [
          stdJob("vdr_download", "VDR annual performance test", { estimatedManhours: 4 }),
        ]),
      ]),
    ],
  },
  {
    code: "cargo_jobs",
    name: "Cargo System",
    nodeType: "department",
    department: "Cargo",
    children: [
      category("cargo", "Cargo System", "Cargo", [
        system("cargo_pumps", "Cargo Pumps", "Cargo", [
          machinery("cargo_pump", "Cargo Pump", [
            component("pump_overhaul", "Pump Overhaul", [
              stdJob("cargo_pump_overhaul", "Overhaul cargo pump", { estimatedManhours: 24 }),
              stdJob("cargo_pump_seal", "Renew cargo pump seals", { estimatedManhours: 8 }),
            ]),
          ]),
        ]),
        system("cargo_lines", "Cargo Lines", "Cargo", [
          stdJob("cargo_line_survey", "Survey cargo piping and valves", { estimatedManhours: 16 }),
        ]),
        system("cargo_tank_coating", "Tank Coating", "Cargo", [
          stdJob("cargo_tank_coating_renew", "Renew cargo tank coating", { estimatedManhours: 48 }),
        ]),
      ]),
    ],
  },
  {
    code: "accommodation_jobs",
    name: "Accommodation",
    nodeType: "department",
    department: "Accommodation",
    children: [
      category("accommodation", "Accommodation", "Accommodation", [
        system("galley", "Galley", "Accommodation", [
          stdJob("galley_equip_service", "Service galley equipment", { estimatedManhours: 8 }),
        ]),
        system("sanitary", "Sanitary", "Accommodation", [
          stdJob("sanitary_overhaul", "Overhaul sanitary pumps and lines", { estimatedManhours: 12 }),
        ]),
        system("accommodation_hvac", "Accommodation HVAC", "Accommodation", [
          stdJob("accom_hvac_service", "Service accommodation HVAC", { estimatedManhours: 16 }),
        ]),
        system("accommodation_paint", "Accommodation Paint", "Accommodation", [
          stdJob("accom_paint", "Accommodation repaint programme", { estimatedManhours: 40 }),
        ]),
      ]),
    ],
  },
  {
    code: "instrumentation_jobs",
    name: "Instrumentation",
    nodeType: "department",
    department: "Instrumentation",
    children: [
      category("instrumentation", "Instrumentation", "Instrumentation", [
        system("calibration", "Calibration", "Instrumentation", [
          stdJob("instrument_calibrate", "Calibrate critical instruments", { estimatedManhours: 8 }),
        ]),
        system("level_gauges", "Level Gauges", "Instrumentation", [
          stdJob("level_gauge_service", "Service tank level gauges", { estimatedManhours: 6 }),
        ]),
        system("flow_meters", "Flow Meters", "Instrumentation", [
          stdJob("flow_meter_calibrate", "Calibrate flow meters", { estimatedManhours: 8 }),
        ]),
        system("alarm_systems", "Alarm Systems", "Instrumentation", [
          stdJob("alarm_test", "Test alarm and monitoring systems", { estimatedManhours: 6, defaultPriority: "high" }),
        ]),
      ]),
    ],
  },
  {
    code: "new_installations",
    name: "New Installations",
    nodeType: "department",
    department: "Projects",
    children: [
      category("new_inst", "New Installations", "Projects", [
        system("bwts", "BWTS", "Projects", [
          stdJob("bwts_install", "Ballast water treatment system installation", { estimatedManhours: 200 }),
        ]),
        system("scrubber", "Scrubber", "Projects", [
          stdJob("scrubber_install", "Exhaust gas scrubber installation", { estimatedManhours: 240 }),
        ]),
      ]),
    ],
  },
];
