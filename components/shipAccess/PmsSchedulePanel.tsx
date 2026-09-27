"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LabeledSelect } from "@/components/ui/LabeledSelect";
import { SortableTableHead } from "@/components/ui/SortableTableHead";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaginationBar } from "@/components/superintendent/PaginationBar";
import { ActiniumLoadingState } from "@/components/ui/ActiniumLoader";
import {
  useClientTable,
  type ComparableValue,
} from "@/hooks/useClientTable";
import type { PmsItemStatus, PmsScheduleItemDto } from "@/lib/db/vesselPms";
import { MACHINERY_REGISTER_DEPARTMENTS } from "@/lib/machinery/machineryRegisterImport";

type PmsResponse = {
  items?: PmsScheduleItemDto[];
  summary?: {
    overdue: number;
    dueSoon: number;
    ok: number;
    noSchedule: number;
    linkedJobs: number;
  };
};

const STATUS_LABEL: Record<PmsItemStatus, string> = {
  overdue: "Overdue",
  due_soon: "Due soon",
  ok: "On schedule",
  no_schedule: "No schedule",
};

const STATUS_FILTER_ITEMS = [
  { value: "all", label: "All statuses" },
  { value: "overdue", label: "Overdue" },
  { value: "due_soon", label: "Due soon" },
  { value: "ok", label: "On schedule" },
  { value: "no_schedule", label: "No schedule" },
] as const;

const DEPARTMENT_FILTER_ITEMS = [
  { value: "all", label: "All departments" },
  ...MACHINERY_REGISTER_DEPARTMENTS.map((value) => ({ value, label: value })),
];

function statusVariant(status: PmsItemStatus) {
  switch (status) {
    case "overdue":
      return "destructive" as const;
    case "due_soon":
      return "secondary" as const;
    case "ok":
      return "default" as const;
    default:
      return "outline" as const;
  }
}

function nextDueSortValue(item: PmsScheduleItemDto): ComparableValue {
  if (item.nextDueDate) return new Date(item.nextDueDate);
  if (item.nextDueHours != null) return item.nextDueHours;
  return null;
}

function getPmsSortValue(item: PmsScheduleItemDto, key: string): ComparableValue {
  switch (key) {
    case "asset":
      return item.assetName;
    case "department":
      return item.department;
    case "status":
      return STATUS_LABEL[item.status];
    case "runningHours":
      return item.currentRunningHours;
    case "nextDue":
      return nextDueSortValue(item);
    case "linkedJob":
      return item.linkedJobStatus ?? (item.linkedJobId ? "linked" : null);
    default:
      return null;
  }
}

