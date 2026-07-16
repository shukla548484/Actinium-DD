"use client";

import * as React from "react";
import { TableCell, TableHead } from "@/components/ui/table";
import { TABLE_SERIAL_COLUMN_STYLE } from "@/lib/table-serial-column";
import { cn } from "@/lib/utils";

const serialHeadClassName =
  "px-1 text-center text-xs font-medium tabular-nums whitespace-nowrap";
const serialCellClassName =
  "px-1 text-center text-xs tabular-nums text-muted-foreground whitespace-nowrap";

export type TableSerialHeadProps = React.ComponentPropsWithoutRef<typeof TableHead> & {
  label?: string;
};

/** First column header for row numbers (fixed inline width). */
export function TableSerialHead({ label = "#", className, ...props }: TableSerialHeadProps) {
  return (
    <TableHead
      style={TABLE_SERIAL_COLUMN_STYLE}
      className={cn(serialHeadClassName, className)}
      {...props}
    >
      {label}
    </TableHead>
  );
}

export type TableSerialCellProps = {
  serialNo: number;
  className?: string;
  style?: React.CSSProperties;
};

/** First column cell for row numbers (fixed inline width). */
export function TableSerialCell({ serialNo, className, style }: TableSerialCellProps) {
  return (
    <TableCell
      style={style ?? TABLE_SERIAL_COLUMN_STYLE}
      className={cn(serialCellClassName, className)}
    >
      {serialNo}
    </TableCell>
  );
}
