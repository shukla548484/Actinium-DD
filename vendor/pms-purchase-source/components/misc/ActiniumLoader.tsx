"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import Anchor from "lucide-react/dist/esm/icons/anchor.js";

const actiniumKeyframes = `
  @keyframes actinium-spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  @keyframes actinium-dot-wave {
    0%, 33.33%, 100% {
      opacity: 0.5;
      transform: scale(0.88);
    }
    16.67% {
      opacity: 1;
      transform: scale(1.35);
    }
  }

  .actinium-dot-wave {
    animation: actinium-dot-wave 1.2s ease-in-out infinite;
  }

  .actinium-ring-spin {
    animation: actinium-spin 1s linear infinite;
  }
`;

let cssInjected = false;

const injectCSS = () => {
  if (typeof document !== "undefined" && !cssInjected) {
    if (!document.head.querySelector("style[data-actinium-loader]")) {
      const style = document.createElement("style");
      style.textContent = actiniumKeyframes;
      style.setAttribute("data-actinium-loader", "true");
      document.head.appendChild(style);
    }
    cssInjected = true;
  }
};

interface ActiniumLoaderProps {
  size?: "sm" | "md" | "lg" | "xl";
  text?: string;
  /** Shown below the logo (e.g. "Loading reports…"). */
  statusText?: string;
  overlay?: boolean;
  /** `fullscreen` covers the viewport (default). `content` covers only the positioned parent. */
  overlayScope?: "fullscreen" | "content";
  /** `subtle` = transparent backdrop. Default `solid` uses warm off-white. */
  overlayVariant?: "solid" | "subtle";
  className?: string;
  showLogo?: boolean;
  showText?: boolean;
  showDots?: boolean;
}

const BRAND_ORANGE = "#f97316";
const BRAND_MAGENTA = "#d946ef";
const DOT_PERIWINKLE = "#818cf8";
const DOT_PURPLE = "#a855f7";
const DOT_MAGENTA = "#e879f9";

function LoaderBrandMark({ size = "md" }: { size?: ActiniumLoaderProps["size"] }) {
  const ringSize = {
    sm: "h-10 w-10",
    md: "h-12 w-12",
    lg: "h-14 w-14",
    xl: "h-16 w-16",
  };

  const iconSize = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
    xl: "h-7 w-7",
  };

  const innerInset = {
    sm: "inset-[3px]",
    md: "inset-[3px]",
    lg: "inset-[4px]",
    xl: "inset-[4px]",
  };

  const resolved = size ?? "md";

  return (
    <div className={cn("relative shrink-0", ringSize[resolved])}>
      {/* Rotating outer ring */}
      <div
        className={cn(
          "absolute inset-0 rounded-full border-2 border-neutral-200/90",
          "border-t-orange-500 border-r-orange-400/70 actinium-ring-spin",
          ringSize[resolved]
        )}
      />
      {/* Static inner circle + anchor */}
      <div
        className={cn(
          "absolute flex items-center justify-center rounded-full border border-neutral-300/80 bg-white/90",
          innerInset[resolved]
        )}
      >
        <Anchor className={iconSize[resolved]} style={{ color: BRAND_ORANGE }} strokeWidth={2.25} />
      </div>
    </div>
  );
}

function LoaderDots({ size = "md" }: { size?: ActiniumLoaderProps["size"] }) {
  const dotSizes =
    size === "sm"
      ? ["w-1.5 h-1.5", "w-2 h-2", "w-2.5 h-2.5"]
      : size === "lg" || size === "xl"
        ? ["w-2 h-2", "w-2.5 h-2.5", "w-3.5 h-3.5"]
        : ["w-1.5 h-1.5", "w-2.5 h-2.5", "w-3.5 h-3.5"];

  const colors = [DOT_PERIWINKLE, DOT_PURPLE, DOT_MAGENTA];
  const dotCount = dotSizes.length;
  const cycleMs = 1200;
  const stepMs = cycleMs / dotCount;

  return (
    <div className="flex items-end justify-center gap-1.5">
      {dotSizes.map((dim, i) => (
        <div
          key={i}
          className={cn("actinium-dot-wave rounded-full", dim)}
          style={{
            backgroundColor: colors[i],
            animationDelay: `${i * stepMs}ms`,
          }}
        />
      ))}
    </div>
  );
}

