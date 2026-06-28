"use client";

import Link from "next/link";
import { TableCard } from "@/components/layout/TableCard";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { YardInviteFleetRow } from "@/lib/db/index";
import type { YardInviteStatus } from "@/lib/tender/types";
import { yardPortalUrl } from "@/lib/tender/format";

const STATUS_LABEL: Record<YardInviteStatus, string> = {
  invited: "Invited",
  in_progress: "In progress",
  submitted: "Submitted",
  excel_imported: "Excel imported",
  shortlisted: "Shortlisted",
  accepted: "Accepted",
  rejected: "Rejected",
};

export function YardInvitesFleetPanel({
  initialInvites,
}: {
  initialInvites: YardInviteFleetRow[];
}) {
  return (
    <TableCard title={`Yard invites (${initialInvites.length})`}>
      {initialInvites.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">
          No yard invites yet. Open a job and use the Yard Invites tab to invite shipyards.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Job</TableHead>
              <TableHead>Vessel</TableHead>
              <TableHead>Shipyard</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead className="w-28" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialInvites.map((invite) => (
              <TableRow key={invite.id}>
                <TableCell>
                  <Link
                    href={`/projects/${invite.projectId}`}
                    className="font-medium hover:underline"
                  >
                    {invite.projectName}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {invite.vesselName ?? "—"}
                </TableCell>
                <TableCell>{invite.yardName}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{STATUS_LABEL[invite.status]}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-xs">
                  {invite.submittedAt
                    ? new Date(invite.submittedAt).toLocaleDateString()
                    : "—"}
                </TableCell>
                <TableCell>
                  <Link
                    href={yardPortalUrl(invite.token)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline"
                  >
                    Portal link
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </TableCard>
  );
}
