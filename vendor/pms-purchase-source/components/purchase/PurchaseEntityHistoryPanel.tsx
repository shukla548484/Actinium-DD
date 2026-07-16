"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TablePagination } from "@/components/ui/table-pagination";
import type { PurchaseEntityHistoryEntry } from "@/lib/purchase/build-entity-history";
import { REQUISITION_STATUS_LABELS } from "@/lib/types/requisition";

/** Default rows per page for procurement history tables. */
export const HISTORY_TABLE_DEFAULT_PAGE_SIZE = 8;

const HISTORY_PAGE_SIZE_OPTIONS = [8, 15, 25, 50] as const;

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function formatStatus(status: string | null | undefined): string {
  if (!status) return "—";
  return (REQUISITION_STATUS_LABELS as Record<string, string>)[status] ?? status.replace(/_/g, " ");
}

function badgeVariant(actionType: string): "default" | "secondary" | "destructive" | "outline" {
  if (actionType === "REJECTED" || actionType === "CANCELLED" || actionType === "DELETED") {
    return "destructive";
  }
  if (
    actionType === "APPROVED" ||
    actionType.includes("APPROVED") ||
    actionType === "PAID" ||
    actionType === "VERIFIED"
  ) {
    return "default";
  }
  if (actionType === "RETURNED") return "secondary";
  return "outline";
}

function performerLabel(entry: PurchaseEntityHistoryEntry): string {
  const name = [entry.performedBy.firstName, entry.performedBy.lastName].filter(Boolean).join(" ");
  const base = name || "System";
  return entry.performedBy.designation ? `${base} · ${entry.performedBy.designation}` : base;
}

function statusChangeLabel(entry: PurchaseEntityHistoryEntry): string {
  if (entry.previousStatus && entry.newStatus) {
    return `${formatStatus(entry.previousStatus)} → ${formatStatus(entry.newStatus)}`;
  }
  if (entry.newStatus) return formatStatus(entry.newStatus);
  return "—";
}

function detailsLabel(entry: PurchaseEntityHistoryEntry): string {
  const parts: string[] = [];
  if (entry.actionDescription) parts.push(entry.actionDescription);
  if (entry.comments) parts.push(entry.comments);
  return parts.join(" — ") || "—";
}

type Props = {
  history: PurchaseEntityHistoryEntry[];
  emptyMessage?: string;
  defaultPageSize?: number;
  dense?: boolean;
  /** Show every row (for print/PDF capture). */
  showAll?: boolean;
};

export function PurchaseEntityHistoryPanel({
  history,
  emptyMessage = "No history available",
  defaultPageSize = HISTORY_TABLE_DEFAULT_PAGE_SIZE,
  dense = false,
  showAll = false,
}: Props) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  useEffect(() => {
    setPage(1);
  }, [history.length, history[0]?.id]);

  const total = history.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageRows = useMemo(() => {
    if (showAll) return history;
    const start = (page - 1) * pageSize;
    return history.slice(start, start + pageSize);
  }, [history, page, pageSize, showAll]);

  if (history.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="h-12 w-12 mx-auto mb-4 opacity-30" />
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn("flex min-w-0 w-full flex-col", dense ? "gap-1" : "gap-2")}>
      <div className="w-full min-w-0 overflow-x-auto rounded-md border">
        <Table className={cn("min-w-[560px] w-full", dense ? "text-xs" : "text-sm")}>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="whitespace-nowrap font-semibold py-1">Event</TableHead>
              <TableHead className="whitespace-nowrap font-semibold min-w-[120px] py-1">Status change</TableHead>
              <TableHead className="whitespace-nowrap font-semibold min-w-[100px] py-1">User</TableHead>
              <TableHead className="whitespace-nowrap font-semibold min-w-[110px] py-1">Date &amp; time</TableHead>
              <TableHead className="font-semibold min-w-[140px] py-1">Details / reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className={cn("align-top whitespace-nowrap", dense && "py-1")}>
                  <Badge variant={badgeVariant(entry.actionType)} className="font-normal text-[10px] px-1.5 py-0">
                    {entry.actionLabel}
                  </Badge>
                </TableCell>
                <TableCell className={cn("align-top text-xs text-muted-foreground", dense && "py-1")}>
                  {statusChangeLabel(entry)}
                </TableCell>
                <TableCell className={cn("align-top text-xs", dense && "py-1")}>{performerLabel(entry)}</TableCell>
                <TableCell className={cn("align-top text-xs whitespace-nowrap text-muted-foreground", dense && "py-1")}>
                  {formatWhen(entry.createdAt)}
                </TableCell>
                <TableCell className={cn("align-top text-xs whitespace-pre-wrap break-words max-w-[220px]", dense && "py-1")}>
                  {detailsLabel(entry)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {showAll ? null : (
        <TablePagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
          pageSizeOptions={dense ? ([4, 8, 15] as const) : HISTORY_PAGE_SIZE_OPTIONS}
          itemLabel="events"
          hideWhenSinglePage={dense}
          className={dense ? "pt-0 text-xs" : "pt-1"}
        />
      )}
    </div>
  );
}
