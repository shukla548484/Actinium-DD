"use client";

import React from "react";
import { format } from "date-fns";
import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PurchaseWorkflowStep } from "@/lib/procurement/purchase-workflow-step";

function formatStepTime(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  return format(d, "dd/MM/yy HH:mm");
}

function stepIndicatorClass(status: PurchaseWorkflowStep["status"]): string {
  switch (status) {
    case "completed":
      return "border-success bg-success text-white";
    case "not_required":
      return "border-muted-foreground/25 bg-muted text-muted-foreground";
    case "current":
      return "border-info bg-info text-white";
    case "waiting":
      return "border-muted-foreground/25 bg-muted/50 text-muted-foreground";
    default:
      return "border-muted-foreground/35 bg-background text-muted-foreground";
  }
}

function topBarStepIndicatorClass(status: PurchaseWorkflowStep["status"]): string {
  switch (status) {
    case "completed":
      return "border-white/40 bg-success text-white shadow-sm";
    case "not_required":
      return "border-white/30 bg-white/10 text-white/60";
    case "current":
      return "border-white bg-white text-info shadow-md ring-2 ring-white/50";
    case "waiting":
      return "border-white/35 bg-white/15 text-white/50";
    default:
      return "border-white/50 bg-white/10 text-white/70";
  }
}

function topBarConnectorClass(status: PurchaseWorkflowStep["status"]): string {
  switch (status) {
    case "completed":
      return "bg-success/80";
    default:
      return "bg-white/35";
  }
}

function connectorClass(status: PurchaseWorkflowStep["status"]): string {
  switch (status) {
    case "completed":
      return "bg-success";
    case "not_required":
      return "bg-muted";
    case "current":
      return "bg-info/60";
    default:
      return "bg-muted";
  }
}

function topBarStepSubLabel(step: PurchaseWorkflowStep): string | null {
  if (step.status === "not_required") return "N/A";
  if (step.approvedAt) {
    const time = formatStepTime(step.approvedAt);
    if (step.approverName && time) return `${step.approverName} · ${time}`;
    return step.approverName || time;
  }
  if (step.status === "waiting") return "Wait";
  if (step.status === "pending" || step.status === "current") return "Pend";
  return null;
}

function TopBarStep({ step }: { step: PurchaseWorkflowStep }) {
  const subLabel = topBarStepSubLabel(step);

  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap px-0.5">
      <div
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
          topBarStepIndicatorClass(step.status)
        )}
      >
        {step.status === "completed" ? (
          <Check className="h-3 w-3" strokeWidth={3} />
        ) : step.status === "not_required" ? (
          <span className="text-[10px] font-semibold leading-none">—</span>
        ) : (
          <Circle
            className={cn(
              "fill-current",
              step.status === "current" ? "h-2.5 w-2.5 text-info" : "h-2 w-2 text-white/55"
            )}
          />
        )}
      </div>
      <span className="text-[10px] font-semibold leading-none text-white">{step.title}</span>
      {subLabel ? (
        <span className="max-w-[8.5rem] truncate text-[9px] leading-none text-white/75">
          {subLabel}
        </span>
      ) : null}
    </div>
  );
}

