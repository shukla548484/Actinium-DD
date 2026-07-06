"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ShipyardModuleDef } from "@/lib/shipyard/workflow";
import { SHIPYARD_PAGE_API_REGISTRY } from "@/lib/shipyard/apiRegistry";

const STATUS_VARIANT = {
  planned: "outline",
  scaffold: "secondary",
  partial: "default",
  live: "default",
} as const;

export function ShipyardModulePlaceholder({ module }: { module: ShipyardModuleDef }) {
  const apiMap = SHIPYARD_PAGE_API_REGISTRY.find((r) => r.module.id === module.id);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base">{module.label}</CardTitle>
            <Badge variant={STATUS_VARIANT[module.status]}>{module.status}</Badge>
            <Badge variant="outline">{module.phase.replace("_", " ")}</Badge>
          </div>
          <CardDescription>{module.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <p className="mb-1 font-medium">Workflow stages</p>
            <p className="text-muted-foreground">
              {module.workflowStages.length > 0
                ? module.workflowStages.join(" → ")
                : "Foundation module (no workflow stage)"}
            </p>
          </div>
          <div>
            <p className="mb-1 font-medium">Database tables (planned / existing)</p>
            <p className="font-mono text-xs text-muted-foreground">{module.dbTables.join(" · ")}</p>
          </div>
        </CardContent>
      </Card>

      {apiMap ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">API routes</CardTitle>
            <CardDescription>Pages ↔ API reference for this module</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {apiMap.routes.map((route) => (
                <li key={`${route.method}-${route.path}`} className="flex flex-wrap items-center gap-2">
                  <Badge variant={route.status === "live" ? "default" : "outline"} className="font-mono text-[10px]">
                    {route.method}
                  </Badge>
                  <code className="text-xs">{route.path}</code>
                  <span className="text-muted-foreground">— {route.purpose}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <p className="text-xs text-muted-foreground">
        See{" "}
        <Link href="/shipyard/rfq" className="text-primary hover:underline">
          RFQ Inbox
        </Link>{" "}
        for the office → shipyard queue, or{" "}
        <code className="text-xs">docs/shipyard/PORTAL-ERP-PLAN.md</code> for the full build sequence.
      </p>
    </div>
  );
}
