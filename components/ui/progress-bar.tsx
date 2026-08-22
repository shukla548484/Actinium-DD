import { cn } from "@/lib/utils";

type ProgressBarProps = {
  value: number;
  className?: string;
  size?: "sm" | "md";
};

export function ProgressBar({ value, className, size = "md" }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, value));
  const height = size === "sm" ? "h-1.5" : "h-2";

  return (
    <div
      className={cn(
        "w-full min-w-0 overflow-hidden rounded-full border border-border/50 bg-muted",
        height,
        className,
      )}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn("h-full rounded-full bg-primary transition-[width]", height)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
