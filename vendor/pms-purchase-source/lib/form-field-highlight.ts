import { cn } from "@/lib/utils";

/** Visible red border/ring for missed mandatory fields after a failed submit (matches `aria-invalid` Input styling). */
export function fieldErrorCn(hasError: boolean, className?: string) {
  return cn(
    className,
    hasError && "border-destructive ring-2 ring-destructive/30 aria-invalid"
  );
}
