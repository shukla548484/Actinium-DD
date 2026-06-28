"use client";

import { resolveSpecDescription, type ScopeLocale } from "@/lib/i18n/scope";
import { fmtMoney } from "@/lib/tender/format";
import type { DurationContext } from "@/lib/tender/calculate";
import { scopeSummary } from "@/lib/tender/resolveScope";
import type { PricingStatus, SpecLine } from "@/lib/tender/types";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
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

export type YardDraftLine = {
  unitRate: number | null;
  discountPct: number | null;
  pricingStatus: PricingStatus;
  remarks: string | null;
};

interface Props {
  lines: SpecLine[];
  draft: Record<string, YardDraftLine>;
  locale: ScopeLocale;
  currency: string;
  duration: DurationContext | null;
  labels: Record<string, string>;
  onDraftChange: (draft: Record<string, YardDraftLine>) => void;
  linePreview: (
    spec: SpecLine,
    d: YardDraftLine,
  ) => { gross: number | null; net: number | null };
}

export function YardQuoteLineTable({
  lines,
  draft,
  locale,
  currency,
  duration,
  labels,
  onDraftChange,
  linePreview,
}: Props) {
  if (lines.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        No specification lines in this section.
      </p>
    );
  }

  return (
    <ScrollArea className="w-full">
      <Table className="min-w-full text-xs">
        <TableHeader>
          <TableRow className="text-muted-foreground">
            <TableHead>{labels.lineCode}</TableHead>
            <TableHead className="min-w-[180px]">{labels.description}</TableHead>
            <TableHead className="min-w-[140px]">{labels.scopeNotes}</TableHead>
            <TableHead>{labels.unit}</TableHead>
            <TableHead>{labels.scopeQty}</TableHead>
            <TableHead>{labels.scopeDays}</TableHead>
            <TableHead>{labels.scopeArea}</TableHead>
            <TableHead>{labels.referenceRate}</TableHead>
            <TableHead className="border-l bg-amber-50/50">{labels.unitRate}</TableHead>
            <TableHead className="bg-amber-50/50">{labels.discountPct}</TableHead>
            <TableHead className="bg-amber-50/50">{labels.gross}</TableHead>
            <TableHead className="bg-amber-50/50">{labels.net}</TableHead>
            <TableHead className="bg-amber-50/50">{labels.status}</TableHead>
            <TableHead className="bg-amber-50/50">{labels.remarks}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((spec) => {
            const d = draft[spec.id] ?? {
              unitRate: null,
              discountPct: 0,
              pricingStatus: "priced" as PricingStatus,
              remarks: null,
            };
            const scope = duration ? scopeSummary(spec, duration) : null;
            const preview = linePreview(spec, d);
            const desc = resolveSpecDescription(spec.descriptions, locale);

            return (
              <TableRow key={spec.id} className="align-top">
                <TableCell className="font-mono">{spec.lineCode ?? "—"}</TableCell>
                <TableCell>
                  {desc}
                  {spec.isOptional && (
                    <span className="ml-1 text-muted-foreground">({labels.optional})</span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{spec.scopeNotes ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{spec.unit ?? "—"}</TableCell>
                <TableCell>{scope?.quantity ?? "—"}</TableCell>
                <TableCell>{scope?.days ?? "—"}</TableCell>
                <TableCell>{scope?.areaM2 ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {spec.referenceUnitRate != null
                    ? fmtMoney(spec.referenceUnitRate, currency)
                    : "—"}
                </TableCell>
                <TableCell className="border-l bg-amber-50/20">
                  <Input
                    type="number"
                    value={d.unitRate ?? ""}
                    onChange={(e) =>
                      onDraftChange({
                        ...draft,
                        [spec.id]: {
                          ...d,
                          unitRate: e.target.value ? Number(e.target.value) : null,
                        },
                      })
                    }
                    className="min-w-[80px]"
                  />
                </TableCell>
                <TableCell className="bg-amber-50/20">
                  {spec.allowDiscount ? (
                    <Input
                      type="number"
                      min={0}
                      max={spec.maxDiscountPct ?? 100}
                      value={d.discountPct ?? ""}
                      onChange={(e) =>
                        onDraftChange({
                          ...draft,
                          [spec.id]: {
                            ...d,
                            discountPct: e.target.value ? Number(e.target.value) : 0,
                          },
                        })
                      }
                      className="min-w-[60px]"
                    />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="bg-amber-50/20">{fmtMoney(preview.gross, currency)}</TableCell>
                <TableCell className="bg-amber-50/20 font-medium">
                  {fmtMoney(preview.net, currency)}
                </TableCell>
                <TableCell className="bg-amber-50/20">
                  <Select
                    value={d.pricingStatus}
                    onValueChange={(v) =>
                      onDraftChange({
                        ...draft,
                        [spec.id]: { ...d, pricingStatus: v as PricingStatus },
                      })
                    }
                  >
                    <SelectTrigger className="min-w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="priced">{labels.priced}</SelectItem>
                      <SelectItem value="included">{labels.included}</SelectItem>
                      <SelectItem value="na">{labels.na}</SelectItem>
                      <SelectItem value="owner_supply">{labels.ownerSupply}</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="bg-amber-50/20">
                  <Input
                    value={d.remarks ?? ""}
                    onChange={(e) =>
                      onDraftChange({
                        ...draft,
                        [spec.id]: { ...d, remarks: e.target.value || null },
                      })
                    }
                    className="min-w-[100px]"
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}
