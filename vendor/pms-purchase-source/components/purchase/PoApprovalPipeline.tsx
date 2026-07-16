"use client";

import { CheckCircle2, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PoApprovalStage {
  level: number;
  status: "PENDING" | "APPROVED" | "NOT_REQUIRED";
  approverName?: string;
  approvedAt?: string;
}

interface PoApprovalPipelineProps {
  stages: PoApprovalStage[];
  requiresThreeApprovals: boolean;
  canApproveAtLevel: (level: number) => boolean;
  onApprove: (level: number) => void;
  approving: boolean;
  className?: string;
}

function stageLabel(status: PoApprovalStage["status"]): string {
  if (status === "APPROVED") return "Approved";
  if (status === "PENDING") return "Pending";
  return "Waiting";
}

function connectorClass(prevStatus: PoApprovalStage["status"]): string {
  return prevStatus === "APPROVED" ? "bg-success" : "bg-border";
}

function circleClass(status: PoApprovalStage["status"]): string {
  if (status === "APPROVED") return "border-success bg-success/10 text-success";
  if (status === "PENDING") return "border-warning bg-warning/10 text-warning";
  return "border-muted-foreground/30 bg-muted text-muted-foreground";
}

function badgeClass(status: PoApprovalStage["status"]): string {
  if (status === "APPROVED") return "bg-success";
  if (status === "PENDING") return "bg-warning";
  return "bg-muted-foreground/60";
}

export function PoApprovalPipeline({
  stages,
  requiresThreeApprovals,
  canApproveAtLevel,
  onApprove,
  approving,
  className,
}: PoApprovalPipelineProps) {
  const visibleStages = stages.slice(0, requiresThreeApprovals ? 3 : 2);

  return (
    <div className={cn("min-w-0 w-full", className)}>
      <p className="mb-2 text-right text-xs text-muted-foreground hidden sm:block">
        {requiresThreeApprovals
          ? "3 approval levels required (≥ $10,000)"
          : "2 approval levels required (≥ $3,000)"}
      </p>
      <div className="flex items-start justify-end gap-0 overflow-x-auto pb-1">
        {visibleStages.map((stage, index) => {
          const level = index + 1;
          const canApprove = canApproveAtLevel(level);
          const isPending = stage.status === "PENDING";

          return (
            <div key={stage.level} className="flex items-start">
              {index > 0 ? (
                <div
                  className={cn(
                    "mt-[2.125rem] h-0.5 w-6 shrink-0 sm:w-10",
                    connectorClass(visibleStages[index - 1].status)
                  )}
                />
              ) : null}
              <div className="flex min-w-[4.75rem] flex-col items-center sm:min-w-[5.5rem]">
                <span className="mb-1 whitespace-nowrap text-[10px] font-medium text-muted-foreground sm:text-xs">
                  Level {level}
                </span>
                <div className="relative">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full border-2 sm:h-12 sm:w-12",
                      circleClass(stage.status)
                    )}
                  >
                    {stage.status === "APPROVED" ? (
                      <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6" />
                    ) : (
                      <Clock className={cn("h-5 w-5 sm:h-6 sm:w-6", stage.status === "NOT_REQUIRED" && "opacity-50")} />
                    )}
                  </div>
                  <span
                    className={cn(
                      "absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white",
                      badgeClass(stage.status)
                    )}
                  >
                    {level}
                  </span>
                </div>
                <span
                  className={cn(
                    "mt-1.5 text-center text-[10px] font-medium sm:text-xs",
                    stage.status === "PENDING" && "text-warning",
                    stage.status === "APPROVED" && "text-success",
                    stage.status === "NOT_REQUIRED" && "text-muted-foreground"
                  )}
                >
                  {stageLabel(stage.status)}
                </span>
                {stage.status === "APPROVED" && stage.approverName ? (
                  <span className="mt-0.5 max-w-[5.5rem] truncate text-center text-[9px] text-muted-foreground">
                    {stage.approverName}
                  </span>
                ) : null}
                {canApprove && isPending ? (
                  <Button
                    size="sm"
                    onClick={() => onApprove(level)}
                    disabled={approving}
                    className="mt-1.5 h-6 px-2 text-[10px] bg-info hover:bg-info"
                  >
                    {approving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Approve"}
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
