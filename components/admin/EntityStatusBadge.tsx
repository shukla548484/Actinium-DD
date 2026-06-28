import type { EntityStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<
  EntityStatus,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  active: { label: "Active", variant: "default" },
  wait: { label: "Waiting", variant: "secondary" },
  inactive: { label: "Inactive", variant: "outline" },
};

export function EntityStatusBadge({
  status,
  className,
}: {
  status: EntityStatus;
  className?: string;
}) {
  const cfg = STATUS_CONFIG[status];
  return (
    <Badge variant={cfg.variant} className={cn("font-normal", className)}>
      {cfg.label}
    </Badge>
  );
}

export const ENTITY_STATUS_OPTIONS: { value: EntityStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "wait", label: "Waiting" },
  { value: "inactive", label: "Inactive" },
];
