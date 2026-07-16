"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  requisitionGenerationStatusBadgeClass,
  requisitionGenerationStatusLabel,
} from "@/lib/requisition-badge-styles";

type Props = {
  status: string | null | undefined;
  className?: string;
  children?: React.ReactNode;
};

export function RequisitionGenerationStatusBadge({ status, className, children }: Props) {
  return (
    <Badge
      variant="outline"
      className={cn(requisitionGenerationStatusBadgeClass(status), className)}
    >
      {children ?? requisitionGenerationStatusLabel(status)}
    </Badge>
  );
}
