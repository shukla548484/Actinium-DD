"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { EntityActionsMenu } from "@/components/admin/EntityActionsMenu";
import { EntityStatusBadge, ENTITY_STATUS_OPTIONS } from "@/components/admin/EntityStatusBadge";
import { TableCard } from "@/components/layout/TableCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { EntityStatus } from "@prisma/client";
import type { VesselDto } from "@/lib/admin/types";
import { mapSelectItems, type LabeledOption } from "@/lib/ui/labeledSelect";

type CompanyOption = { id: string; name: string; code: string };

export function VesselListPanel() {
  const [vessels, setVessels] = useState<VesselDto[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<EntityStatus | "all">("all");
  const [companyId, setCompanyId] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    void fetch("/api/admin/companies?select=1&activeOnly=0")
      .then((r) => r.json())
      .then((d) => setCompanies(d.companies ?? []));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      limit: "20",
      ...(search ? { search } : {}),
      ...(status !== "all" ? { status } : {}),
      ...(companyId !== "all" ? { companyId } : {}),
    });
    const res = await fetch(`/api/admin/vessels?${params}`);
    if (!res.ok) {
      setVessels([]);
      setTotalPages(1);
      setLoading(false);
      return;
    }
    const data = (await res.json()) as { vessels?: VesselDto[]; totalPages?: number };
    setVessels(data.vessels ?? []);
    setTotalPages(data.totalPages ?? 1);
    setLoading(false);
  }, [page, search, status, companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const companyItems = useMemo((): LabeledOption[] => {
    return [
      { value: "all", label: "All companies" },
      ...mapSelectItems(companies, (c) => c.id, (c) => c.name),
    ];
  }, [companies]);

  const statusItems = useMemo(
    () => ENTITY_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
    [],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search vessels…"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
          className="max-w-xs"
        />
        <Select
          items={companyItems}
          value={companyId}
          onValueChange={(v) => {
            setPage(1);
            setCompanyId(v ?? "all");
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All companies" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All companies</SelectItem>
            {companies.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          items={statusItems}
          value={status}
          onValueChange={(v) => {
            setPage(1);
            setStatus(v as EntityStatus | "all");
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ENTITY_STATUS_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <TableCard title="Vessels">
        {loading ? (
          <p className="p-4 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>IMO</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Crew</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {vessels.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No vessels found
                  </TableCell>
                </TableRow>
              ) : (
                vessels.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-mono text-xs">{v.code}</TableCell>
                    <TableCell>
                      <Link href={`/admin/vessels/${v.id}`} className="font-medium hover:underline">
                        {v.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{v.companyName}</TableCell>
                    <TableCell className="font-mono text-xs">{v.imoNumber ?? "—"}</TableCell>
                    <TableCell>
                      <EntityStatusBadge status={v.status} />
                    </TableCell>
                    <TableCell className="text-right">{v.employeeCount ?? 0}</TableCell>
                    <TableCell>
                      <EntityActionsMenu
                        entityType="vessel"
                        id={v.id}
                        status={v.status}
                        viewHref={`/admin/vessels/${v.id}`}
                        editHref={`/admin/vessels/${v.id}/edit`}
                        onChanged={() => void load()}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </TableCard>

      {totalPages > 1 ? (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}