function TopBarMatrix({
  steps,
  className,
}: {
  steps: PurchaseWorkflowStep[];
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 overflow-x-auto", className)}>
      <div className="flex min-w-max items-center justify-center px-1">
        {steps.map((step, index) => (
          <React.Fragment key={step.step}>
            <TopBarStep step={step} />
            {index < steps.length - 1 ? (
              <div
                className={cn(
                  "mx-0.5 h-px w-3 shrink-0 rounded-full sm:w-4",
                  topBarConnectorClass(step.status)
                )}
              />
            ) : null}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

function CompactStep({
  step,
  forCapture = false,
}: {
  step: PurchaseWorkflowStep;
  forCapture?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-0 px-0.5",
        forCapture ? "min-w-[4rem] max-w-[5rem]" : "min-w-[3.25rem] max-w-[4.25rem]"
      )}
    >
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full border",
          forCapture ? "h-5 w-5" : "h-4 w-4",
          stepIndicatorClass(step.status)
        )}
      >
        {step.status === "completed" ? (
          <Check className={cn(forCapture ? "h-2.5 w-2.5" : "h-2 w-2")} strokeWidth={3} />
        ) : step.status === "not_required" ? (
          <span className={cn("font-semibold leading-none", forCapture ? "text-[9px]" : "text-[8px]")}>
            —
          </span>
        ) : (
          <Circle className={cn("fill-current", forCapture ? "h-2 w-2" : "h-1.5 w-1.5")} />
        )}
      </div>
      <p
        className={cn(
          "w-full truncate text-center font-semibold leading-tight text-foreground",
          forCapture ? "text-[9px]" : "text-[8px]"
        )}
      >
        {step.title}
      </p>
      {step.approverName ? (
        <p
          className={cn(
            "w-full truncate text-center leading-tight text-muted-foreground",
            forCapture ? "text-[8px]" : "text-[7px]"
          )}
        >
          {step.approverName}
        </p>
      ) : null}
      {step.status === "not_required" ? (
        <p
          className={cn(
            "text-center leading-tight text-muted-foreground",
            forCapture ? "text-[8px]" : "text-[7px]"
          )}
        >
          N/A
        </p>
      ) : step.approvedAt ? (
        <p
          className={cn(
            "text-center leading-tight text-muted-foreground",
            forCapture ? "text-[8px]" : "text-[7px]"
          )}
        >
          {formatStepTime(step.approvedAt)}
        </p>
      ) : step.status === "waiting" ? (
        <p
          className={cn(
            "text-center leading-tight text-muted-foreground",
            forCapture ? "text-[8px]" : "text-[7px]"
          )}
        >
          Wait
        </p>
      ) : step.status === "pending" || step.status === "current" ? (
        <p
          className={cn(
            "text-center leading-tight text-muted-foreground",
            forCapture ? "text-[8px]" : "text-[7px]"
          )}
        >
          Pend
        </p>
      ) : null}
    </div>
  );
}

function CompactMatrix({
  steps,
  className,
  forCapture = false,
}: {
  steps: PurchaseWorkflowStep[];
  className?: string;
  forCapture?: boolean;
}) {
  return (
    <div className={cn("min-w-0 overflow-x-auto", className)}>
      <div className="flex min-w-max items-start justify-center px-0.5 py-0">
        {steps.map((step, index) => (
          <React.Fragment key={step.step}>
            <CompactStep step={step} forCapture={forCapture} />
            {index < steps.length - 1 ? (
              <div
                className={cn(
                  "mt-2 h-px shrink-0 rounded-full",
                  forCapture ? "w-3" : "w-2",
                  connectorClass(step.status)
                )}
              />
            ) : null}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

export type PurchaseApprovalMatrixProps = {
  title?: string;
  steps: PurchaseWorkflowStep[];
  className?: string;
  variant?: "default" | "compact" | "inline" | "headerInline" | "topBar";
  forCapture?: boolean;
};

export function PurchaseApprovalMatrix({
  title = "Procurement Approval Matrix",
  steps,
  className,
  variant = "default",
  forCapture = false,
}: PurchaseApprovalMatrixProps) {
  if (variant === "topBar") {
    return <TopBarMatrix steps={steps} className={className} />;
  }

  if (variant === "inline") {
    return <CompactMatrix steps={steps} className={className} forCapture={forCapture} />;
  }

  if (variant === "headerInline") {
    return (
      <div
        className={cn(
          "flex min-w-0 items-center gap-3 rounded-md border bg-card px-2.5 py-1",
          forCapture && "py-1.5",
          className
        )}
      >
        <span
          className={cn(
            "shrink-0 font-semibold whitespace-nowrap",
            forCapture ? "text-sm" : "text-xs"
          )}
        >
          {title}
        </span>
        <CompactMatrix steps={steps} className="min-w-0 flex-1" forCapture={forCapture} />
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className={cn("min-w-0", className)}>
        <CompactMatrix steps={steps} forCapture={forCapture} />
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="py-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 pb-3">
        <CompactMatrix steps={steps} forCapture={forCapture} />
      </CardContent>
    </Card>
  );
}