function LoaderBrandText({ size = "md" }: { size?: ActiniumLoaderProps["size"] }) {
  const textSize = {
    sm: "text-sm",
    md: "text-base",
    lg: "text-lg",
    xl: "text-xl",
  };

  return (
    <div className={cn("text-center font-semibold tracking-tight", textSize[size ?? "md"])}>
      <span style={{ color: BRAND_ORANGE }}>Actinium</span>
      <span style={{ color: BRAND_MAGENTA }}>-SM</span>
    </div>
  );
}

function ActiniumLoaderContent({
  size = "md",
  statusText,
  className,
  showLogo = true,
  showText = true,
  showDots = true,
}: Omit<ActiniumLoaderProps, "overlay" | "overlayVariant" | "text">) {
  injectCSS();

  return (
    <div className={cn("flex flex-col items-center justify-center gap-3", className)}>
      {showLogo ? <LoaderBrandMark size={size} /> : null}
      {showDots ? <LoaderDots size={size} /> : null}
      {showText ? <LoaderBrandText size={size} /> : null}
      {statusText ? (
        <p className="max-w-xs px-4 text-center text-sm font-medium text-muted-foreground">
          {statusText}
        </p>
      ) : null}
    </div>
  );
}

const ActiniumLoader = ({
  size = "md",
  text,
  statusText,
  overlay = false,
  overlayScope = "fullscreen",
  overlayVariant = "solid",
  className,
  showLogo = true,
  showText = true,
  showDots = true,
}: ActiniumLoaderProps) => {
  const message = statusText ?? (text !== "Actinium-sm" ? text : undefined);

  if (overlay) {
    const isSubtle = overlayVariant === "subtle";
    const isContentScope = overlayScope === "content";
    return (
      <div
        className={cn(
          "flex items-center justify-center",
          isContentScope ? "absolute inset-0 z-40" : "fixed inset-0 z-50",
          isSubtle ? "bg-transparent" : "bg-[#faf8f5]/95 backdrop-blur-[2px]"
        )}
        aria-busy="true"
        aria-live="polite"
      >
        <ActiniumLoaderContent
          size="xl"
          statusText={message}
          showLogo={showLogo}
          showText={showText}
          showDots={showDots}
        />
      </div>
    );
  }

  return (
    <ActiniumLoaderContent
      size={size}
      statusText={message}
      className={className}
      showLogo={showLogo}
      showText={showText}
      showDots={showDots}
    />
  );
};

interface UseActiniumLoaderOptions {
  initialLoading?: boolean;
  autoStopDelay?: number;
}

interface UseActiniumLoaderReturn {
  isLoading: boolean;
  startLoading: () => void;
  stopLoading: () => void;
  ActiniumLoader: typeof ActiniumLoader;
}

export const useActiniumLoader = (
  initialLoading: boolean = false,
  options: UseActiniumLoaderOptions = {}
): UseActiniumLoaderReturn => {
  const [isLoading, setIsLoading] = useState(initialLoading);
  const { autoStopDelay = 10000 } = options;

  const startLoading = useCallback(() => setIsLoading(true), []);
  const stopLoading = useCallback(() => setIsLoading(false), []);

  useEffect(() => {
    if (isLoading && autoStopDelay) {
      const timer = setTimeout(() => {
        console.warn("ActiniumLoader: Auto-stopping loader after timeout to prevent infinite hanging");
        stopLoading();
      }, autoStopDelay);
      return () => clearTimeout(timer);
    }
  }, [isLoading, autoStopDelay, stopLoading]);

  return {
    isLoading,
    startLoading,
    stopLoading,
    ActiniumLoader,
  };
};

export { ActiniumLoader };
export default ActiniumLoader;
