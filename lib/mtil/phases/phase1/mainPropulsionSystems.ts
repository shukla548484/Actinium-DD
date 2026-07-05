import type { MtilComponentDef, MtilSystemDef } from "../../types";

const WEAR: MtilComponentDef["actions"] = [
  "inspect",
  "survey",
  "measure",
  "renew",
  "repair",
  "report",
];
const OVERHAUL: MtilComponentDef["actions"] = [
  "inspect",
  "overhaul",
  "repair",
  "test",
  "replace",
  "adjust",
  "clean",
  "report",
];
const INSTRUMENT: MtilComponentDef["actions"] = [
  "inspect",
  "test",
  "calibrate",
  "adjust",
  "report",
];
const FIVE_YR: MtilComponentDef["actions"] = ["survey", "overhaul", "test", "report"];
const SHAFT: MtilComponentDef["actions"] = [
  "inspect",
  "survey",
  "measure",
  "overhaul",
  "repair",
  "report",
];
const FUEL: MtilComponentDef["actions"] = [
  "inspect",
  "overhaul",
  "clean",
  "test",
  "replace",
  "adjust",
  "report",
];

function comp(
  code: string,
  name: string,
  actions: MtilComponentDef["actions"],
  opts: Partial<MtilComponentDef> = {},
): MtilComponentDef {
  return { code, name, actions, estimatedManhoursBase: 8, ...opts };
}

/**
 * Phase 1 — Main Propulsion Systems taxonomy.
 * Jobs are generated from component × action matrix (not hand-authored forms).
 */
