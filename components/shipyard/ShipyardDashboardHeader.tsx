"use client";

import Link from "next/link";
import { PageHeader } from "@/components/layout/PageShell";
import { useShipyardLanguage } from "@/components/shipyard/ShipyardLanguageProvider";
import { Button } from "@/components/ui/button";

export function ShipyardDashboardHeader() {
  const { label } = useShipyardLanguage();
  return (
    <PageHeader
      title={label("dashboardTitle")}
      actions={
        <Button render={<Link href="/shipyard/rfq" />} nativeButton={false}>
          {label("rfqInbox")}
        </Button>
      }
    />
  );
}
