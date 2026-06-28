"use client";

import { ArrowLeft } from "lucide-react";
import { usePathname } from "next/navigation";
import { useGoBack } from "@/hooks/useGoBack";
import { shouldShowPageBack } from "@/lib/navigation/goBack";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type BackButtonProps = {
  fallbackHref?: string;
  label?: string;
  className?: string;
  variant?: "outline" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon" | "icon-sm";
  /** Override auto-hide on module root pages */
  forceShow?: boolean;
};

export function BackButton({
  fallbackHref,
  label = "Back",
  className,
  variant = "outline",
  size = "sm",
  forceShow = false,
}: BackButtonProps) {
  const pathname = usePathname();
  const goBack = useGoBack(fallbackHref);

  if (!forceShow && !shouldShowPageBack(pathname)) return null;

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={cn("gap-1.5", className)}
      onClick={goBack}
    >
      <ArrowLeft className="size-4 shrink-0" aria-hidden />
      {label}
    </Button>
  );
}
