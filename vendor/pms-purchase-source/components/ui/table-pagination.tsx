"use client";

import { cn } from "@/lib/utils";
import {
  DEFAULT_TABLE_PAGE_SIZE,
  MIN_TABLE_PAGE_SIZE,
  TABLE_PAGE_SIZE_OPTIONS,
  type TablePageSize,
} from "@/lib/table-page-size";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export {
  DEFAULT_TABLE_PAGE_SIZE,
  MIN_TABLE_PAGE_SIZE,
  TABLE_PAGE_SIZE_OPTIONS,
  type TablePageSize,
} from "@/lib/table-page-size";

export type TablePaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  /** When set, shows a rows-per-page selector using {@link TABLE_PAGE_SIZE_OPTIONS}. */
  onPageSizeChange?: (size: TablePageSize) => void;
  /** Override allowed page sizes (defaults to standard table options). */
  pageSizeOptions?: readonly number[];
  /** Plural noun in the summary line, e.g. "entries", "items", "invoices". */
  itemLabel?: string;
  className?: string;
  /**
   * When true, render nothing if everything fits on one page.
   * @default true
   */
  hideWhenSinglePage?: boolean;
  /** Disable controls (e.g. while a request is in flight). */
  disabled?: boolean;
  /**
   * Show clickable page numbers between Previous and Next (with ellipses when many pages).
   * @default true
   */
  showPageNumbers?: boolean;
  /** Max page buttons to show around the current page (excluding first/last). @default 1 */
  siblingCount?: number;
};

export type TablePageSizeSelectProps = {
  value: number;
  onValueChange: (size: TablePageSize) => void;
  options?: readonly number[];
  /** e.g. " / page" */
  optionSuffix?: string;
  disabled?: boolean;
  triggerClassName?: string;
  className?: string;
};

/** Rows-per-page dropdown shared across tables. */
export function TablePageSizeSelect({
  value,
  onValueChange,
  options = TABLE_PAGE_SIZE_OPTIONS,
  optionSuffix = "",
  disabled = false,
  triggerClassName,
  className,
}: TablePageSizeSelectProps) {
  const allowed = options.length > 0 ? options : TABLE_PAGE_SIZE_OPTIONS;
  const selectValue = allowed.includes(value) ? String(value) : String(allowed[0]);

  return (
    <Select
      value={selectValue}
      onValueChange={(v) => onValueChange(parseInt(v, 10) as TablePageSize)}
      disabled={disabled}
    >
      <SelectTrigger
        className={cn("h-8 w-20 text-sm", triggerClassName)}
        aria-label="Rows per page"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {allowed.map((n) => (
          <SelectItem key={n} value={String(n)}>
            {n}
            {optionSuffix}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function buildPageList(
  current: number,
  totalPages: number,
  siblingCount: number
): (number | "ellipsis")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages = new Set<number>();
  pages.add(1);
  pages.add(totalPages);
  for (let i = current - siblingCount; i <= current + siblingCount; i++) {
    if (i >= 1 && i <= totalPages) pages.add(i);
  }
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | "ellipsis")[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const n = sorted[i];
    if (i > 0 && sorted[i - 1] !== undefined && n - sorted[i - 1]! > 1) {
      out.push("ellipsis");
    }
    out.push(n);
  }
  return out;
}

const navBtn =
  "inline-flex items-center gap-1 rounded-md px-1 py-1.5 text-sm font-normal text-foreground/85 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40";

const pageNumInactive =
  "min-h-9 min-w-9 rounded-lg px-2 text-sm font-normal text-foreground/85 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none";

const pageNumActive =
  "min-h-9 min-w-9 rounded-lg border border-border bg-background px-2 text-sm font-normal text-foreground shadow-none";

/**
 * Shared table pagination: range summary, numbered pages, Previous / Next.
 * Use with sliced data: `list.slice((page - 1) * pageSize, page * pageSize)`.
 */
export function TablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = TABLE_PAGE_SIZE_OPTIONS,
  itemLabel = "entries",
  className,
  hideWhenSinglePage = true,
  disabled = false,
  showPageNumbers = true,
  siblingCount = 1,
}: TablePaginationProps) {
  if (total === 0) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (hideWhenSinglePage && totalPages <= 1 && !onPageSizeChange) return null;

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  const pageItems = useMemo(
    () => buildPageList(page, totalPages, Math.max(0, siblingCount)),
    [page, totalPages, siblingCount]
  );

  return (
    <div
      className={cn(
        "mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between",
        className
      )}
    >
      {onPageSizeChange ? (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Rows per page:</span>
          <TablePageSizeSelect
            value={pageSize}
            onValueChange={onPageSizeChange}
            options={pageSizeOptions}
            disabled={disabled}
          />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Showing {start} to {end} of {total} {itemLabel}
        </p>
      )}

      <div
        className={cn(
          "flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center",
          onPageSizeChange ? "sm:flex-1 sm:justify-end" : ""
        )}
      >
        {onPageSizeChange && (
          <p className="text-sm text-muted-foreground sm:mr-4">
            Showing {start} to {end} of {total} {itemLabel}
          </p>
        )}
        <nav
          className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 sm:gap-x-6"
          aria-label="Pagination"
        >
          <button
            type="button"
            className={navBtn}
            disabled={disabled || page <= 1}
            onClick={() => onPageChange(Math.max(1, page - 1))}
          >
            <ChevronLeft className="h-4 w-4 shrink-0 opacity-70" strokeWidth={1.75} />
            Previous
          </button>

          {showPageNumbers && totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 sm:gap-x-5">
              {pageItems.map((item, idx) =>
                item === "ellipsis" ? (
                  <span
                    key={`e-${idx}`}
                    className="select-none px-0.5 text-sm tracking-wide text-foreground/70"
                    aria-hidden
                  >
                    ...
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    disabled={disabled}
                    onClick={() => onPageChange(item)}
                    className={cn(
                      page === item ? pageNumActive : pageNumInactive
                    )}
                  >
                    {item}
                  </button>
                )
              )}
            </div>
          )}

          <button
            type="button"
            className={navBtn}
            disabled={disabled || page >= totalPages}
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          >
            Next
            <ChevronRight className="h-4 w-4 shrink-0 opacity-70" strokeWidth={1.75} />
          </button>
        </nav>
      </div>
    </div>
  );
}
