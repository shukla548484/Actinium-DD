"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  requisitionTypeBadgeClass,
  requisitionTypeLabel,
} from "@/lib/requisition-badge-styles";

type Props = {
  type: string | null | undefined;
  className?: string;
  /** Optional suffix e.g. subcategory */
  suffix?: React.ReactNode;
  children?: React.ReactNode;
};

export function RequisitionTypeBadge({ type, className, suffix, children }: Props) {
  return (
    <Badge variant="outline" className={cn(requisitionTypeBadgeClass(type), className)}>
      {children ?? requisitionTypeLabel(type)}
      {suffix}
    </Badge>
  );
}
