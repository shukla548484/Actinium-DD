import Image from "next/image";
import { cn } from "@/lib/utils";

/** Loader footprint — xs inline … page full-screen overlay. */
export type ActiniumLoaderSize = "xs" | "sm" | "md" | "lg" | "xl" | "page";

const SIZE_CONFIG: Record<
  ActiniumLoaderSize,
  {
    ring: number;
    logo: number;
    stroke: number;
    gap: number;
    dotsGap: number;
    dot: number;
    labelClass: string;
  }
> = {
  xs: { ring: 14, logo: 0, stroke: 1.25, gap: 0, dotsGap: 4.5, dot: 4.5, labelClass: "text-[10px]" },
  sm: { ring: 22, logo: 0, stroke: 1.5, gap: 0, dotsGap: 6, dot: 5.25, labelClass: "text-xs" },
  md: { ring: 36, logo: 18, stroke: 1.75, gap: 8, dotsGap: 7.5, dot: 7.5, labelClass: "text-sm" },
  lg: { ring: 56, logo: 28, stroke: 2, gap: 12, dotsGap: 9, dot: 9, labelClass: "text-sm" },
  xl: { ring: 72, logo: 36, stroke: 2.25, gap: 14, dotsGap: 10.5, dot: 10.5, labelClass: "text-base" },
  page: { ring: 64, logo: 32, stroke: 2, gap: 16, dotsGap: 10.5, dot: 9.75, labelClass: "text-sm" },
};

const DOT_COLORS = ["var(--dd-rose-bright)", "var(--dd-orange-bright)", "var(--dd-yellow-bright)"] as const;

function ActiniumLoaderDots({ dot, gap }: { dot: number; gap: number }) {
  return (
    <div
      className="flex items-center justify-center"
      style={{ gap, marginTop: gap }}
      aria-hidden="true"
    >
      {DOT_COLORS.map((color) => (
        <span
          key={color}
          className="actinium-loader-dot shrink-0"
          style={{ width: dot, height: dot, backgroundColor: color }}
        />
      ))}
    </div>
  );
}

export type ActiniumLoaderProps = {
  size?: ActiniumLoaderSize;
  /** Shown below the spinner from md upward, and always for page size. */
  label?: string;
  className?: string;
  /** Accessible name when no visible label. */
  ariaLabel?: string;
};

export function ActiniumLoader({
  size = "md",
  label,
  className,
  ariaLabel = "Loading",
}: ActiniumLoaderProps) {
  const config = SIZE_CONFIG[size];
  const showLabel = Boolean(label) && size !== "xs" && size !== "sm";
  const showLogo = config.logo > 0;

  return (
    <div
      className={cn("flex flex-col items-center justify-center", className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={showLabel ? undefined : ariaLabel}
    >
      <div
        className="relative flex items-center justify-center"
        style={{ width: config.ring, height: config.ring }}
      >
        <div
          className="actinium-loader-ring absolute inset-0"
          style={{ borderWidth: config.stroke }}
        />
        {showLogo ? (
          <div
            className="actinium-loader-pulse relative overflow-hidden rounded-full bg-background shadow-sm ring-1 ring-border/60"
            style={{ width: config.logo, height: config.logo }}
          >
            <Image
              src="/actinium-sm-logo.png"
              alt=""
              width={config.logo}
              height={config.logo}
              className="h-full w-full object-contain p-0.5"
              priority={size === "page"}
            />
          </div>
        ) : null}
      </div>
      <ActiniumLoaderDots dot={config.dot} gap={config.dotsGap} />
      {showLabel ? (
        <p
          className={cn(
            "mt-3 font-medium text-muted-foreground",
            config.labelClass,
            size === "page" && "tracking-wide",
          )}
          style={{ marginTop: config.gap }}
        >
          {label}
        </p>
      ) : null}
      <span className="sr-only">{label ?? ariaLabel}</span>
    </div>
  );
}

/** Centred loader block for panels, tables, and card bodies. */
export function ActiniumLoadingState({
  label = "Loading…",
  size = "md",
  className,
  minHeight,
}: {
  label?: string;
  size?: ActiniumLoaderSize;
  className?: string;
  minHeight?: string | number;
}) {
  return (
    <div
      className={cn("flex w-full items-center justify-center py-10", className)}
      style={minHeight != null ? { minHeight } : undefined}
    >
      <ActiniumLoader size={size} label={label} />
    </div>
  );
}

/** Full-viewport overlay — used by the global loader provider and route transitions. */
export function ActiniumLoaderOverlay({
  label = "Loading Actinium-DD…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "actinium-loader-overlay-enter fixed inset-0 z-[9000] flex items-center justify-center",
        "bg-background/75 backdrop-blur-[2px]",
        className,
      )}
      // Keep top-nav menus (z-9999) clickable if the overlay ever sticks briefly.
      style={{ pointerEvents: "auto" }}
      aria-hidden={false}
    >
      <div className="rounded-2xl border border-border/60 bg-card/90 px-10 py-8 shadow-lg">
        <ActiniumLoader size="page" label={label} />
      </div>
    </div>
  );
}

/** Inline loader row — e.g. beside a button or table header. */
export function ActiniumLoaderInline({
  label,
  size = "sm",
  className,
}: {
  label?: string;
  size?: "xs" | "sm";
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-muted-foreground", className)}>
      <ActiniumLoader size={size} ariaLabel={label ?? "Loading"} />
      {label ? <span className="text-sm">{label}</span> : null}
    </span>
  );
}

export { SIZE_CONFIG as ACTINIUM_LOADER_SIZES };
