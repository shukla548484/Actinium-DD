"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type CollapsibleCardProps = {
  title: ReactNode;
  description?: ReactNode;
  /** Right-side controls (e.g. Select); clicks do not toggle collapse. */
  headerActions?: ReactNode;
  /** Omit when the card is header-only (warnings, etc.). */
  children?: ReactNode;
  /** When false, body is hidden until the header is clicked. */
  defaultOpen?: boolean;
  className?: string;
  contentClassName?: string;
};

/**
 * Card with expand/collapse. Chevron and title area toggle; optional headerActions stay interactive.
 */
export function CollapsibleCard({
  title,
  description,
  headerActions,
  children,
  defaultOpen = false,
  className,
  contentClassName,
}: CollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen);
  const toggle = () => setOpen((v) => !v);

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-start gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mt-0.5 h-8 w-8 shrink-0 text-muted-foreground"
            onClick={toggle}
            aria-expanded={open}
            aria-label={open ? "Collapse section" : "Expand section"}
          >
            <ChevronDown className={cn("h-5 w-5 transition-transform duration-200", open && "rotate-180")} />
          </Button>
          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <button
              type="button"
              className="min-w-0 flex-1 rounded-md text-left outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              onClick={toggle}
            >
              {typeof title === "string" ? (
                <CardTitle className="text-xl leading-none font-semibold">{title}</CardTitle>
              ) : (
                <div className="text-xl font-semibold leading-none tracking-tight">{title}</div>
              )}
              {description ? (
                typeof description === "string" ? (
                  <CardDescription className="pt-1.5">{description}</CardDescription>
                ) : (
                  <div className="pt-1.5 text-sm text-muted-foreground">{description}</div>
                )
              ) : null}
            </button>
            {headerActions ? (
              <div
                className="shrink-0"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {headerActions}
              </div>
            ) : null}
          </div>
        </div>
      </CardHeader>
      {open && children != null ? (
        <CardContent className={cn("pt-0", contentClassName)}>{children}</CardContent>
      ) : null}
    </Card>
  );
}
