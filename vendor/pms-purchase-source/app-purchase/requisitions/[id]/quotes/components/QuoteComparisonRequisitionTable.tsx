"use client";

import React from "react";
import { Download, MessageSquare, Paperclip, Trophy } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  formatRequisitionItemDisplayValue,
  getQuoteComparisonDetailColumns,
  getQuoteComparisonFooterColSpan,
  getQuoteComparisonPrimaryLabelKey,
  getQuoteComparisonQuantityHeader,
  type RequisitionItemDisplayRow,
} from "@/lib/requisition-item-display-columns";
import type { QuoteItemColumnKey } from "@/lib/excel-requisition-quote-schema";

type Props = {
  requisitionId: string;
  requisitionType: string;
  items: RequisitionItemDisplayRow[];
  itemsPage: number;
  itemsPageSize: number;
  isComparisonLocked: boolean;
  getUpdatedQuantity: (itemId: string, defaultQty: number) => number;
  handleQuantityChange: (itemId: string, qty: number) => void;
};

function detailCellClass(key: QuoteItemColumnKey, isPrimaryLabel: boolean): string {
  if (isPrimaryLabel || key === "itemName" || key === "partName" || key === "oilGrade" || key === "paintProduct") {
    return "border-r text-foreground quote-table-body quote-item-cell quote-req-name-cell min-w-0";
  }
  if (key === "impaCode" || key === "partNumber" || key === "itemNumber") {
    return "border-r text-center text-foreground quote-table-body text-[10px] tabular-nums whitespace-nowrap quote-req-code-cell";
  }
  return "border-r text-left text-foreground quote-table-body text-[11px]";
}

