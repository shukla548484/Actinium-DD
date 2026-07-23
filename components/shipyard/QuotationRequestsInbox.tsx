"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableCard } from "@/components/layout/TableCard";
import { SHIPYARD_DOCK_CYCLE_LABELS } from "@/lib/shipyard/quotationCategories";

export type QuotationInboxRow = {
  inviteId: string;
  token: string;
  inviteStatus: string;
  requestId: string;
  referenceCode: string;
  status: string;
  dueAt: string | null;
  sentAt: string | null;
  dockCycle: string;
  jobCount: number;
  vessel: { id: string; name: string; code: string; imoNumber: string | null };
  createdAt: string;
};

const STATUS_VARIANT: Record<string, "outline" | "secondary" | "default" | "destructive"> = {
  sent: "outline",
  in_progress: "secondary",
  submitted: "default",
  withdrawn: "destructive",
  draft: "outline",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

export function QuotationRequestsInbox({ rows }: { rows: QuotationInboxRow[] }) {
  return (
    <TableCard
      title="Vessel job quotation requests"
      description="Packages shared from ship access for yard pricing."
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Reference</TableHead>
            <TableHead>Vessel</TableHead>
            <TableHead>Received</TableHead>
            <TableHead>Due</TableHead>
            <TableHead>Cycle</TableHead>
            <TableHead>Jobs</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Open</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground">
                No quotation requests yet. Ship-access crews share selected jobs from the Jobs
                Index.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.inviteId}>
                <TableCell className="font-mono text-xs">{row.referenceCode}</TableCell>
                <TableCell>
                  <div className="font-medium">{row.vessel.name}</div>
                  <div className="text-xs text-muted-foreground">{row.vessel.code}</div>
                </TableCell>
                <TableCell>{fmtDate(row.sentAt ?? row.createdAt)}</TableCell>
                <TableCell>{fmtDate(row.dueAt)}</TableCell>
                <TableCell className="text-xs">
                  {SHIPYARD_DOCK_CYCLE_LABELS[
                    row.dockCycle as keyof typeof SHIPYARD_DOCK_CYCLE_LABELS
                  ] ?? row.dockCycle}
                </TableCell>
                <TableCell>{row.jobCount}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[row.status] ?? "outline"}>{row.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    render={<Link href={`/shipyard/quotations/${row.requestId}`} />}
                    nativeButton={false}
                  >
                    Open
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableCard>
  );
}
