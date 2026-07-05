/** Machinery parameter catalog for recording trending data. */
export const MACHINERY_PARAMETER_CATALOG = [
  { key: "cylinder_exhaust_temp", label: "Cylinder exhaust temperature", unit: "°C" },
  { key: "scavenge_temp", label: "Scavenge air temperature", unit: "°C" },
  { key: "lube_oil_pressure", label: "Lube oil pressure", unit: "bar" },
  { key: "fuel_oil_pressure", label: "Fuel oil pressure", unit: "bar" },
  { key: "turbo_rpm", label: "Turbocharger RPM", unit: "rpm" },
  { key: "bearing_temp", label: "Bearing temperature", unit: "°C" },
  { key: "cw_temp", label: "Cooling water temperature", unit: "°C" },
  { key: "vibration", label: "Vibration", unit: "mm/s" },
  { key: "oil_analysis", label: "Oil analysis result", unit: "" },
  { key: "power_output", label: "Power output", unit: "kW" },
] as const;

export type MachineryParameterKey = (typeof MACHINERY_PARAMETER_CATALOG)[number]["key"];

export const CONDITION_RATING_ITEMS = [
  { value: "excellent", label: "Excellent", color: "bg-emerald-500" },
  { value: "good", label: "Good", color: "bg-green-400" },
  { value: "monitor", label: "Monitor", color: "bg-amber-400" },
  { value: "poor", label: "Poor", color: "bg-orange-500" },
  { value: "critical", label: "Critical", color: "bg-destructive" },
] as const;

export function conditionRatingLabel(value: string): string {
  return CONDITION_RATING_ITEMS.find((i) => i.value === value)?.label ?? value;
}

export function parameterLabel(key: string): string {
  return MACHINERY_PARAMETER_CATALOG.find((p) => p.key === key)?.label ?? key;
}

export function parameterUnit(key: string): string | undefined {
  const item = MACHINERY_PARAMETER_CATALOG.find((p) => p.key === key);
  return item?.unit || undefined;
}
