import type { CSSProperties } from "react";

/**
 * Inline width for the serial (#) column — fixed px so layout does not depend on
 * Tailwind class resolution or parent flex/grid reflow.
 */
export const TABLE_SERIAL_COLUMN_STYLE: CSSProperties = {
  width: 44,
  minWidth: 44,
  maxWidth: 56,
  boxSizing: "border-box",
};

/** 1-based row index for paginated tables. */
export function tableSerialNo(page: number, pageSize: number, rowIndex: number): number {
  const p = Math.max(1, page);
  const size = Math.max(1, pageSize);
  return (p - 1) * size + rowIndex + 1;
}

/** 1-based row index when the full list is already sliced (no pagination). */
export function tableSerialNoFromSlice(sliceStart: number, rowIndex: number): number {
  return sliceStart + rowIndex + 1;
}
