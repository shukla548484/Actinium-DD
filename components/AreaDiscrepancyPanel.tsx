"use client";

import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import type { AreaDiscrepancy } from "@/lib/hull/areaDiscrepancy";

interface AreaDiscrepancyPanelProps {
  discrepancies: AreaDiscrepancy[];
  formulaBreakdown: string[];
  onOverride?: (zoneId: string, area: number) => void;
}

function StatusBadge({ recommendation }: { recommendation: AreaDiscrepancy["recommendation"] }) {
  const config = {
    "use-sheet": { label: "OK", variant: "secondary" as const, className: "bg-emerald-100 text-emerald-700" },
    "use-estimated": { label: "Estimated", variant: "secondary" as const, className: "bg-blue-100 text-blue-700" },
    verify: { label: "Verify", variant: "outline" as const, className: "bg-amber-100 text-amber-700" },
    "no-data": { label: "No data", variant: "outline" as const, className: "bg-zinc-100 text-zinc-600" },
  };

  const { label, variant, className } = config[recommendation];

  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  );
}

export function AreaDiscrepancyPanel({
  discrepancies,
  formulaBreakdown,
  onOverride,
}: AreaDiscrepancyPanelProps) {
  const [showFormula, setShowFormula] = useState(false);

  if (discrepancies.length === 0) return null;

  const hasIssues = discrepancies.some(
    (d) => d.recommendation === "verify",
  );

  return (
    <Collapsible open={showFormula} onOpenChange={setShowFormula}>
      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="py-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">
              Area comparison: Sheet vs Estimated
            </CardTitle>
            <CollapsibleTrigger
              render={
                <Button
                  variant="ghost"
                  size="xs"
                  className="text-blue-700 hover:bg-blue-50 hover:text-blue-700"
                />
              }
            >
              {showFormula ? "Hide formula" : "Show formula"}
            </CollapsibleTrigger>
          </div>

          {hasIssues && (
            <Alert className="mt-2 border-amber-200 bg-amber-50 py-2">
              <AlertDescription className="text-xs text-amber-700">
                Some areas differ significantly — review recommended before cost comparison
              </AlertDescription>
            </Alert>
          )}
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="border-t bg-zinc-50 pt-3">
            <p className="mb-2 text-xs font-medium text-zinc-600">
              Paint Consultants Formula Breakdown:
            </p>
            <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-xs text-zinc-700">
              {formulaBreakdown.join("\n")}
            </pre>
          </CardContent>
        </CollapsibleContent>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-zinc-50 hover:bg-zinc-50">
                <TableHead className="h-8 px-5 text-xs text-zinc-500">Zone</TableHead>
                <TableHead className="h-8 px-3 text-xs text-zinc-500">Sheet (m²)</TableHead>
                <TableHead className="h-8 px-3 text-xs text-zinc-500">Estimated (m²)</TableHead>
                <TableHead className="h-8 px-3 text-xs text-zinc-500">Diff %</TableHead>
                <TableHead className="h-8 px-3 text-xs text-zinc-500">Status</TableHead>
                <TableHead className="h-8 px-3 text-xs text-zinc-500">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {discrepancies.map((d) => (
                <TableRow key={d.zoneId}>
                  <TableCell className="px-5 font-medium text-zinc-800">
                    {d.zoneName}
                  </TableCell>
                  <TableCell className="px-3">
                    {d.sheetArea != null ? d.sheetArea.toLocaleString() : "—"}
                  </TableCell>
                  <TableCell className="px-3">
                    {d.estimatedArea != null ? (
                      <span className="inline-flex items-center gap-1">
                        {d.estimatedArea.toLocaleString()}
                        <Badge variant="secondary" className="bg-blue-100 px-1 py-0 text-[10px] text-blue-700">
                          est
                        </Badge>
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="px-3">
                    {d.percentDiff != null ? (
                      <span
                        className={
                          d.percentDiff > 20
                            ? "font-medium text-amber-700"
                            : "text-zinc-600"
                        }
                      >
                        {d.percentDiff}%
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="px-3">
                    <StatusBadge recommendation={d.recommendation} />
                  </TableCell>
                  <TableCell className="px-3">
                    {onOverride && d.estimatedArea != null && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => onOverride(d.zoneId, d.estimatedArea!)}
                        className="text-blue-700 hover:bg-blue-50 hover:text-blue-700"
                      >
                        Use estimated
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </Collapsible>
  );
}
