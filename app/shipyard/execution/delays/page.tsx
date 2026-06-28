import { ShipyardRegisterPage } from "@/lib/shipyard/registerPage";

export const dynamic = "force-dynamic";

export default function DelayRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  return ShipyardRegisterPage({ registerType: "delays", searchParams });
}
