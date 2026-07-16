"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import {
  formatRequisitionItemDisplayValue,
  getRequisitionItemDisplayColumns,
  showSpareCurrentRobColumn,
  type RequisitionItemDisplayRow,
} from "@/lib/requisition-item-display-columns";
import type { QuoteItemColumnKey } from "@/lib/excel-requisition-quote-schema";
import { ITEM_URGENCY_LABELS, type ItemUrgency } from "@/lib/types/requisition";

type Props = {
  requisitionType: string;
  items: RequisitionItemDisplayRow[];
  /** 0-based row index offset for pagination (e.g. (page - 1) * pageSize). */
  rowIndexOffset?: number;
  showAttachments?: boolean;
  renderAttachments?: (item: RequisitionItemDisplayRow) => React.ReactNode;
  /** Tailwind classes for header cells */
  headerClassName?: string;
  /** Tailwind classes for body cells */
  cellClassName?: string;
  /** Tailwind classes for header row */
  headerRowClassName?: string;
  /** Tailwind classes for body rows */
  bodyRowClassName?: string;
};

function renderCell(
  item: RequisitionItemDisplayRow,
  key: QuoteItemColumnKey,
  rowIndex: number
): React.ReactNode {
  if (key === "urgency") {
    const label = formatRequisitionItemDisplayValue(item, key, rowIndex);
    if (label === "—") return label;
    return (
      <Badge variant="outline" className="text-xs">
        {label}
      </Badge>
    );
  }
  if (key === "itemName") {
    const name = formatRequisitionItemDisplayValue(item, key, rowIndex);
    const desc = item.description?.trim();
    return (
      <>
        <span>{name}</span>
        {desc && desc !== name && (
          <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
        )}
      </>
    );
  }
  if (key === "quantity") {
    const qty = formatRequisitionItemDisplayValue(item, key, rowIndex);
    const unit = item.unit?.trim();
    return qty === "—" ? qty : `${qty}${unit ? ` ${unit}` : ""}`;
  }
  return formatRequisitionItemDisplayValue(item, key, rowIndex);
}

export function RequisitionItemsReadOnlyTable({
  requisitionType,
  items,
  rowIndexOffset = 0,
  showAttachments = false,
  renderAttachments,
  headerClassName = "px-4 py-3 text-left text-sm font-medium text-foreground",
  cellClassName = "px-4 py-3 text-sm text-foreground",
  headerRowClassName = "bg-muted border-b border-border",
  bodyRowClassName = "border-b border-border hover:bg-muted",
}: Props) {
  const columns = getRequisitionItemDisplayColumns(requisitionType);
  const showRob = showSpareCurrentRobColumn(requisitionType);

  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className={headerRowClassName}>
          <th className={headerClassName}>#</th>
          {columns.map((col) => (
            <th key={col.key} className={headerClassName}>
              {col.header}
            </th>
          ))}
          {showRob && <th className={headerClassName}>Current ROB</th>}
          {showAttachments && <th className={headerClassName}>Attachment</th>}
        </tr>
      </thead>
      <tbody>
        {items.map((item, index) => {
          const rowIndex = rowIndexOffset + index;
          return (
            <tr key={item.id ?? rowIndex} className={bodyRowClassName}>
              <td className={`${cellClassName} font-medium`}>{rowIndex + 1}</td>
              {columns.map((col) => (
                <td key={col.key} className={cellClassName}>
                  {renderCell(item, col.key, rowIndex)}
                </td>
              ))}
              {showRob && (
                <td className={cellClassName}>
                  {item.currentRob != null ? String(item.currentRob) : "—"}
                </td>
              )}
              {showAttachments && (
                <td className={cellClassName}>
                  {renderAttachments ? renderAttachments(item) : "—"}
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}