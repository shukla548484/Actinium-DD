"use client";

import { useState } from "react";
import { PageHeader, PageShell } from "@/components/layout/PageShell";
import {
  ActiniumLoader,
  ActiniumLoaderInline,
  ActiniumLoadingState,
  ACTINIUM_LOADER_SIZES,
  type ActiniumLoaderSize,
} from "@/components/ui/ActiniumLoader";
import { useGlobalLoader } from "@/components/layout/GlobalLoaderProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SIZES: ActiniumLoaderSize[] = ["xs", "sm", "md", "lg", "xl", "page"];

export default function LoaderDemoPage() {
  const { startLoading, stopLoading, withLoading } = useGlobalLoader();
  const [panelBusy, setPanelBusy] = useState(false);

  async function simulatePanelLoad() {
    setPanelBusy(true);
    await new Promise((r) => setTimeout(r, 1800));
    setPanelBusy(false);
  }

  async function simulateGlobalLoad() {
    await withLoading(async () => {
      await new Promise((r) => setTimeout(r, 2200));
    }, "demo");
  }

  return (
    <PageShell size="wide">
      <PageHeader
        title="Actinium loader"
        description="Brand loader at every size — global overlay, route transitions, and inline panel states."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Size variants</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 sm:grid-cols-2">
            {SIZES.filter((s) => s !== "page").map((size) => (
              <div
                key={size}
                className="flex flex-col items-center justify-center rounded-lg border bg-muted/30 px-4 py-6"
              >
                <ActiniumLoader
                  size={size}
                  label={size === "xs" || size === "sm" ? undefined : `${size} loader`}
                />
                <p className="mt-4 text-xs text-muted-foreground">
                  {ACTINIUM_LOADER_SIZES[size].ring}px ring
                  {ACTINIUM_LOADER_SIZES[size].logo > 0
                    ? ` · ${ACTINIUM_LOADER_SIZES[size].logo}px logo`
                    : ""}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Usage patterns</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="mb-2 text-sm font-medium">Inline (buttons, rows)</p>
              <ActiniumLoaderInline label="Saving…" size="sm" />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Panel / table body</p>
              {panelBusy ? (
                <ActiniumLoadingState label="Loading requisitions…" size="md" minHeight={160} />
              ) : (
                <div className="flex min-h-[160px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
                  Panel content loaded
                </div>
              )}
              <Button className="mt-3" variant="outline" onClick={() => void simulatePanelLoad()}>
                Simulate panel load
              </Button>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Global overlay</p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void simulateGlobalLoad()}>Simulate global load (2.2s)</Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    startLoading("manual");
                    setTimeout(() => stopLoading("manual"), 1500);
                  }}
                >
                  Manual start / stop
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Also appears automatically on route changes and initial page boot.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Page overlay preview (embedded)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative h-64 overflow-hidden rounded-xl border bg-background">
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-[2px]">
              <ActiniumLoader size="page" label="Loading Actinium-DD…" />
            </div>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
