"use client";

import type { DryDockProjectStatus } from "@prisma/client";
import {
  DD_STATUS_LIFECYCLE,
  getStatusLabel,
} from "@/lib/superintendent/engine/statusWorkflow";
import { cn } from "@/lib/utils";

type Props = {
  status: string;
  className?: string;
};

export function ProjectStatusStepper({ status, className }: Props) {
  const current = status as DryDockProjectStatus;
  const isSideState = !DD_STATUS_LIFECYCLE.includes(current);
  const currentIndex = DD_STATUS_LIFECYCLE.indexOf(current);

  const visible = DD_STATUS_LIFECYCLE.filter((_, i) => {
    if (isSideState) return i === 0 || i === DD_STATUS_LIFECYCLE.length - 1 || i % 3 === 0;
    return true;
  });

  return (
    <div className={cn("overflow-x-auto", className)}>
      <div className="flex min-w-max items-center gap-1">
        {visible.map((step, index) => {
          const stepIndex = DD_STATUS_LIFECYCLE.indexOf(step);
          const isPast = !isSideState && stepIndex < currentIndex;
          const isCurrent = step === current;
          const isFuture = !isSideState && stepIndex > currentIndex;

          return (
            <div key={step} className="flex items-center gap-1">
              {index > 0 ? (
                <div
                  className={cn(
                    "h-px w-4 shrink-0",
                    isPast || isCurrent ? "bg-primary" : "bg-border",
                  )}
                />
              ) : null}
              <div
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs whitespace-nowrap",
                  isCurrent && "bg-primary text-primary-foreground font-medium",
                  isPast && "bg-primary/15 text-primary",
                  isFuture && "bg-muted text-muted-foreground",
                  isSideState && step === current && "ring-2 ring-primary/40",
                )}
                title={getStatusLabel(step)}
              >
                {getStatusLabel(step)}
              </div>
            </div>
          );
        })}
        {isSideState ? (
          <div className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-100">
            {getStatusLabel(current)}
          </div>
        ) : null}
      </div>
    </div>
  );
}
