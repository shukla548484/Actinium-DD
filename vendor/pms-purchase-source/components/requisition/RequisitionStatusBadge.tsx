"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  requisitionStatusBadgeClass,
  requisitionStatusLabel,
} from "@/lib/requisition-badge-styles";

type Props = {
  status: string | null | undefined;
  className?: string;
  children?: React.ReactNode;
};

export function RequisitionStatusBadge({ status, className, children }: Props) {
  return (
    <Badge
      variant="outline"
      className={cn(requisitionStatusBadgeClass(status), className)}
    >
      {children ?? requisitionStatusLabel(status)}
    </Badge>
  );
}
