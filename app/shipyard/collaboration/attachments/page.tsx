import { ShipyardRegisterPage } from "@/lib/shipyard/registerPage";

export const dynamic = "force-dynamic";

export default function AttachmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  return ShipyardRegisterPage({ registerType: "attachments", searchParams });
}
