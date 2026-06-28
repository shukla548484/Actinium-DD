import { ShipyardRegisterPage } from "@/lib/shipyard/registerPage";

export const dynamic = "force-dynamic";

export default function VariationsPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  return ShipyardRegisterPage({ registerType: "variations", searchParams });
}