export const PHASE1_MAIN_PROPULSION_SYSTEMS: MtilSystemDef[] = [
  {
    code: "ME_CYL",
    name: "Cylinders & Combustion",
    workshop: "Machinery",
    machinery: [
      {
        code: "CYL_UNIT",
        name: "Cylinder Unit",
        components: [
          comp("CYL_LINER", "Cylinder Liner", WEAR, {
            dynamicTemplateKey: "me_cylinder_survey",
            measurementRefs: ["ME_CYL_LINER_WEAR", "ME_CYL_LINER_OVAL"],
            estimatedManhoursBase: 16,
          }),
          comp("CYL_HEAD", "Cylinder Head", OVERHAUL, { dynamicTemplateKey: "me_cyl_head_overhaul" }),
          comp("EXH_VALVE", "Exhaust Valve", OVERHAUL, { dynamicTemplateKey: "me_exh_valve_overhaul" }),
          comp("PISTON", "Piston Crown", OVERHAUL, { dynamicTemplateKey: "me_piston_overhaul" }),
          comp("PISTON_RINGS", "Piston Rings", OVERHAUL, { dynamicTemplateKey: "me_piston_overhaul" }),
          comp("FUEL_VALVE", "Fuel Valve", OVERHAUL, { dynamicTemplateKey: "me_fuel_system" }),
          comp("IND_COCK", "Indicator Cock", INSTRUMENT, { dynamicTemplateKey: "me_instrument_test" }),
          comp("SCAV_PORTS", "Scavenge Ports", WEAR, { dynamicTemplateKey: "me_general_inspect" }),
          comp("CYL_OIL", "Cylinder Lubrication", FUEL, { dynamicTemplateKey: "me_lube_system" }),
          comp("CYL_PRESS", "Cylinder Pressure Testing", INSTRUMENT, {
            dynamicTemplateKey: "me_instrument_test",
          }),
        ],
      },
    ],
  },
  {
    code: "ME_FUEL",
    name: "Fuel System",
    workshop: "Machinery",
    machinery: [
      {
        code: "FUEL_INJ",
        name: "Fuel Injection",
        components: [
          comp("INJECTOR", "Fuel Injector", FUEL, { dynamicTemplateKey: "me_fuel_injector_overhaul" }),
          comp("INJ_PUMP", "Injection Pump", FUEL, { dynamicTemplateKey: "me_fuel_pump_overhaul" }),
          comp("INJ_PIPE", "High Pressure Pipe", FUEL, { dynamicTemplateKey: "me_fuel_system" }),
          comp("VIT", "Variable Injection Timing", INSTRUMENT, { dynamicTemplateKey: "me_governor_cal" }),
        ],
      },
      {
        code: "FUEL_SUPPLY",
        name: "Fuel Supply",
        components: [
          comp("SUPPLY_PUMP", "Fuel Supply Pump", FUEL, { dynamicTemplateKey: "me_fuel_system" }),
          comp("VISC_HEATER", "Viscosity Heater", FUEL, { dynamicTemplateKey: "me_fuel_system" }),
          comp("FUEL_FILTER", "Fuel Filter", FUEL, { dynamicTemplateKey: "me_fuel_system" }),
          comp("FUEL_METER", "Fuel Flow Meter", INSTRUMENT, { dynamicTemplateKey: "me_instrument_test" }),
          comp("PURGE_SYS", "Fuel Purge System", FUEL, { dynamicTemplateKey: "me_fuel_system" }),
        ],
      },
    ],
  },
  {
    code: "ME_LO",
    name: "Lubrication System",
    workshop: "Machinery",
    machinery: [
      {
        code: "LO_SYS",
        name: "Lube Oil System",
        components: [
          comp("LO_PUMP", "LO Pump", OVERHAUL, { dynamicTemplateKey: "me_lube_system" }),
          comp("LO_COOLER", "LO Cooler", OVERHAUL, { dynamicTemplateKey: "me_lube_system" }),
          comp("LO_FILTER", "LO Auto Filter", FUEL, { dynamicTemplateKey: "me_lube_system" }),
          comp("LO_PURIFIER", "LO Purifier Feed", FUEL, { dynamicTemplateKey: "me_lube_system" }),
          comp("LO_TANK", "LO Sump Tank", WEAR, { dynamicTemplateKey: "me_lube_system" }),
          comp("LO_PRESS", "LO Pressure System", INSTRUMENT, { dynamicTemplateKey: "me_instrument_test" }),
        ],
      },
    ],
  },
  {
    code: "ME_JCW",
    name: "Cooling Water System",
    workshop: "Machinery",
    machinery: [
      {
        code: "JCW",
        name: "Jacket Cooling",
        components: [
          comp("JCW_PUMP", "JCW Pump", OVERHAUL, { dynamicTemplateKey: "me_cooling_system" }),
          comp("JCW_COOLER", "JCW Cooler", OVERHAUL, { dynamicTemplateKey: "me_cooling_system" }),
          comp("JCW_THERMO", "Thermostatic Valve", INSTRUMENT, { dynamicTemplateKey: "me_instrument_test" }),
          comp("JCW_ZINC", "Cooler Zinc Anodes", WEAR, { dynamicTemplateKey: "me_general_inspect" }),
          comp("JCW_LINES", "JCW Piping", WEAR, { dynamicTemplateKey: "me_cooling_system" }),
        ],
      },
      {
        code: "PCW",
        name: "Piston Cooling",
        components: [
          comp("PCW_PUMP", "Piston Cooling Pump", OVERHAUL, { dynamicTemplateKey: "me_cooling_system" }),
          comp("PCW_COOLER", "Piston Cooling Cooler", OVERHAUL, { dynamicTemplateKey: "me_cooling_system" }),
          comp("PCW_FLOW", "PCW Flow Monitoring", INSTRUMENT, { dynamicTemplateKey: "me_instrument_test" }),
        ],
      },
    ],
  },
  {
    code: "ME_EXH",
    name: "Exhaust & Turbocharger",
    workshop: "Machinery",
    machinery: [
      {
        code: "TURBO",
        name: "Turbocharger",
        components: [
          comp("TC_ROTOR", "Turbo Rotor", OVERHAUL, {
            dynamicTemplateKey: "me_turbo_overhaul",
            measurementRefs: ["ME_TURBO_RPM", "ME_TURBO_EXH_TEMP"],
          }),
          comp("TC_BEARING", "Turbo Bearings", OVERHAUL, { dynamicTemplateKey: "me_turbo_overhaul" }),
          comp("TC_SEAL", "Turbo Seals", OVERHAUL, { dynamicTemplateKey: "me_turbo_overhaul" }),
          comp("TC_CASING", "Turbo Casing", WEAR, { dynamicTemplateKey: "me_turbo_overhaul" }),
          comp("TC_WASH", "Turbo Water Washing", FUEL, { dynamicTemplateKey: "me_turbo_overhaul" }),
        ],
      },
      {
        code: "EXH_SYS",
        name: "Exhaust System",
        components: [
          comp("EXH_MANIFOLD", "Exhaust Manifold", WEAR, { dynamicTemplateKey: "me_turbo_overhaul" }),
          comp("EXH_INSUL", "Exhaust Insulation", WEAR, { dynamicTemplateKey: "me_general_inspect" }),
          comp("EXH_VALVE_ACT", "Exhaust Valve Actuator", INSTRUMENT, {
            dynamicTemplateKey: "me_instrument_test",
          }),
        ],
      },
    ],
  },
  {
    code: "ME_SCAV",
    name: "Scavenge Air System",
    workshop: "Machinery",
    machinery: [
      {
        code: "SCAV",
        name: "Scavenge Air",
        components: [
          comp("SCAV_BLOWER", "Scavenge Blower", OVERHAUL, { dynamicTemplateKey: "me_turbo_overhaul" }),
          comp("SCAV_COOLER", "Scavenge Air Cooler", OVERHAUL, { dynamicTemplateKey: "me_cooling_system" }),
          comp("SCAV_DRAIN", "Scavenge Drain System", FUEL, { dynamicTemplateKey: "me_general_inspect" }),
          comp("SCAV_PRESS", "Scavenge Pressure", INSTRUMENT, {
            dynamicTemplateKey: "me_instrument_test",
            measurementRefs: ["ME_SCAV_AIR_PRESS"],
          }),
        ],
      },
    ],
  },
  {
    code: "ME_START",
    name: "Starting Air System",
    workshop: "Machinery",
    machinery: [
      {
        code: "START_AIR",
        name: "Starting Air",
        components: [
          comp("START_VALVE", "Starting Air Valve", OVERHAUL, { dynamicTemplateKey: "me_start_air_valve" }),
          comp("START_DIST", "Starting Air Distributor", OVERHAUL, { dynamicTemplateKey: "me_start_air_valve" }),
          comp("START_BOTTLE", "Starting Air Bottle", WEAR, { dynamicTemplateKey: "me_start_air_valve" }),
          comp("START_COMP", "Starting Air Compressor", OVERHAUL, { dynamicTemplateKey: "me_start_air_valve" }),
          comp("START_INTERLOCK", "Starting Interlock", INSTRUMENT, { dynamicTemplateKey: "me_safety_test" }),
        ],
      },
    ],
  },
  {
    code: "ME_MAN",
    name: "Maneuvering System",
    workshop: "Machinery",
    machinery: [
      {
        code: "MANEUVER",
        name: "Maneuvering",
        components: [
          comp("MAN_LEVER", "Maneuvering Lever", FIVE_YR, { dynamicTemplateKey: "me_maneuvering_5yr" }),
          comp("MAN_CABLE", "Control Cable", FIVE_YR, { dynamicTemplateKey: "me_maneuvering_5yr" }),
          comp("MAN_LINK", "Linkage & Rod End", FIVE_YR, { dynamicTemplateKey: "me_maneuvering_5yr" }),
          comp("MAN_FOLLOW", "Follow-up System", FIVE_YR, { dynamicTemplateKey: "me_maneuvering_5yr" }),
          comp("MAN_MODE", "Load / Maneuver Mode", INSTRUMENT, { dynamicTemplateKey: "me_maneuvering_5yr" }),
        ],
      },
    ],
  },
  {
    code: "ME_PNEU",
    name: "Pneumatic System",
    workshop: "Machinery",
    machinery: [
      {
        code: "PNEU",
        name: "Pneumatic",
        components: [
          comp("PNEU_CTRL", "Control Air Compressor", FIVE_YR, { dynamicTemplateKey: "me_pneumatic_5yr" }),
          comp("PNEU_DRY", "Air Dryer", FIVE_YR, { dynamicTemplateKey: "me_pneumatic_5yr" }),
          comp("PNEU_VALVE", "Control Air Valves", FIVE_YR, { dynamicTemplateKey: "me_pneumatic_5yr" }),
          comp("PNEU_REG", "Pressure Regulators", INSTRUMENT, { dynamicTemplateKey: "me_pneumatic_5yr" }),
          comp("PNEU_ALARM", "Low Pressure Alarm", INSTRUMENT, { dynamicTemplateKey: "me_instrument_test" }),
        ],
      },
    ],
  },
  {
    code: "ME_GOV",
    name: "Governor & Control",
    workshop: "Machinery",
    machinery: [
      {
        code: "GOV",
        name: "Governor",
        components: [
          comp("GOV_HEAD", "Governor Head", INSTRUMENT, { dynamicTemplateKey: "me_governor_cal" }),
          comp("GOV_OIL", "Governor Oil System", FUEL, { dynamicTemplateKey: "me_governor_cal" }),
          comp("GOV_LINK", "Governor Linkage", OVERHAUL, { dynamicTemplateKey: "me_governor_cal" }),
          comp("GOV_PICKUP", "Speed Pick-up", INSTRUMENT, { dynamicTemplateKey: "me_governor_cal" }),
          comp("GOV_TEST", "Governor Load Test", INSTRUMENT, { dynamicTemplateKey: "me_governor_cal" }),
        ],
      },
    ],
  },
  {
    code: "ME_REV",
    name: "Reversing System",
    workshop: "Machinery",
    machinery: [
      {
        code: "REV",
        name: "Reversing",
        components: [
          comp("REV_SERVO", "Reversing Servo Motor", OVERHAUL, { dynamicTemplateKey: "me_reversing" }),
          comp("REV_CAM", "Reversing Cam", OVERHAUL, { dynamicTemplateKey: "me_reversing" }),
          comp("REV_INTER", "Reversing Interlock", INSTRUMENT, { dynamicTemplateKey: "me_safety_test" }),
          comp("REV_TIMING", "Fuel Timing Change", INSTRUMENT, { dynamicTemplateKey: "me_reversing" }),
        ],
      },
    ],
  },
  {
    code: "ME_SAFE",
    name: "Safety & Monitoring",
    workshop: "Machinery",
    machinery: [
      {
        code: "SAFETY",
        name: "Safety Systems",
        components: [
          comp("EMG_STOP", "Emergency Stop", INSTRUMENT, { dynamicTemplateKey: "me_emergency_stop" }),
          comp("OVERSPEED", "Overspeed Trip", INSTRUMENT, { dynamicTemplateKey: "me_overspeed_trip" }),
          comp("LO_ALARM", "LO Low Pressure Trip", INSTRUMENT, { dynamicTemplateKey: "me_safety_test" }),
          comp("JACKET_ALARM", "JCW High Temp Trip", INSTRUMENT, { dynamicTemplateKey: "me_safety_test" }),
          comp("EXH_ALARM", "Exhaust High Temp Alarm", INSTRUMENT, { dynamicTemplateKey: "me_safety_test" }),
          comp("CRANKCASE", "Crankcase Explosion Relief", WEAR, { dynamicTemplateKey: "me_safety_test" }),
          comp("SHD_DET", "Bearing Wear Detection", INSTRUMENT, { dynamicTemplateKey: "me_safety_test" }),
        ],
      },
      {
        code: "MONITOR",
        name: "Performance Monitoring",
        components: [
          comp("PERF_LOG", "Performance Log Review", INSTRUMENT, { dynamicTemplateKey: "me_performance_test" }),
          comp("SLOW_DOWN", "Slow-down System", INSTRUMENT, { dynamicTemplateKey: "me_safety_test" }),
          comp("SHUTDOWN", "Auto Shutdown System", INSTRUMENT, { dynamicTemplateKey: "me_safety_test" }),
        ],
      },
    ],
  },
  {
    code: "ME_CRANK",
    name: "Crankshaft & Bearings",
    workshop: "Machinery",
    machinery: [
      {
        code: "CRANK_TRAIN",
        name: "Crank Train",
        components: [
          comp("CRANK_SHAFT", "Crankshaft", WEAR, {
            dynamicTemplateKey: "me_crank_deflection",
            measurementRefs: ["ME_CRANK_DEFLECT_A", "ME_CRANK_DEFLECT_B"],
            estimatedManhoursBase: 24,
          }),
          comp("MAIN_BRG", "Main Bearing", SHAFT, {
            dynamicTemplateKey: "me_main_bearing",
            measurementRefs: ["ME_MAIN_BRG_CLEARANCE"],
            estimatedManhoursBase: 16,
          }),
          comp("CRANKPIN_BRG", "Crankpin Bearing", SHAFT, {
            dynamicTemplateKey: "me_crankpin_bearing",
            measurementRefs: ["ME_CRANKPIN_CLEARANCE"],
            estimatedManhoursBase: 20,
          }),
          comp("CROSSHEAD_BRG", "Crosshead Bearing", SHAFT, {
            dynamicTemplateKey: "me_crosshead_bearing",
            measurementRefs: ["ME_CROSSHEAD_CLEARANCE"],
          }),
          comp("CROSSHEAD", "Crosshead Assembly", OVERHAUL, { dynamicTemplateKey: "me_unit_overhaul" }),
          comp("CONN_ROD", "Connecting Rod", OVERHAUL, { dynamicTemplateKey: "me_unit_overhaul" }),
          comp("ME_FRAME", "Engine Frame & Bedplate", WEAR, { dynamicTemplateKey: "me_unit_overhaul" }),
        ],
      },
    ],
  },
  {
    code: "ME_REMOTE",
    name: "Remote Control & ECR",
    workshop: "Machinery",
    machinery: [
      {
        code: "REMOTE",
        name: "Remote Control",
        components: [
          comp("REMOTE_PANEL", "Remote Control Panel", INSTRUMENT, {
            dynamicTemplateKey: "me_remote_control_test",
          }),
          comp("ECR_LINK", "ECR Control Linkage", INSTRUMENT, {
            dynamicTemplateKey: "me_remote_control_test",
          }),
          comp("BRIDGE_CTRL", "Bridge Control Station", INSTRUMENT, {
            dynamicTemplateKey: "me_remote_control_test",
          }),
          comp("LOCAL_CTRL", "Local Control Station", INSTRUMENT, {
            dynamicTemplateKey: "me_remote_control_test",
          }),
        ],
      },
    ],
  },
  {
    code: "ME_PERF",
    name: "Performance & Trials",
    workshop: "Machinery",
    machinery: [
      {
        code: "TRIALS",
        name: "Trials",
        components: [
          comp("PERF_TEST", "Main Engine Performance Test", INSTRUMENT, {
            dynamicTemplateKey: "me_performance_test",
            estimatedManhoursBase: 16,
            priority: "high",
          }),
          comp("SEA_TRIAL", "Sea Trial Verification", INSTRUMENT, {
            dynamicTemplateKey: "me_sea_trial",
            estimatedManhoursBase: 24,
            priority: "critical",
          }),
        ],
      },
    ],
  },
  {
    code: "PROP_SHAFT",
    name: "Propulsion Shaft Line",
    workshop: "Machinery",
    machinery: [
      {
        code: "SHAFT",
        name: "Shaft Line",
        components: [
          comp("THRUST_BLK", "Thrust Block", SHAFT, {
            dynamicTemplateKey: "me_thrust_block",
            measurementRefs: ["ME_THRUST_CLEARANCE"],
          }),
          comp("INTER_BRG", "Intermediate Bearing", SHAFT, {
            dynamicTemplateKey: "me_inter_shaft_bearing",
            measurementRefs: ["ME_INTER_BEARING_TEMP", "ME_INTER_BRG_CLEARANCE"],
          }),
          comp("SHAFT_ALIGN", "Shaft Alignment", SHAFT, {
            dynamicTemplateKey: "me_inter_shaft_align",
            measurementRefs: ["ME_SHAFT_ALIGNMENT"],
          }),
          comp("STERN_TUBE", "Stern Tube", SHAFT, { dynamicTemplateKey: "me_stern_bearing" }),
          comp("STERN_SEAL", "Stern Tube Seals", SHAFT, { dynamicTemplateKey: "me_stern_seal_renewal" }),
          comp("STERN_BRG", "Stern Bearing", SHAFT, { dynamicTemplateKey: "me_stern_bearing" }),
          comp("COUPLING", "Propeller Coupling", SHAFT, { dynamicTemplateKey: "me_inter_shaft_bearing" }),
          comp("KEYWAY", "Shaft Keyway", SHAFT, { dynamicTemplateKey: "me_inter_shaft_bearing" }),
          comp("TUNNEL", "Shaft Tunnel", WEAR, { dynamicTemplateKey: "me_general_inspect" }),
        ],
      },
    ],
  },
];
