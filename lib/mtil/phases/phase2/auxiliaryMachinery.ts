import type { MtilSystemDef } from "../../types";
import type { MtilDeptCode, MtilSystemCode } from "../../standards";
import { comp, FUEL, INSTRUMENT, OVERHAUL, SERVICE, WEAR } from "../shared/taxonomyHelpers";

/** Commercial ID routing per system group. */
export type Phase2SystemMeta = MtilSystemDef & {
  commercialDept: MtilDeptCode;
  commercialSystem: MtilSystemCode;
};

function sys(
  def: MtilSystemDef,
  commercialDept: MtilDeptCode,
  commercialSystem: MtilSystemCode,
): Phase2SystemMeta {
  return { ...def, commercialDept, commercialSystem };
}

/** Phase 2 — Auxiliary Machinery taxonomy (AE, boiler, purifier, compressor, FWG, steering). */
export const PHASE2_AUXILIARY_SYSTEMS: Phase2SystemMeta[] = [
  sys(
    {
      code: "AE_DG",
      name: "Diesel Generators",
      workshop: "Machinery",
      machinery: [
        {
          code: "DG_UNIT",
          name: "Generator Engine",
          components: [
            comp("AE_CYL", "Cylinder Unit", OVERHAUL, { dynamicTemplateKey: "ae_unit_overhaul", estimatedManhoursBase: 12 }),
            comp("AE_CYL_HEAD", "Cylinder Head", OVERHAUL, { dynamicTemplateKey: "ae_cyl_head_overhaul" }),
            comp("AE_PISTON", "Piston Assembly", OVERHAUL, { dynamicTemplateKey: "ae_piston_overhaul" }),
            comp("AE_FUEL_INJ", "Fuel Injector", FUEL, { dynamicTemplateKey: "ae_fuel_injector_overhaul" }),
            comp("AE_TURBO", "Turbocharger", OVERHAUL, { dynamicTemplateKey: "ae_turbo_overhaul" }),
            comp("AE_GOVERNOR", "Governor", INSTRUMENT, { dynamicTemplateKey: "ae_governor_cal" }),
            comp("AE_ALT", "Alternator", WEAR, { dynamicTemplateKey: "ae_alternator_inspect" }),
            comp("AE_START", "Starting System", SERVICE, { dynamicTemplateKey: "ae_starting_system" }),
          ],
        },
        {
          code: "DG_AUX",
          name: "Generator Auxiliaries",
          components: [
            comp("AE_LO_PUMP", "LO Pump", OVERHAUL, { dynamicTemplateKey: "ae_lube_system" }),
            comp("AE_LO_FILTER", "LO Filter", SERVICE, { dynamicTemplateKey: "ae_lube_system" }),
            comp("AE_JCW_PUMP", "JCW Pump", OVERHAUL, { dynamicTemplateKey: "ae_cooling_system" }),
            comp("AE_JCW_COOLER", "JCW Cooler", SERVICE, { dynamicTemplateKey: "ae_cooling_system" }),
            comp("AE_FUEL_PUMP", "Fuel Pump", FUEL, { dynamicTemplateKey: "ae_fuel_system" }),
            comp("AE_FUEL_FILTER", "Fuel Filter", SERVICE, { dynamicTemplateKey: "ae_fuel_system" }),
          ],
        },
      ],
    },
    "AUX",
    "AE",
  ),
  sys(
    {
      code: "AE_EG",
      name: "Emergency Generator",
      workshop: "Machinery",
      machinery: [
        {
          code: "EG",
          name: "Emergency Generator Set",
          components: [
            comp("EG_ENGINE", "Emergency Engine", OVERHAUL, { dynamicTemplateKey: "ae_emergency_gen_survey", priority: "critical" }),
            comp("EG_ALT", "Emergency Alternator", WEAR, { dynamicTemplateKey: "ae_alternator_inspect" }),
            comp("EG_START", "Emergency Start Battery", INSTRUMENT, { dynamicTemplateKey: "ae_starting_system" }),
            comp("EG_FUEL", "Emergency Fuel Tank", WEAR, { dynamicTemplateKey: "ae_fuel_system" }),
            comp("EG_TEST", "Emergency Auto Start", INSTRUMENT, { dynamicTemplateKey: "ae_safety_trip_test", priority: "critical" }),
            comp("EG_LOAD", "Emergency Load Test", INSTRUMENT, { dynamicTemplateKey: "ae_load_test", priority: "high" }),
          ],
        },
      ],
    },
    "AUX",
    "AE",
  ),
  sys(
    {
      code: "BLR_AUX",
      name: "Auxiliary Boiler",
      workshop: "Machinery",
      machinery: [
        {
          code: "BLR",
          name: "Auxiliary Boiler",
          components: [
            comp("BLR_BURNER", "Burner Assembly", OVERHAUL, { dynamicTemplateKey: "blr_burner_overhaul" }),
            comp("BLR_TUBES", "Boiler Tubes", WEAR, { dynamicTemplateKey: "blr_tube_survey" }),
            comp("BLR_SV", "Safety Valves", INSTRUMENT, { dynamicTemplateKey: "blr_safety_valve_test" }),
            comp("BLR_FEED", "Feed Water System", SERVICE, { dynamicTemplateKey: "blr_feed_system" }),
            comp("BLR_BLOW", "Blow Down System", SERVICE, { dynamicTemplateKey: "blr_general_service" }),
            comp("BLR_CTRL", "Combustion Control", INSTRUMENT, { dynamicTemplateKey: "blr_control_test" }),
            comp("BLR_HYDRO", "Boiler Hydro Test", INSTRUMENT, { dynamicTemplateKey: "blr_hydro_test" }),
          ],
        },
        {
          code: "BLR_ACC",
          name: "Boiler Accessories",
          components: [
            comp("BLR_LEVEL", "Level Controls", INSTRUMENT, { dynamicTemplateKey: "blr_control_test" }),
            comp("BLR_BLOW_V", "Blow Down Valves", SERVICE, { dynamicTemplateKey: "blr_general_service" }),
            comp("BLR_MANHOLE", "Manholes & Gaskets", WEAR, { dynamicTemplateKey: "blr_general_service" }),
            comp("BLR_REFRACT", "Refractory / Insulation", WEAR, { dynamicTemplateKey: "blr_general_service" }),
          ],
        },
      ],
    },
    "AUX",
    "BLR",
  ),
  sys(
    {
      code: "BLR_EXH",
      name: "Exhaust Gas Boiler / Economizer",
      workshop: "Machinery",
      machinery: [
        {
          code: "EGB",
          name: "Exhaust Gas Boiler",
          components: [
            comp("EGB_TUBES", "EGB Tubes", WEAR, { dynamicTemplateKey: "blr_tube_survey" }),
            comp("EGB_SOOT", "Soot Blower", SERVICE, { dynamicTemplateKey: "blr_general_service" }),
            comp("EGB_FEED", "Feed Pump", SERVICE, { dynamicTemplateKey: "blr_feed_system" }),
            comp("EGB_SV", "Safety Valves", INSTRUMENT, { dynamicTemplateKey: "blr_safety_valve_test" }),
            comp("EGB_CTRL", "Steam Control", INSTRUMENT, { dynamicTemplateKey: "blr_control_test" }),
          ],
        },
      ],
    },
    "AUX",
    "BLR",
  ),
  sys(
    {
      code: "PUR_LO",
      name: "LO Purifier",
      workshop: "Machinery",
      machinery: [
        {
          code: "LO_PUR",
          name: "LO Purifier",
          components: [
            comp("PUR_BOWL", "Separator Bowl", OVERHAUL, { dynamicTemplateKey: "pur_separator_overhaul" }),
            comp("PUR_DISK", "Disc Stack", SERVICE, { dynamicTemplateKey: "pur_separator_overhaul" }),
            comp("PUR_FEED", "Feed Pump", SERVICE, { dynamicTemplateKey: "pur_feed_system" }),
            comp("PUR_HEATER", "Purifier Heater", SERVICE, { dynamicTemplateKey: "pur_feed_system" }),
            comp("PUR_CTRL", "Control Panel", INSTRUMENT, { dynamicTemplateKey: "pur_control_test" }),
            comp("PUR_WATER", "Water Seal Monitor", INSTRUMENT, { dynamicTemplateKey: "pur_control_test" }),
          ],
        },
      ],
    },
    "AUX",
    "AE",
  ),
  sys(
    {
      code: "PUR_FO",
      name: "FO Purifier",
      workshop: "Machinery",
      machinery: [
        {
          code: "FO_PUR",
          name: "FO Purifier",
          components: [
            comp("FO_BOWL", "Separator Bowl", OVERHAUL, { dynamicTemplateKey: "pur_separator_overhaul" }),
            comp("FO_DISK", "Disc Stack", SERVICE, { dynamicTemplateKey: "pur_separator_overhaul" }),
            comp("FO_FEED", "Feed Pump", SERVICE, { dynamicTemplateKey: "pur_feed_system" }),
            comp("FO_HEATER", "Purifier Heater", SERVICE, { dynamicTemplateKey: "pur_feed_system" }),
            comp("FO_CTRL", "Control Panel", INSTRUMENT, { dynamicTemplateKey: "pur_control_test" }),
            comp("FO_SLUDGE", "Sludge Discharge", SERVICE, { dynamicTemplateKey: "pur_feed_system" }),
          ],
        },
      ],
    },
    "AUX",
    "AE",
  ),
  sys(
    {
      code: "COMPR_AIR",
      name: "Air Compressors",
      workshop: "Machinery",
      machinery: [
        {
          code: "AIR",
          name: "Service Air",
          components: [
            comp("AIR_COMP", "Air Compressor", OVERHAUL, { dynamicTemplateKey: "compr_air_overhaul" }),
            comp("AIR_DRY", "Air Dryer", SERVICE, { dynamicTemplateKey: "compr_air_overhaul" }),
            comp("AIR_FILTER", "Air Filter", SERVICE, { dynamicTemplateKey: "compr_air_overhaul" }),
            comp("AIR_SV", "Safety Valves", INSTRUMENT, { dynamicTemplateKey: "compr_safety_test" }),
            comp("AIR_CTRL", "Control System", INSTRUMENT, { dynamicTemplateKey: "compr_control_test" }),
            comp("AIR_BOTTLE", "Air Receiver", WEAR, { dynamicTemplateKey: "compr_air_overhaul" }),
            comp("AIR_DRAIN", "Auto Drain", SERVICE, { dynamicTemplateKey: "compr_air_overhaul" }),
          ],
        },
      ],
    },
    "AUX",
    "AE",
  ),
  sys(
    {
      code: "COMPR_REF",
      name: "Refrigeration",
      workshop: "Machinery",
      machinery: [
        {
          code: "REF",
          name: "Refrigeration Plant",
          components: [
            comp("REF_COMP", "Refrigeration Compressor", OVERHAUL, { dynamicTemplateKey: "compr_ref_service" }),
            comp("REF_COND", "Condenser", SERVICE, { dynamicTemplateKey: "compr_ref_service" }),
            comp("REF_EVAP", "Evaporator", SERVICE, { dynamicTemplateKey: "compr_ref_service" }),
            comp("REF_CTRL", "Temperature Control", INSTRUMENT, { dynamicTemplateKey: "compr_control_test" }),
            comp("REF_LEAK", "Leak Test", INSTRUMENT, { dynamicTemplateKey: "compr_ref_service" }),
            comp("REF_OIL", "Compressor Oil", SERVICE, { dynamicTemplateKey: "compr_ref_service" }),
          ],
        },
      ],
    },
    "AUX",
    "AE",
  ),
  sys(
    {
      code: "HE_EX",
      name: "Heat Exchangers",
      workshop: "Machinery",
      machinery: [
        {
          code: "HE",
          name: "Heat Exchangers",
          components: [
            comp("HE_PLATE", "Plate Heat Exchanger", SERVICE, { dynamicTemplateKey: "he_exchanger_service" }),
            comp("HE_SHELL", "Shell & Tube Exchanger", SERVICE, { dynamicTemplateKey: "he_exchanger_service" }),
            comp("HE_GASKET", "Gaskets & Seals", WEAR, { dynamicTemplateKey: "he_exchanger_service" }),
            comp("HE_ZINC", "Zinc Anodes", WEAR, { dynamicTemplateKey: "he_exchanger_service" }),
            comp("HE_PRESS", "Pressure Test", INSTRUMENT, { dynamicTemplateKey: "he_exchanger_service" }),
            comp("HE_CLEAN", "Chemical Cleaning", SERVICE, { dynamicTemplateKey: "he_exchanger_service" }),
          ],
        },
      ],
    },
    "AUX",
    "AE",
  ),
  sys(
    {
      code: "FWG",
      name: "Fresh Water Generator",
      workshop: "Machinery",
      machinery: [
        {
          code: "FWG_PLANT",
          name: "FWG Plant",
          components: [
            comp("FWG_EJECT", "Ejector Pump", SERVICE, { dynamicTemplateKey: "fwg_service" }),
            comp("FWG_COND", "Condenser Plates", SERVICE, { dynamicTemplateKey: "fwg_service" }),
            comp("FWG_SAL", "Salinometer", INSTRUMENT, { dynamicTemplateKey: "fwg_service" }),
            comp("FWG_ANTISCAL", "Anti-scalant System", SERVICE, { dynamicTemplateKey: "fwg_service" }),
            comp("FWG_HEAT", "Heater / Evaporator", SERVICE, { dynamicTemplateKey: "fwg_service" }),
            comp("FWG_FEED", "Feed Pump", SERVICE, { dynamicTemplateKey: "fwg_service" }),
            comp("FWG_PROD", "Production Test", INSTRUMENT, { dynamicTemplateKey: "fwg_production_test" }),
          ],
        },
      ],
    },
    "AUX",
    "AE",
  ),
  sys(
    {
      code: "STEER",
      name: "Steering Gear",
      workshop: "Machinery",
      machinery: [
        {
          code: "STEER_UNIT",
          name: "Steering Gear",
          components: [
            comp("STEER_RAM", "Steering Ram", WEAR, { dynamicTemplateKey: "steer_gear_survey" }),
            comp("STEER_PUMP", "Hydraulic Pump", OVERHAUL, { dynamicTemplateKey: "steer_hydraulic_service" }),
            comp("STEER_MOTOR", "Steering Motor", OVERHAUL, { dynamicTemplateKey: "steer_hydraulic_service" }),
            comp("STEER_TANK", "Hydraulic Oil Tank", WEAR, { dynamicTemplateKey: "steer_hydraulic_service" }),
            comp("STEER_ALARM", "Steering Failure Alarm", INSTRUMENT, { dynamicTemplateKey: "steer_alarm_test" }),
            comp("STEER_TEST", "Steering Test", INSTRUMENT, { dynamicTemplateKey: "steer_gear_survey" }),
          ],
        },
      ],
    },
    "AUX",
    "AE",
  ),
];
