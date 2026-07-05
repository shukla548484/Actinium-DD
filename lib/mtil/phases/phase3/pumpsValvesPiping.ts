import type { MtilSystemDef } from "../../types";
import type { MtilDeptCode, MtilSystemCode } from "../../standards";
import { comp, INSTRUMENT, OVERHAUL, SERVICE, WEAR } from "../shared/taxonomyHelpers";

export type Phase3SystemMeta = MtilSystemDef & {
  commercialDept: MtilDeptCode;
  commercialSystem: MtilSystemCode;
};

function sys(
  def: MtilSystemDef,
  commercialDept: MtilDeptCode = "PVP",
  commercialSystem: MtilSystemCode = "PMP",
): Phase3SystemMeta {
  return { ...def, commercialDept, commercialSystem };
}

/** Phase 3 — Pumps, Valves & Piping taxonomy. */
export const PHASE3_PVP_SYSTEMS: Phase3SystemMeta[] = [
  sys({
    code: "PMP_CW",
    name: "Cooling Water Pumps",
    workshop: "Machinery",
    machinery: [
      {
        code: "CW_PUMP",
        name: "Cooling Water Pump",
        components: [
          comp("CW_IMPELLER", "Impeller", OVERHAUL, { dynamicTemplateKey: "pmp_impeller_inspect" }),
          comp("CW_SEAL", "Mechanical Seal", OVERHAUL, { dynamicTemplateKey: "pmp_seal_renewal" }),
          comp("CW_BEARING", "Pump Bearings", WEAR, { dynamicTemplateKey: "pmp_bearing_inspect" }),
          comp("CW_CASING", "Pump Casing", WEAR, { dynamicTemplateKey: "pmp_cent_overhaul" }),
          comp("CW_ALIGN", "Pump-Motor Alignment", INSTRUMENT, { dynamicTemplateKey: "pmp_alignment" }),
          comp("CW_PERF", "Performance Test", INSTRUMENT, { dynamicTemplateKey: "pmp_npsh_test" }),
        ],
      },
    ],
  }),
  sys({
    code: "PMP_SW",
    name: "Sea Water Pumps",
    workshop: "Machinery",
    machinery: [
      {
        code: "SW_PUMP",
        name: "Sea Water Pump",
        components: [
          comp("SW_IMPELLER", "Impeller", OVERHAUL, { dynamicTemplateKey: "pmp_impeller_inspect" }),
          comp("SW_SEAL", "Mechanical Seal", OVERHAUL, { dynamicTemplateKey: "pmp_seal_renewal" }),
          comp("SW_BEARING", "Pump Bearings", WEAR, { dynamicTemplateKey: "pmp_bearing_inspect" }),
          comp("SW_CASING", "Pump Casing", WEAR, { dynamicTemplateKey: "pmp_cent_overhaul" }),
          comp("SW_STRAINER", "Suction Strainer", SERVICE, { dynamicTemplateKey: "pmp_general_inspect" }),
          comp("SW_PERF", "Performance Test", INSTRUMENT, { dynamicTemplateKey: "pmp_npsh_test" }),
        ],
      },
    ],
  }),
  sys({
    code: "PMP_BALL",
    name: "Ballast Pumps",
    workshop: "Machinery",
    machinery: [
      {
        code: "BALL_PUMP",
        name: "Ballast Pump",
        components: [
          comp("BALL_IMPELLER", "Impeller", OVERHAUL, { dynamicTemplateKey: "pmp_ballast_overhaul" }),
          comp("BALL_SEAL", "Mechanical Seal", OVERHAUL, { dynamicTemplateKey: "pmp_seal_renewal" }),
          comp("BALL_BEARING", "Pump Bearings", WEAR, { dynamicTemplateKey: "pmp_bearing_inspect" }),
          comp("BALL_STRIP", "Stripping System", SERVICE, { dynamicTemplateKey: "pmp_stripping" }),
          comp("BALL_PERF", "Ballast Performance Test", INSTRUMENT, { dynamicTemplateKey: "pmp_npsh_test" }),
        ],
      },
    ],
  }),
  sys({
    code: "PMP_BILGE",
    name: "Bilge Pumps",
    workshop: "Machinery",
    machinery: [
      {
        code: "BILGE_PUMP",
        name: "Bilge Pump",
        components: [
          comp("BILGE_IMPELLER", "Impeller", OVERHAUL, { dynamicTemplateKey: "pmp_bilge_overhaul" }),
          comp("BILGE_SEAL", "Mechanical Seal", OVERHAUL, { dynamicTemplateKey: "pmp_seal_renewal" }),
          comp("BILGE_BEARING", "Pump Bearings", WEAR, { dynamicTemplateKey: "pmp_bearing_inspect" }),
          comp("BILGE_SUCTION", "Suction Line", WEAR, { dynamicTemplateKey: "pipe_sw_survey" }),
          comp("BILGE_ALARM", "High Level Alarm", INSTRUMENT, { dynamicTemplateKey: "pmp_general_inspect" }),
        ],
      },
    ],
  }),
  sys({
    code: "PMP_FIRE",
    name: "Fire & Emergency Pumps",
    workshop: "Machinery",
    machinery: [
      {
        code: "FIRE_PUMP",
        name: "Fire Pump",
        components: [
          comp("FIRE_IMPELLER", "Fire Pump Impeller", OVERHAUL, { dynamicTemplateKey: "pmp_fire_pump_survey" }),
          comp("FIRE_SEAL", "Mechanical Seal", OVERHAUL, { dynamicTemplateKey: "pmp_seal_renewal" }),
          comp("FIRE_MOTOR", "Fire Pump Motor", WEAR, { dynamicTemplateKey: "pmp_motor_coupling" }),
          comp("FIRE_TEST", "Emergency Fire Pump Test", INSTRUMENT, { dynamicTemplateKey: "pmp_emergency_fire_test", priority: "critical" }),
          comp("FIRE_SV", "Fire Pump Relief Valve", INSTRUMENT, { dynamicTemplateKey: "valve_relief_test" }),
          comp("FIRE_PERF", "Fire Pump Performance", INSTRUMENT, { dynamicTemplateKey: "pmp_npsh_test", priority: "high" }),
        ],
      },
    ],
  }),
  sys({
    code: "PMP_FO",
    name: "Fuel Oil Transfer Pumps",
    workshop: "Machinery",
    machinery: [
      {
        code: "FO_PUMP",
        name: "Fuel Oil Transfer Pump",
        components: [
          comp("FO_IMPELLER", "Impeller", OVERHAUL, { dynamicTemplateKey: "pmp_cent_overhaul" }),
          comp("FO_SEAL", "Mechanical Seal", OVERHAUL, { dynamicTemplateKey: "pmp_seal_renewal" }),
          comp("FO_BEARING", "Pump Bearings", WEAR, { dynamicTemplateKey: "pmp_bearing_inspect" }),
          comp("FO_STRAINER", "Suction Strainer", SERVICE, { dynamicTemplateKey: "pmp_general_inspect" }),
          comp("FO_PERF", "Transfer Rate Test", INSTRUMENT, { dynamicTemplateKey: "pmp_npsh_test" }),
        ],
      },
      {
        code: "FO_GEAR",
        name: "Fuel Oil Gear Pump",
        components: [
          comp("FO_GEAR_ROTOR", "Gear Rotors", OVERHAUL, { dynamicTemplateKey: "pmp_gear_overhaul" }),
          comp("FO_GEAR_SEAL", "Shaft Seal", OVERHAUL, { dynamicTemplateKey: "pmp_seal_renewal" }),
          comp("FO_GEAR_BEAR", "Bearings", WEAR, { dynamicTemplateKey: "pmp_bearing_inspect" }),
        ],
      },
    ],
  }),
  sys({
    code: "PMP_LO",
    name: "Lubricating Oil Pumps",
    workshop: "Machinery",
    machinery: [
      {
        code: "LO_PUMP",
        name: "LO Transfer Pump",
        components: [
          comp("LO_IMPELLER", "Impeller", OVERHAUL, { dynamicTemplateKey: "pmp_cent_overhaul" }),
          comp("LO_SEAL", "Mechanical Seal", OVERHAUL, { dynamicTemplateKey: "pmp_seal_renewal" }),
          comp("LO_BEARING", "Pump Bearings", WEAR, { dynamicTemplateKey: "pmp_bearing_inspect" }),
          comp("LO_FILTER", "Suction Filter", SERVICE, { dynamicTemplateKey: "pmp_general_inspect" }),
        ],
      },
      {
        code: "LO_SCREW",
        name: "LO Screw Pump",
        components: [
          comp("LO_SCREW_ROTOR", "Screw Rotors", OVERHAUL, { dynamicTemplateKey: "pmp_screw_overhaul" }),
          comp("LO_SCREW_SEAL", "Shaft Seal", OVERHAUL, { dynamicTemplateKey: "pmp_seal_renewal" }),
          comp("LO_SCREW_BEAR", "Bearings", WEAR, { dynamicTemplateKey: "pmp_bearing_inspect" }),
        ],
      },
    ],
  }),
  sys({
    code: "PMP_CARGO",
    name: "Cargo Pumps",
    workshop: "Machinery",
    machinery: [
      {
        code: "CARGO_PUMP",
        name: "Cargo Pump",
        components: [
          comp("CARGO_IMPELLER", "Impeller", OVERHAUL, { dynamicTemplateKey: "pmp_cent_overhaul" }),
          comp("CARGO_SEAL", "Mechanical Seal", OVERHAUL, { dynamicTemplateKey: "pmp_seal_renewal" }),
          comp("CARGO_BEARING", "Pump Bearings", WEAR, { dynamicTemplateKey: "pmp_bearing_inspect" }),
          comp("CARGO_STRIP", "Stripping Pump", SERVICE, { dynamicTemplateKey: "pmp_stripping" }),
          comp("CARGO_PERF", "Cargo Pump Performance", INSTRUMENT, { dynamicTemplateKey: "pmp_npsh_test" }),
          comp("CARGO_CAV", "Cavitation Check", INSTRUMENT, { dynamicTemplateKey: "pmp_cavitation_test" }),
        ],
      },
    ],
  }),
  sys({
    code: "VAL_MAIN",
    name: "Main Isolation Valves",
    workshop: "Machinery",
    machinery: [
      {
        code: "ISO_VALVE",
        name: "Isolation Valves",
        components: [
          comp("VAL_GLOB", "Globe Valve", OVERHAUL, { dynamicTemplateKey: "valve_globe_overhaul" }),
          comp("VAL_GATE", "Gate Valve", OVERHAUL, { dynamicTemplateKey: "valve_gate_overhaul" }),
          comp("VAL_BFLY", "Butterfly Valve", SERVICE, { dynamicTemplateKey: "valve_butterfly_service" }),
          comp("VAL_CHECK", "Check Valve", WEAR, { dynamicTemplateKey: "valve_check_inspect" }),
          comp("VAL_FLANGE", "Flanged Connections", WEAR, { dynamicTemplateKey: "pipe_flange_inspect" }),
          comp("VAL_GREASE", "Valve Greasing", SERVICE, { dynamicTemplateKey: "valve_grease_service" }),
        ],
      },
    ],
  }),
  sys({
    code: "VAL_SAFETY",
    name: "Safety & Relief Valves",
    workshop: "Machinery",
    machinery: [
      {
        code: "SAF_VALVE",
        name: "Safety Valves",
        components: [
          comp("VAL_RELIEF", "Relief Valve", INSTRUMENT, { dynamicTemplateKey: "valve_relief_test" }),
          comp("VAL_SAFETY", "Safety Valve", INSTRUMENT, { dynamicTemplateKey: "valve_safety_test", priority: "critical" }),
          comp("VAL_PSV", "Pressure Safety Valve", INSTRUMENT, { dynamicTemplateKey: "valve_safety_test", priority: "critical" }),
          comp("VAL_VAC", "Vacuum Breaker", INSTRUMENT, { dynamicTemplateKey: "valve_relief_test" }),
          comp("VAL_BURST", "Bursting Disc", WEAR, { dynamicTemplateKey: "valve_general_inspect" }),
        ],
      },
    ],
  }),
  sys({
    code: "VAL_CONTROL",
    name: "Control Valves",
    workshop: "Machinery",
    machinery: [
      {
        code: "CTRL_VALVE",
        name: "Control Valves",
        components: [
          comp("VAL_CTRL", "Control Valve Body", OVERHAUL, { dynamicTemplateKey: "valve_control_overhaul" }),
          comp("VAL_ACT", "Actuator", OVERHAUL, { dynamicTemplateKey: "valve_control_overhaul" }),
          comp("VAL_POS", "Positioner", INSTRUMENT, { dynamicTemplateKey: "valve_control_overhaul" }),
          comp("VAL_STROKE", "Stroke Test", INSTRUMENT, { dynamicTemplateKey: "valve_control_overhaul" }),
          comp("VAL_I_P", "I/P Converter", INSTRUMENT, { dynamicTemplateKey: "valve_control_overhaul" }),
        ],
      },
    ],
  }),
  sys({
    code: "PIPE_STEAM",
    name: "Steam Piping",
    workshop: "Machinery",
    machinery: [
      {
        code: "STM_PIPE",
        name: "Steam Piping System",
        components: [
          comp("STM_MAIN", "Main Steam Line", WEAR, { dynamicTemplateKey: "pipe_steam_survey" }),
          comp("STM_TRAP", "Steam Traps", SERVICE, { dynamicTemplateKey: "pipe_steam_survey" }),
          comp("STM_INSUL", "Insulation", WEAR, { dynamicTemplateKey: "pipe_general_inspect" }),
          comp("STM_FLANGE", "Flanged Joints", WEAR, { dynamicTemplateKey: "pipe_flange_inspect" }),
          comp("STM_SV", "Steam Safety Valve", INSTRUMENT, { dynamicTemplateKey: "valve_safety_test" }),
          comp("STM_HYDRO", "Steam Line Hydro Test", INSTRUMENT, { dynamicTemplateKey: "pipe_hydro_test", priority: "high" }),
        ],
      },
    ],
  }),
  sys({
    code: "PIPE_FUEL",
    name: "Fuel Oil Piping",
    workshop: "Machinery",
    machinery: [
      {
        code: "FO_PIPE",
        name: "Fuel Oil Piping",
        components: [
          comp("FO_MAIN", "Main Fuel Line", WEAR, { dynamicTemplateKey: "pipe_fuel_survey" }),
          comp("FO_RETURN", "Return Line", WEAR, { dynamicTemplateKey: "pipe_fuel_survey" }),
          comp("FO_HEATER", "Fuel Heater Lines", WEAR, { dynamicTemplateKey: "pipe_fuel_survey" }),
          comp("FO_FLANGE", "Flanged Joints", WEAR, { dynamicTemplateKey: "pipe_flange_inspect" }),
          comp("FO_HYDRO", "Fuel Line Pressure Test", INSTRUMENT, { dynamicTemplateKey: "pipe_hydro_test" }),
        ],
      },
    ],
  }),
  sys({
    code: "PIPE_LO",
    name: "Lubricating Oil Piping",
    workshop: "Machinery",
    machinery: [
      {
        code: "LO_PIPE",
        name: "LO Piping System",
        components: [
          comp("LO_MAIN", "Main LO Line", WEAR, { dynamicTemplateKey: "pipe_lo_survey" }),
          comp("LO_COOLER", "LO Cooler Lines", WEAR, { dynamicTemplateKey: "pipe_lo_survey" }),
          comp("LO_FILTER", "Filter Bypass Line", SERVICE, { dynamicTemplateKey: "pipe_lo_survey" }),
          comp("LO_FLANGE", "Flanged Joints", WEAR, { dynamicTemplateKey: "pipe_flange_inspect" }),
          comp("LO_HYDRO", "LO Line Pressure Test", INSTRUMENT, { dynamicTemplateKey: "pipe_hydro_test" }),
        ],
      },
    ],
  }),
  sys({
    code: "PIPE_SW",
    name: "Sea Water Piping",
    workshop: "Machinery",
    machinery: [
      {
        code: "SW_PIPE",
        name: "Sea Water Piping",
        components: [
          comp("SW_MAIN", "Main SW Line", WEAR, { dynamicTemplateKey: "pipe_sw_survey" }),
          comp("SW_COOLER", "Cooler SW Lines", WEAR, { dynamicTemplateKey: "pipe_sw_survey" }),
          comp("SW_BOX", "Sea Chest", WEAR, { dynamicTemplateKey: "pipe_sw_survey" }),
          comp("SW_ANODE", "Sacrificial Anodes", WEAR, { dynamicTemplateKey: "pipe_sw_survey" }),
          comp("SW_HYDRO", "SW Line Pressure Test", INSTRUMENT, { dynamicTemplateKey: "pipe_hydro_test" }),
        ],
      },
    ],
  }),
];
