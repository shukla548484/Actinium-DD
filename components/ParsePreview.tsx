"use client";

import { useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ParseDiagnostic } from "@/lib/hull/resilientParser";
import type { VendorHullPaintQuote } from "@/lib/hull/types";
import type { PrepValidation } from "@/lib/hull/prepChainValidator";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ParsePreviewProps {
  quotes: VendorHullPaintQuote[];
  diagnostics?: ParseDiagnostic[];
  validations?: PrepValidation[];
}

function severityIcon(severity: string) {
  switch (severity) {
    case "error": return "✕";
    case "warning": return "⚠";
    case "info": return "ℹ";
    case "ok": return "✓";
    default: return "•";
  }
}

function severityColor(severity: string) {
  switch (severity) {
    case "error": return "text-red-700 bg-red-50";
    case "warning": return "text-amber-700 bg-amber-50";
    case "info": return "text-blue-700 bg-blue-50";
    case "ok": return "text-emerald-700 bg-emerald-50";
    default: return "text-zinc-600 bg-zinc-50";
  }
}

export function ParsePreview({ quotes, diagnostics, validations }: ParsePreviewProps) {
  const [expanded, setExpanded] = useState(false);

  if (quotes.length === 0) return null;

  const totalItems = quotes.reduce((acc, q) => acc + q.lineItems.length, 0);
  const totalZones = quotes.reduce((acc, q) => acc + q.zoneAreas.length, 0);
  const issues = [
    ...(diagnostics?.filter((d) => d.type !== "info") ?? []),
    ...(validations?.filter((v) => v.severity === "warning" || v.severity === "error") ?? []),
  ];

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <Card>
        <CollapsibleTrigger className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-muted/50">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">
              Parse results & diagnostics
            </h3>
            <p className="mt-0.5 text-xs text-zinc-500">
              {quotes.length} file{quotes.length > 1 ? "s" : ""} ·{" "}
              {totalZones} zone{totalZones !== 1 ? "s" : ""} ·{" "}
              {totalItems} line item{totalItems !== 1 ? "s" : ""}
              {issues.length > 0 && (
                <Badge variant="outline" className="ml-2 text-amber-700">
                  {issues.length} issue{issues.length !== 1 ? "s" : ""}
                </Badge>
              )}
            </p>
          </div>
          <ChevronDownIcon
            className={cn(
              "size-4 shrink-0 text-zinc-400 transition-transform",
              expanded && "rotate-180",
            )}
          />
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="border-t pt-3">
            {diagnostics && diagnostics.length > 0 && (
              <div className="mb-4 space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Parse diagnostics
                </p>
                {diagnostics.map((d, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2 rounded px-2 py-1.5 text-xs ${severityColor(d.type)}`}
                  >
                    <span className="mt-0.5 font-bold">{severityIcon(d.type)}</span>
                    <span>
                      {d.sheet && <strong>[{d.sheet}] </strong>}
                      {d.row != null && <span>Row {d.row}: </span>}
                      {d.message}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {validations && validations.filter((v) => v.severity !== "ok").length > 0 && (
              <div className="mb-4 space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Prep treatment validation
                </p>
                {validations
                  .filter((v) => v.severity !== "ok")
                  .map((v, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-2 rounded px-2 py-1.5 text-xs ${severityColor(v.severity)}`}
                    >
                      <span className="mt-0.5 font-bold">{severityIcon(v.severity)}</span>
                      <span>{v.message}</span>
                    </div>
                  ))}
              </div>
            )}

            <Accordion multiple className="space-y-2">
              {quotes.map((q) => (
                <AccordionItem
                  key={q.vendorName}
                  value={q.vendorName}
                  className="rounded border border-zinc-100 px-3"
                >
                  <AccordionTrigger className="py-2 hover:no-underline">
                    {q.vendorName} — {q.lineItems.length} items from {q.fileName}
                  </AccordionTrigger>
                  <AccordionContent>
                    <Table>
                      <TableHeader>
                        <TableRow className="text-left text-zinc-500">
                          <TableHead className="h-8 py-1 pr-2">Zone</TableHead>
                          <TableHead className="h-8 py-1 pr-2">Service</TableHead>
                          <TableHead className="h-8 py-1 pr-2">Area (m²)</TableHead>
                          <TableHead className="h-8 py-1 pr-2">Rate/m²</TableHead>
                          <TableHead className="h-8 py-1 pr-2">Total</TableHead>
                          <TableHead className="h-8 py-1 pr-2">Original label</TableHead>
                          <TableHead className="h-8 py-1">Source</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {q.lineItems.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="py-1 pr-2 font-medium">
                              {item.zoneName}
                            </TableCell>
                            <TableCell className="py-1 pr-2">{item.serviceName}</TableCell>
                            <TableCell className="py-1 pr-2">{item.areaSqm}</TableCell>
                            <TableCell className="py-1 pr-2">
                              {item.unitRatePerSqm.toFixed(2)}
                            </TableCell>
                            <TableCell className="py-1 pr-2">
                              {item.calculatedTotal.toFixed(2)}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate py-1 pr-2 text-zinc-500">
                              {item.originalLabel}
                            </TableCell>
                            <TableCell className="py-1 text-zinc-400">
                              {item.sheetName} r{item.rowIndex}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