export function PmsSchedulePanel({ apiPath = "/api/ship-access/pms" }: { apiPath?: string }) {
  const [data, setData] = useState<PmsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [proposing, setProposing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [nameFilter, setNameFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const load = useCallback(() => {
    setLoading(true);
    void fetch(apiPath)
      .then((r) => r.json())
      .then((d: PmsResponse) => setData(d))
      .finally(() => setLoading(false));
  }, [apiPath]);

  useEffect(() => {
    load();
  }, [load]);

  async function proposeOverdue() {
    setProposing(true);
    setMessage(null);
    const res = await fetch("/api/ship-access/machinery/propose-overdue", { method: "POST" });
    setProposing(false);
    if (res.ok) {
      const body = (await res.json()) as { proposed?: number };
      setMessage(
        body.proposed
          ? `Created ${body.proposed} draft dry-dock job(s) from overdue PMS.`
          : "No new overdue items to propose.",
      );
      load();
    } else {
      setMessage("Could not propose jobs.");
    }
  }

  const summary = data?.summary;
  const items = data?.items ?? [];

  const nameFilterNormalized = nameFilter.trim().toLowerCase();
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (departmentFilter !== "all" && item.department !== departmentFilter) return false;
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (!nameFilterNormalized) return true;
      return item.assetName.toLowerCase().includes(nameFilterNormalized);
    });
  }, [items, departmentFilter, statusFilter, nameFilterNormalized]);

  const {
    pageItems,
    page,
    setPage,
    totalPages,
    total,
    sortKey,
    sortDirection,
    toggleSort,
  } = useClientTable({
    items: filteredItems,
    getSortValue: getPmsSortValue,
    defaultSort: { key: "asset", direction: "asc" },
    resetKey: `${nameFilterNormalized}|${departmentFilter}|${statusFilter}`,
  });

  return (
    <div className="space-y-4">
      {summary ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { label: "Overdue", value: summary.overdue },
            { label: "Due soon", value: summary.dueSoon },
            { label: "On schedule", value: summary.ok },
            { label: "No schedule", value: summary.noSchedule },
            { label: "Linked jobs", value: summary.linkedJobs },
          ].map((kpi) => (
            <Card key={kpi.label}>
              <CardHeader className="py-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.label}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-2xl font-semibold tabular-nums">{kpi.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {apiPath.includes("/superintendent/") ? null : (
          <Button type="button" size="sm" disabled={proposing} onClick={() => void proposeOverdue()}>
            {proposing ? "Proposing…" : "Propose overdue PMS jobs"}
          </Button>
        )}
        {apiPath.includes("/superintendent/") ? null : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            render={<Link href="/ship-access/dry-dock/jobs" />}
            nativeButton={false}
          >
            View dry dock jobs
          </Button>
        )}
      </div>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      {loading ? (
        <ActiniumLoadingState label="Loading PMS schedule…" size="sm" />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              type="text"
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              placeholder="Filter by name…"
              aria-label="Filter by asset name"
              className="min-w-[200px] max-w-sm flex-1"
            />
            <LabeledSelect
              items={DEPARTMENT_FILTER_ITEMS}
              value={departmentFilter}
              onValueChange={setDepartmentFilter}
              className="w-[11rem]"
              id="pms-dept-filter"
            />
            <LabeledSelect
              items={[...STATUS_FILTER_ITEMS]}
              value={statusFilter}
              onValueChange={setStatusFilter}
              className="w-[11rem]"
              id="pms-status-filter"
            />
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead
                    label="Asset"
                    columnKey="asset"
                    activeKey={sortKey}
                    direction={sortDirection}
                    onSort={toggleSort}
                  />
                  <SortableTableHead
                    label="Department"
                    columnKey="department"
                    activeKey={sortKey}
                    direction={sortDirection}
                    onSort={toggleSort}
                  />
                  <SortableTableHead
                    label="Status"
                    columnKey="status"
                    activeKey={sortKey}
                    direction={sortDirection}
                    onSort={toggleSort}
                  />
                  <SortableTableHead
                    label="Running hours"
                    columnKey="runningHours"
                    activeKey={sortKey}
                    direction={sortDirection}
                    onSort={toggleSort}
                  />
                  <SortableTableHead
                    label="Next due"
                    columnKey="nextDue"
                    activeKey={sortKey}
                    direction={sortDirection}
                    onSort={toggleSort}
                  />
                  <SortableTableHead
                    label="Linked job"
                    columnKey="linkedJob"
                    activeKey={sortKey}
                    direction={sortDirection}
                    onSort={toggleSort}
                  />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No machinery assets registered for this vessel.
                    </TableCell>
                  </TableRow>
                ) : pageItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No assets match the current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  pageItems.map((item) => (
                    <TableRow key={item.assetId}>
                      <TableCell className="font-medium">{item.assetName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{item.department}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(item.status)}>{STATUS_LABEL[item.status]}</Badge>
                      </TableCell>
                      <TableCell className="tabular-nums">{item.currentRunningHours ?? "—"}</TableCell>
                      <TableCell className="text-sm">
                        {item.nextDueDate
                          ? new Date(item.nextDueDate).toLocaleDateString()
                          : item.nextDueHours != null
                            ? `${item.nextDueHours} hrs`
                            : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {item.linkedJobId ? (
                          <Link
                            href="/ship-access/dry-dock/jobs"
                            className="text-primary hover:underline"
                          >
                            {item.linkedJobStatus ?? "draft"}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <PaginationBar page={page} totalPages={totalPages} total={total} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
