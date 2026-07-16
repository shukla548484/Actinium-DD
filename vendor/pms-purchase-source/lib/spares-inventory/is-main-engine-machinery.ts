/** True when machinery is the vessel main engine (for plate number on spare parts). */
export function isMainEngineMachinery(m: {
  name: string;
  code: string;
  machineryType?: string | null;
  model?: string | null;
}): boolean {
  const h = `${m.machineryType ?? ""} ${m.name} ${m.code} ${m.model ?? ""}`.toUpperCase();
  if ((h.includes("INERT") && h.includes("GAS")) || h.includes("IGG")) return false;

  const mt = (m.machineryType ?? "").toUpperCase();
  if (mt === "MAIN_ENGINE") return true;
  if (mt.includes("MAIN") && mt.includes("ENGINE") && !mt.includes("AUX")) return true;
  if (h.includes("MAIN ENGINE") || h.includes("M/E") || h.includes("MAIN PROPULSION")) {
    return true;
  }
  const model = (m.model ?? "").toUpperCase();
  if (model.includes("ME-C") || model.includes("MC-C")) return true;
  return false;
}
