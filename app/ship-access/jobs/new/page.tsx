import { redirect } from "next/navigation";

/** Legacy route — dry dock scope jobs now live under /ship-access/dry-dock/jobs. */
export default function ShipAccessNewJobPage() {
  redirect("/ship-access/dry-dock/jobs/new");
}
