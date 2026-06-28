"use client";

import { DryDockTable } from "@/components/DryDockTable";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { DryDockComparison, VendorDryDockQuote } from "@/lib/dryDock/types";

interface DryDockViewProps {
  quotes: VendorDryDockQuote[];
  comparison: DryDockComparison | null;
}

export function DryDockView({ quotes, comparison }: DryDockViewProps) {
  if (quotes.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Upload vendor Excel files to read stated dry-dock days and daily dock hire
        rates.
      </p>
    );
  }

  if (!comparison) return null;

  return (
    <div className="space-y-6">
      <Alert className="border-blue-200 bg-blue-50/60 text-blue-950">
        <AlertTitle>Dry dock — how days &amp; cost are calculated</AlertTitle>
        <AlertDescription className="text-blue-900/90">
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>
              <strong>Days</strong> come only from the shipyard&apos;s stated figure in
              the header or summary (e.g. &quot;Days in dry dock: 12&quot;), not from
              line-item quantities or calendar dates.
            </li>
            <li>
              <strong>Daily rate</strong> is read from the dock hire / dockage line in
              the priced schedule ($/day).
            </li>
            <li>
              <strong>Calculated total</strong> = stated days × daily rate.
            </li>
          </ul>
        </AlertDescription>
      </Alert>

      <DryDockTable result={comparison} />
    </div>
  );
}
