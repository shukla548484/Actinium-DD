/**
 * Global chart palette for Recharts and other SVG charts.
 * Product palette + dashboard accents (blue, green, orange, teal, purple).
 */
export const CHART_THEME = {
  redOrange: "#F54927",
  blue: "#274DF5",
  orange: "#F55E27",
  black: "#0F0500",
  crimson: "#DB1841",
  yellow: "#F7FA02",
  /** Rated capacity / positive reference lines */
  green: "#22C55E",
  /** Consumption / secondary accent */
  teal: "#14B8A6",
  /** Summary / tertiary accent */
  purple: "#9333EA",
  /** Ladder gradient endpoints */
  navy: "#1E3A8A",
  bluePale: "#D4DCFD",
  /** Variance band / area fill behind bars */
  varianceBand: "#B8C9F2",
  /** Lighter blue for area fills */
  blueMuted: "#9DB0FA",
  /** Muted brown-grey derived from black */
  grey: "#5C4540",
  /** Backward-compatible aliases */
  rose: "#DB1841",
  navyBlue: "#274DF5",
  skyBlue: "#274DF5",
  lime: "#F54927",
} as const;

/** Blue gradient steps for sequential bar charts (e.g. FWG ladder). */
export const CHART_BLUE_GRADIENT: readonly string[] = [
  CHART_THEME.navy,
  CHART_THEME.blue,
  "#4F6BF7",
  "#7B93FA",
  "#A8BDFC",
  CHART_THEME.bluePale,
];

/** Product palette order — use to assign series by index. */
export const CHART_PALETTE: readonly string[] = [
  CHART_THEME.blue,
  CHART_THEME.orange,
  CHART_THEME.green,
  CHART_THEME.teal,
  CHART_THEME.purple,
  CHART_THEME.redOrange,
  CHART_THEME.crimson,
  CHART_THEME.yellow,
];

export function chartColorAtIndex(index: number): string {
  return CHART_PALETTE[index % CHART_PALETTE.length]!;
}

/** Color from a blue gradient by index (0 = darkest). */
export function chartBlueGradientAtIndex(index: number, total: number): string {
  if (total <= 1) return CHART_THEME.blue;
  const colors = CHART_BLUE_GRADIENT;
  const pos = (index / (total - 1)) * (colors.length - 1);
  return colors[Math.min(Math.round(pos), colors.length - 1)]!;
}

/** First N distinct colors for small multi-series charts (e.g. 2–3 bars). */
export function chartColors(count: number): string[] {
  return Array.from({ length: count }, (_, i) => chartColorAtIndex(i));
}

/** Semantic roles for noon / engine fuel charts (consistent legend). */
export const CHART_SEMANTIC = {
  meActual: CHART_THEME.crimson,
  meExpectedCurve: CHART_THEME.blue,
  meExpectedBaseline: CHART_THEME.green,
  aeActual: CHART_THEME.orange,
  aeExpectedMax: CHART_THEME.grey,
  freshWater: CHART_THEME.blue,
  totalFuelLine: CHART_THEME.yellow,
} as const;
