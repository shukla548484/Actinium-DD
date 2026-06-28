import { ShipyardRegisterPage } from "@/components/shipyard/ShipyardRegisterPage";

export default function WorkDonePage() {
  return (
    <ShipyardRegisterPage
      title="Work done"
      description="Progress vs budgeted scope — supports invoice and final account reconciliation."
      columns={["Job", "Budget ref", "Qty scope", "Qty done", "Unit", "Value done", "Certificate"]}
    />
  );
}
