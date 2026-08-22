"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  kind: "tender" | "dryDock";
  projectId: string;
  size?: "sm" | "default";
  redirectTo?: string;
  onDone?: () => void;
};

export function UnarchiveProjectButton({
  kind,
  projectId,
  size = "sm",
  redirectTo,
  onDone,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleUnarchive() {
    if (!window.confirm("Unarchive this project and return it to active lists?")) {
      return;
    }
    setBusy(true);
    const url =
      kind === "tender"
        ? `/api/projects/${projectId}/archive`
        : `/api/superintendent/projects/${projectId}/archive`;
    const res = await fetch(url, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      window.alert(data.error ?? "Unarchive failed");
      return;
    }
    onDone?.();
    if (redirectTo) {
      router.push(redirectTo);
    }
    router.refresh();
  }

  return (
    <Button
      size={size}
      variant="outline"
      disabled={busy}
      onClick={() => void handleUnarchive()}
    >
      {busy ? "Unarchiving…" : "Unarchive"}
    </Button>
  );
}
