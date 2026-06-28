import { ShipyardRegisterPage } from "@/components/shipyard/ShipyardRegisterPage";

export default function FinalCompletionPage() {
  return (
    <ShipyardRegisterPage
      title="Final completion"
      description="Project close-out report — all jobs complete, inspections signed, variations settled."
      columns={["Checklist item", "Workshop", "Status", "Signed by", "Date", "Remarks"]}
    />
  );
}
