"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { BookOpen } from "lucide-react";
import { toast } from "sonner";

type MatchedPack = {
  id: string;
  title: string;
  slug: string;
  qualityScorePercent?: number | null;
  primaryPartNumber?: string | null;
  versionNumber?: number;
  machinery?: { code?: string | null; name?: string | null } | null;
};

export function KnowledgePackMatchHint({
  partNumber,
  drawingNumber,
  itemNumber,
  /** Requisition-level Machinery id (SPR), not MachineryInstance. */
  machineryId,
  impaNumber,
  vesselId,
  requisitionId,
  requisitionItemId,
}: {
  partNumber?: string;
  drawingNumber?: string;
  itemNumber?: string;
  machineryId?: string;
  impaNumber?: string;
  vesselId?: string;
  requisitionId?: string;
  requisitionItemId?: string;
}) {
  const [packs, setPacks] = useState<MatchedPack[]>([]);
  const [linking, setLinking] = useState<string | null>(null);

  useEffect(() => {
    const part = partNumber?.trim();
    if (!part || part.length < 2) {
      setPacks([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ partNumber: part });
        if (drawingNumber?.trim()) params.set("drawingNumber", drawingNumber.trim());
        if (itemNumber?.trim()) params.set("itemNumber", itemNumber.trim());
        if (machineryId?.trim()) params.set("machineryId", machineryId.trim());
        if (impaNumber?.trim()) params.set("impaNumber", impaNumber.trim());
        if (vesselId) params.set("vesselId", vesselId);

        const res = await fetch(`/api/knowledge-packs/match?${params}`, {
          credentials: "include",
        });
        const data = await res.json();
        if (res.ok) setPacks(data.packs || []);
      } catch {
        setPacks([]);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [partNumber, drawingNumber, itemNumber, machineryId, impaNumber, vesselId]);

  const linkPack = async (packId: string) => {
    if (!requisitionId || !requisitionItemId) return;
    setLinking(packId);
    try {
      const res = await fetch(
        `/api/requisitions/${requisitionId}/items/${requisitionItemId}/knowledge-links`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ knowledgePackId: packId }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to link");
      toast.success("Knowledge pack linked to line item");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to link knowledge pack");
    } finally {
      setLinking(null);
    }
  };

  if (!packs.length) return null;

  return (
    <div className="mt-1 rounded-md border border-blue-200 bg-blue-50/80 px-2 py-1.5 text-xs">
      <div className="flex items-center gap-1 font-medium text-blue-900">
        <BookOpen className="h-3 w-3" />
        Knowledge library match
      </div>
      <ul className="mt-1 space-y-1">
        {packs.slice(0, 3).map((pack) => (
          <li key={pack.id} className="flex flex-wrap items-center gap-2 text-blue-950">
            <span>{pack.title}</span>
            {pack.machinery?.code && (
              <span className="text-muted-foreground">({pack.machinery.code})</span>
            )}
            {pack.qualityScorePercent != null && (
              <Badge variant="secondary" className="text-[10px] px-1 py-0">
                {pack.qualityScorePercent}% quality
              </Badge>
            )}
            {requisitionId && requisitionItemId && (
              <button
                type="button"
                className="text-primary underline disabled:opacity-50"
                disabled={linking === pack.id}
                onClick={() => void linkPack(pack.id)}
              >
                {linking === pack.id ? "Linking…" : "Link to line"}
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
