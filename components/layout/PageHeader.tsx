"use client";

import { usePathname } from "next/navigation";
import { BackButton } from "@/components/layout/BackButton";
import { shouldShowPageBack } from "@/lib/navigation/goBack";
import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  /** Show browser-back control (default: true on nested routes) */
  showBack?: boolean;
  /** When history is empty, navigate here instead of parent path */
  backFallbackHref?: string;
  backLabel?: string;
};

export function PageHeader({
  title,
  description,
  actions,
  className,
  showBack,
  backFallbackHref,
  backLabel,
}: PageHeaderProps) {
  const pathname = usePathname();
  const showBackButton = showBack ?? shouldShowPageBack(pathname);

  return (
    <div className={cn("space-y-3", className)}>
      {showBackButton ? (
        <BackButton fallbackHref={backFallbackHref} label={backLabel ?? "Back"} forceShow />
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
