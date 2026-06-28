import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SyncStatus } from "@/lib/sync/status";
import { cn } from "@/lib/utils";

interface SyncStatusPanelProps {
  status: SyncStatus | null;
  apiConnected: boolean;
  dark?: boolean;
}

export function SyncStatusPanel({ status, apiConnected, dark }: SyncStatusPanelProps) {
  return (
    <Card
      size="sm"
      className={cn(
        "rounded-none border-0 border-t shadow-none ring-0",
        dark ? "border-zinc-800 bg-transparent text-zinc-400" : "border-dd-border bg-transparent text-dd-text-muted",
      )}
    >
      <CardHeader className="pb-1">
        <CardTitle className={cn("text-[10px] font-medium", dark ? "text-zinc-300" : "text-dd-black")}>
          Sync
        </CardTitle>
      </CardHeader>
      <CardContent className="text-[10px]">
        <p>
          Local API:{" "}
          <span className={apiConnected ? "text-emerald-500" : "text-dd-rose-bright"}>
            {apiConnected ? "connected" : "offline — run npm run fleet:api"}
          </span>
        </p>
        {status && (
          <>
            <p className="mt-1">Node: {status.fleetOriginNode}</p>
            {status.vesselId && <p>Vessel ID: {status.vesselId}</p>}
            <p className="mt-1 opacity-70">{status.message}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
