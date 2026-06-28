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
