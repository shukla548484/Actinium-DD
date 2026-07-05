import type { MtilSparesLine } from "./types";

/** Phase 1 — standardized spares/consumables by component family. */
export const MTIL_PHASE1_SPARES: Record<string, MtilSparesLine[]> = {
  me_unit_overhaul: [
    { code: "SP-GSKT-ME", description: "Main engine gasket set", unit: "set", typicalQty: 1 },
    { code: "SP-SEAL-ME", description: "Main engine seal kit", unit: "set", typicalQty: 1 },
    { code: "SP-FILT-LO", description: "LO filter elements", unit: "pcs", typicalQty: 4 },
  ],
  me_cyl_head_overhaul: [
    { code: "SP-GSKT-HEAD", description: "Cylinder head gasket", unit: "set", typicalQty: 1 },
    { code: "SP-SEAL-HEAD", description: "Head seal kit", unit: "set", typicalQty: 1 },
    { code: "SP-EXH-VALVE", description: "Exhaust valve spare parts", unit: "set", typicalQty: 1 },
  ],
  me_piston_overhaul: [
    { code: "SP-RING", description: "Piston ring set", unit: "set", typicalQty: 1 },
    { code: "SP-CROWN-GSKT", description: "Piston crown gasket", unit: "set", typicalQty: 1 },
  ],
  me_fuel_injector_overhaul: [
    { code: "SP-NOZZLE", description: "Injector nozzle kit", unit: "set", typicalQty: 1 },
    { code: "SP-HEAT-SHIELD", description: "Heat shield", unit: "pcs", typicalQty: 1 },
  ],
  me_fuel_pump_overhaul: [
    { code: "SP-PLUNGER", description: "Fuel pump plunger/barrel kit", unit: "set", typicalQty: 1 },
    { code: "SP-DEL-VALVE", description: "Delivery valve", unit: "set", typicalQty: 1 },
  ],
  me_turbo_overhaul: [
    { code: "SP-TC-BRG", description: "Turbo bearing kit", unit: "set", typicalQty: 1 },
    { code: "SP-TC-SEAL", description: "Turbo seal kit", unit: "set", typicalQty: 1 },
  ],
  me_stern_seal_renewal: [
    { code: "SP-ST-SEAL", description: "Stern tube seal ring set", unit: "set", typicalQty: 1 },
    { code: "SP-ST-OIL", description: "Stern tube LO", unit: "L", typicalQty: 20 },
  ],
  me_start_air_valve: [
    { code: "SP-START-SEAT", description: "Starting valve seat kit", unit: "set", typicalQty: 1 },
    { code: "SP-START-SPRING", description: "Starting valve spring", unit: "pcs", typicalQty: 2 },
  ],
};

export function resolveSparesForJob(input: {
  dynamicTemplateKey: string;
  componentName: string;
  action: string;
}): MtilSparesLine[] {
  if (input.action !== "overhaul" && input.action !== "renew" && input.action !== "replace") {
    return [];
  }
  const templateSpares = MTIL_PHASE1_SPARES[input.dynamicTemplateKey];
  if (templateSpares) return templateSpares;
  return [
    { code: "SP-GSKT", description: `${input.componentName} gasket set`, unit: "set", typicalQty: 1 },
    { code: "SP-SEAL", description: `${input.componentName} seal kit`, unit: "set", typicalQty: 1 },
  ];
}
