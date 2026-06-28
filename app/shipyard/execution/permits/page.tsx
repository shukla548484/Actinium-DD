import { ShipyardRegisterPage } from "@/lib/shipyard/registerPage";

export const dynamic = "force-dynamic";

export default function PermitRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  return ShipyardRegisterPage({ registerType: "permits", searchParams });
}
