"use client";

import * as React from "react";
import ActiniumLoader from "@/components/ActiniumLoader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export type PageReadyGateProps = {
  /** When true, children are shown. When false, loading or error UI is shown instead. */
  ready: boolean;
  /** If set while not ready, error card is shown (takes precedence over spinner). */
  error?: string | null;
  onRetry?: () => void;
  /**
   * Body to show when ready. Prefer this over `children` when the UI reads async data:
   * `children` are still evaluated by React when the parent renders (before this gate runs),
   * which can throw if props are null (e.g. `user.firstName` while user is still loading).
   */
  render?: () => React.ReactNode;
  children?: React.ReactNode;
  loadingText?: string;
  /** Minimum height for the loading/error region */
  className?: string;
};

/**
 * Blocks the page body until initial data is available so filters/dropdowns are not empty on first paint.
 * Use with client pages: set `ready` only after the first successful load of data required for navigation controls.
 * Ongoing refetches can use local `loading` + skeletons inside children without setting `ready` back to false.
 */
export function PageReadyGate({
  ready,
  error,
  onRetry,
  render,
  children,
  loadingText = "Loading…",
  className = "min-h-[50vh] flex items-center justify-center p-6",
}: PageReadyGateProps) {
  if (ready) {
    if (render) {
      return <>{render()}</>;
    }
    return <>{children ?? null}</>;
  }

  if (error) {
    return (
      <div className={className}>
        <Card className="max-w-md w-full border-destructive/30">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-7 w-7 text-destructive" />
            </div>
            <CardTitle className="text-lg">Could not load this page</CardTitle>
            <CardDescription className="text-pretty">{error}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pb-6">
            {onRetry ? (
              <Button type="button" onClick={onRetry}>
                Try again
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={className}>
      <ActiniumLoader size="lg" statusText={loadingText} showDots showText />
    </div>
  );
}
