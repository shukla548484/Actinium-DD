export function fmtDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString();
}

export function fmtMoney(value: number | null | undefined): string {
  if (value == null) return "—";
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function fmtPct(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${value}%`;
}

/** Yard execution progress — scope definition is shown separately on the scope page. */
export function displayYardProgress(
  progressPct: number | null | undefined,
  status: string,
  scopeDefined: boolean,
): { label: string; hint: string } {
  if (progressPct != null && progressPct > 0) {
    return { label: fmtPct(progressPct), hint: "Yard execution progress" };
  }
  if (scopeDefined && (status === "planned" || status === "draft")) {
    return {
      label: "Scope set",
      hint: "Scope is defined. Yard execution has not started (0%).",
    };
  }
  if (progressPct === 0 && status !== "planned" && status !== "draft") {
    return { label: "0%", hint: "Yard execution progress" };
  }
  return { label: "—", hint: "Yard execution progress not recorded yet" };
}
