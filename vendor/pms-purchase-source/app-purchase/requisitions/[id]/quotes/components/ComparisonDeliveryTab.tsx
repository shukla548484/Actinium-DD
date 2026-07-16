"use client";

import { Calendar, Clock, MapPin } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type QuoteDelivery = {
  quoteId: string;
  rank: number;
  vendor: { name: string };
  portOfSupply?: string | null;
  deliveryPort?: string | null;
  exWorkLocation?: string | null;
  leadTime?: string | null;
  validUntil?: Date | string | null;
  items?: Array<{ deliveryTime?: number | null }>;
};

type Props = {
  quotes: QuoteDelivery[];
  formatDate: (date: Date | string | null) => string;
};

function resolveLeadTime(q: QuoteDelivery): string {
  if (q.leadTime?.trim()) return q.leadTime;
  const dt = q.items?.[0]?.deliveryTime;
  if (dt != null) return `${dt} days`;
  return "—";
}

const th = "h-7 px-1.5 text-[11px] font-semibold text-foreground";
const td = "px-1.5 py-1 text-[10px] font-normal align-middle";

export function ComparisonDeliveryTab({ quotes, formatDate }: Props) {
  if (quotes.length === 0) {
    return <p className="p-2 text-xs text-muted-foreground">No quotes available.</p>;
  }

  return (
    <div className="overflow-x-auto rounded border border-border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted hover:bg-muted">
            <TableHead className={`${th} w-8 text-center`}>#</TableHead>
            <TableHead className={th}>Vendor</TableHead>
            <TableHead className={th}>
              <MapPin className="mr-0.5 inline h-3 w-3" />
              Port of supply
            </TableHead>
            <TableHead className={th}>Delivery port</TableHead>
            <TableHead className={th}>Ex-work</TableHead>
            <TableHead className={th}>
              <Clock className="mr-0.5 inline h-3 w-3" />
              Lead time
            </TableHead>
            <TableHead className={th}>
              <Calendar className="mr-0.5 inline h-3 w-3" />
              Valid until
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {quotes.map((q) => (
            <TableRow key={q.quoteId}>
              <TableCell className={`${td} text-center font-semibold`}>{q.rank}</TableCell>
              <TableCell className={`${td} font-medium`}>{q.vendor.name}</TableCell>
              <TableCell className={td}>{q.portOfSupply || "—"}</TableCell>
              <TableCell className={td}>{q.deliveryPort || "—"}</TableCell>
              <TableCell className={td}>{q.exWorkLocation || "—"}</TableCell>
              <TableCell className={td}>{resolveLeadTime(q)}</TableCell>
              <TableCell className={td}>{q.validUntil ? formatDate(q.validUntil) : "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
