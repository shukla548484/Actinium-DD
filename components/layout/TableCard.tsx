import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type TableCardProps = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
};

/**
 * shadcn Card with a padded header and full-bleed table body.
 * Avoids stripping Card vertical padding without compensating on the header.
 */
export function TableCard({
  title,
  description,
  headerAction,
  children,
  className,
  headerClassName,
}: TableCardProps) {
  const hasHeader = title != null || description != null || headerAction != null;

  return (
    <Card className={cn("gap-0 overflow-hidden py-0", className)}>
      {hasHeader ? (
        <CardHeader
          className={cn(
            "border-b bg-muted/50 py-4",
            headerAction && "has-data-[slot=card-action]:grid-cols-[1fr_auto]",
            headerClassName,
          )}
        >
          {title != null ? <CardTitle className="text-sm">{title}</CardTitle> : null}
          {description != null ? <CardDescription>{description}</CardDescription> : null}
          {headerAction ? <CardAction>{headerAction}</CardAction> : null}
        </CardHeader>
      ) : null}
      <CardContent className="p-0">{children}</CardContent>
    </Card>
  );
}
