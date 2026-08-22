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
import { useShipyardLanguage } from "@/components/shipyard/ShipyardLanguageProvider";
import { SHIPYARD_DOCK_CYCLE_LABELS } from "@/lib/shipyard/quotationCategories";
import { shipyardQuoteUi, type ShipyardQuoteUiKey } from "@/lib/i18n/shipyardQuotationUi";

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
  const { locale } = useShipyardLanguage();
  const t = (key: ShipyardQuoteUiKey) => shipyardQuoteUi(locale, key);

  return (
    <TableCard title={t("inboxTitle")} description={t("inboxDescription")}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("reference")}</TableHead>
            <TableHead>{t("vessel")}</TableHead>
            <TableHead>{t("received")}</TableHead>
            <TableHead>{t("due")}</TableHead>
            <TableHead>{t("cycle")}</TableHead>
            <TableHead>{t("jobs")}</TableHead>
            <TableHead>{t("status")}</TableHead>
            <TableHead className="text-right">{t("open")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground">
                {t("emptyInbox")}
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
                    {t("open")}
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
