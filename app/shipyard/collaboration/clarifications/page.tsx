import { ShipyardRegisterPage } from "@/lib/shipyard/registerPage";

export const dynamic = "force-dynamic";

export default function ClarificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  return ShipyardRegisterPage({ registerType: "clarifications", searchParams });
}