function ItemLineMetaIcons({
  item,
  requisitionId,
}: {
  item: RequisitionItemDisplayRow;
  requisitionId: string;
}) {
  const remark = item.remarks?.trim();
  const desc = item.description?.trim();
  const hasRemark = Boolean(remark);
  const hasDesc = Boolean(desc);
  const hasComment = hasRemark || hasDesc;
  const attachments = item.attachments ?? [];
  const itemId = item.id;

  if (!hasComment && attachments.length === 0) return null;

  return (
    <span className="ml-1 inline-flex shrink-0 items-center gap-0.5 align-middle">
      {hasComment && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="inline-flex size-4 items-center justify-center rounded text-info hover:bg-info/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="View remarks and description"
            >
              <MessageSquare className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-sm text-left">
            <div className="space-y-2 text-xs leading-snug">
              {hasRemark && (
                <div>
                  <div className="font-semibold text-foreground">Remarks</div>
                  <p className="whitespace-pre-wrap text-muted-foreground">{remark}</p>
                </div>
              )}
              {hasDesc && (!hasRemark || desc !== remark) && (
                <div>
                  <div className="font-semibold text-foreground">Description</div>
                  <p className="whitespace-pre-wrap text-muted-foreground">{desc}</p>
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      )}
      {attachments.length > 0 && itemId && (
        attachments.length === 1 ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <a
                href={`/api/requisitions/${requisitionId}/items/${itemId}/attachments/${attachments[0].id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex size-4 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`Download ${attachments[0].fileName}`}
              >
                <Paperclip className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
              </a>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-left text-xs">
              {attachments[0].fileName}
            </TooltipContent>
          </Tooltip>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="inline-flex size-4 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`${attachments.length} attachments`}
              >
                <Paperclip className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-left">
              <div className="space-y-1 text-xs">
                {attachments.map((att) => (
                  <a
                    key={att.id}
                    href={`/api/requisitions/${requisitionId}/items/${itemId}/attachments/${att.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline"
                  >
                    <Download className="h-3 w-3 shrink-0" aria-hidden />
                    <span className="truncate">{att.fileName}</span>
                  </a>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        )
      )}
    </span>
  );
}

function renderDetailCellContent(
  item: RequisitionItemDisplayRow,
  key: QuoteItemColumnKey,
  rowIndex: number,
  requisitionId: string,
  isPrimaryLabel: boolean
): React.ReactNode {
  const label = formatRequisitionItemDisplayValue(item, key, rowIndex);
  if (isPrimaryLabel) {
    return (
      <div className="flex min-w-0 items-start gap-0.5">
        <span className="min-w-0 flex-1 font-medium leading-snug break-words [overflow-wrap:anywhere]">
          {label}
        </span>
        <ItemLineMetaIcons item={item} requisitionId={requisitionId} />
      </div>
    );
  }
  return label;
}

export function QuoteComparisonRequisitionTable({
  requisitionId,
  requisitionType,
  items,
  itemsPage,
  itemsPageSize,
  isComparisonLocked,
  getUpdatedQuantity,
  handleQuantityChange,
}: Props) {
  const detailColumns = getQuoteComparisonDetailColumns(requisitionType);
  const footerColSpan = getQuoteComparisonFooterColSpan(requisitionType);
  const primaryLabelKey = getQuoteComparisonPrimaryLabelKey(requisitionType);
  const quantityHeader = getQuoteComparisonQuantityHeader(requisitionType);
  const rowOffset = (itemsPage - 1) * itemsPageSize;

  return (
    <table className="w-full table-fixed border-collapse quote-sync-table quote-req-details-table">
      <colgroup>
        <col className="quote-req-sno-col" />
        {detailColumns.map((col) => (
          <col
            key={col.key}
            className={
              col.key === primaryLabelKey
                ? "quote-req-name-col"
                : col.key === "impaCode" || col.key === "partNumber" || col.key === "itemNumber"
                  ? "quote-req-code-col"
                  : undefined
            }
          />
        ))}
        <col className="quote-req-qty-col" />
        <col className="quote-req-updated-qty-col" />
      </colgroup>
      <thead>
        <tr className="quote-header-row border-b bg-primary/90 text-primary-foreground">
          <th
            className="quote-req-sno-cell text-center border-r text-[9px] font-semibold whitespace-nowrap text-primary-foreground"
            title="Item number"
          >
            #
          </th>
          {detailColumns.map((col) => (
            <th
              key={col.key}
              className={`border-r text-left text-[9px] font-semibold uppercase leading-tight text-primary-foreground px-1 ${
                col.key === primaryLabelKey ? "quote-req-name-cell" : ""
              }`}
              title={col.header}
            >
              {col.header}
            </th>
          ))}
          <th className="quote-req-qty-cell border-r text-center text-[9px] font-semibold leading-tight text-primary-foreground">
            {quantityHeader.toUpperCase()}
          </th>
          <th className="quote-req-updated-qty-cell text-center text-[9px] font-semibold leading-tight text-primary-foreground">
            UPDATED QTY
          </th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, itemIndex) => {
          const rowIndex = rowOffset + itemIndex;
          const itemId = item.id ?? `row-${rowIndex}`;
          const defaultQty = Number(item.quantity) || 0;

          return (
            <tr key={itemId} className="quote-data-row border-b bg-white hover:bg-muted">
              <td className="quote-req-sno-cell text-center border-r text-foreground font-medium quote-table-body text-[10px] tabular-nums">
                {rowIndex + 1}
              </td>
              {detailColumns.map((col) => {
                const isPrimaryLabel = col.key === primaryLabelKey;
                return (
                  <td
                    key={col.key}
                    className={detailCellClass(col.key, isPrimaryLabel)}
                  >
                    {renderDetailCellContent(
                      item,
                      col.key,
                      rowIndex,
                      requisitionId,
                      isPrimaryLabel
                    )}
                  </td>
                );
              })}
              <td className="quote-req-qty-cell text-center border-r text-foreground quote-table-body whitespace-nowrap text-[11px]">
                {formatRequisitionItemDisplayValue(item, "quantity", rowIndex)}
                {item.unit ? ` ${item.unit}` : ""}
              </td>
              <td className="quote-req-updated-qty-cell text-center quote-table-body">
                <div className="flex w-full min-w-0 items-center border rounded overflow-hidden">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={Math.round(getUpdatedQuantity(itemId, defaultQty))}
                    onChange={(e) =>
                      handleQuantityChange(itemId, parseInt(e.target.value, 10) || 0)
                    }
                    readOnly={isComparisonLocked}
                    disabled={isComparisonLocked}
                    className="min-w-0 min-h-[1.5rem] flex-1 text-center py-0.5 px-px text-[10px] outline-none disabled:cursor-not-allowed disabled:opacity-60"
                  />
                  <span className="bg-muted px-px text-[9px] py-0.5 border-l text-muted-foreground shrink-0">
                    {item.unit || ""}
                  </span>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
      <tfoot>
        {(["Sub Total", "Discount", "Additional Charges", "Delivery Charges"] as const).map(
          (label, i) => (
            <tr
              key={label}
              className={`quote-footer-row border-t font-medium ${i === 0 ? "bg-muted" : "bg-white"}`}
            >
              <td colSpan={footerColSpan} className="border-r text-right text-foreground quote-table-body pr-2">
                {label}
              </td>
              <td className="quote-req-updated-qty-cell quote-table-body" aria-hidden="true">
                &nbsp;
              </td>
            </tr>
          )
        )}
        <tr className="quote-footer-row bg-muted border-t-2 font-bold">
          <td colSpan={footerColSpan} className="border-r text-right quote-table-body pr-2">
            <div className="flex items-center justify-end gap-1">
              <Trophy className="h-3 w-3 text-warning" /> GRAND TOTAL
            </div>
          </td>
          <td className="quote-req-updated-qty-cell quote-table-body" aria-hidden="true">
            &nbsp;
          </td>
        </tr>
      </tfoot>
    </table>
  );
}
