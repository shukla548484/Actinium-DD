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

/** Master job library seed — MTIL-generated phases + legacy departments until migrated. */
export const JOB_LIBRARY_CATALOG: JobLibrarySeedNode[] = [
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
